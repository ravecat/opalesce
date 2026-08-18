import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { JsonSchemaGenerationErrorCode } from "../src/errors.js";

interface CorpusInstanceExpectation {
  readonly definition: string;
  readonly file: string;
  readonly valid: boolean;
}

interface CorpusSuccessExpectation {
  readonly kind: "success";
  readonly artifacts: readonly { readonly file: string; readonly path: string }[];
  readonly instances: readonly CorpusInstanceExpectation[];
}

interface CorpusErrorExpectation {
  readonly kind: "error";
  readonly code: JsonSchemaGenerationErrorCode;
  readonly sourcePointer: string;
}

export interface CorpusCase {
  readonly id: string;
  readonly input: string;
  readonly version: string;
  readonly tags: readonly string[];
  readonly sourceUnavailable: boolean;
  readonly expected: CorpusErrorExpectation | CorpusSuccessExpectation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string, pointer: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new TypeError(`${pointer}/${field} must be a string.`);
  }
  return value;
}

function fileField(record: Record<string, unknown>, field: string, pointer: string): string {
  const value = stringField(record, field, pointer);
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").includes("..")
  ) {
    throw new TypeError(`${pointer}/${field} must be a case-relative file path.`);
  }
  return value;
}

function isErrorCode(value: string): value is JsonSchemaGenerationErrorCode {
  switch (value) {
    case "COMPONENT_NAME_COLLISION":
    case "DIALECT_CONFLICT":
    case "DUPLICATE_SCHEMA_ID":
    case "INVALID_COMPONENT_NAME":
    case "INVALID_JSON_SCHEMA":
    case "INVALID_SCHEMA_ID":
    case "SOURCE_UNAVAILABLE":
    case "UNRESOLVED_REFERENCE":
    case "UNSUPPORTED_ASYNCAPI_VERSION":
    case "UNSUPPORTED_REFERENCE":
    case "UNSUPPORTED_SCHEMA_FORMAT":
      return true;
    default:
      return false;
  }
}

function expectationOf(
  value: unknown,
  pointer: string,
): CorpusErrorExpectation | CorpusSuccessExpectation {
  if (!isRecord(value)) {
    throw new TypeError(`${pointer} must be an object.`);
  }
  const kind = stringField(value, "kind", pointer);

  if (kind === "success") {
    if (!Array.isArray(value.instances)) {
      throw new TypeError(`${pointer}/instances must be an array.`);
    }
    return {
      kind,
      artifacts: [],
      instances: value.instances.map((instance, index) => {
        const instancePointer = `${pointer}/instances/${index}`;
        if (!isRecord(instance)) {
          throw new TypeError(`${instancePointer} must be an object.`);
        }
        if (typeof instance.valid !== "boolean") {
          throw new TypeError(`${instancePointer}/valid must be a boolean.`);
        }
        return {
          definition: stringField(instance, "definition", instancePointer),
          file: fileField(instance, "file", instancePointer),
          valid: instance.valid,
        };
      }),
    };
  }

  if (kind === "error") {
    const code = stringField(value, "code", pointer);
    if (!isErrorCode(code)) {
      throw new TypeError(`${pointer}/code is not a known generation error code.`);
    }
    return {
      kind,
      code,
      sourcePointer: stringField(value, "sourcePointer", pointer),
    };
  }

  throw new TypeError(`${pointer}/kind must be "success" or "error".`);
}

function caseOf(value: unknown, id: string): CorpusCase {
  const pointer = `${id}/case.json`;
  if (!isRecord(value)) {
    throw new TypeError(`${pointer} must contain an object.`);
  }
  if (value.sourceUnavailable !== undefined && typeof value.sourceUnavailable !== "boolean") {
    throw new TypeError(`${pointer}/sourceUnavailable must be a boolean.`);
  }
  if (value.id !== undefined || value.artifacts !== undefined || value.golden !== undefined) {
    throw new TypeError(
      `${pointer} must derive its id and expected artifacts from its case directory.`,
    );
  }
  if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string")) {
    throw new TypeError(`${pointer}/tags must be an array of strings.`);
  }

  return {
    id,
    input: fileField(value, "input", pointer),
    version: stringField(value, "version", pointer),
    tags: value.tags,
    sourceUnavailable: value.sourceUnavailable ?? false,
    expected: expectationOf(value.expected, `${pointer}/expected`),
  };
}

async function filesUnder(root: URL, prefix = ""): Promise<readonly string[]> {
  const files: string[] = [];

  for (const entry of (await readdir(root, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const relativePath = join(prefix, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(new URL(`${entry.name}/`, root), relativePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new TypeError(
        `Corpus may contain regular files and directories only: ${relativePath}.`,
      );
    }
    files.push(relativePath);
  }

  return files;
}

const CASES_ROOT = new URL("./fixtures/corpus/cases/", import.meta.url);

export function caseFileUrl(corpusCase: CorpusCase, file: string): URL {
  return new URL(`${corpusCase.id}/${file}`, CASES_ROOT);
}

export async function loadCorpus(): Promise<readonly CorpusCase[]> {
  const cases: CorpusCase[] = [];

  for (const entry of (await readdir(CASES_ROOT, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory()) {
      throw new TypeError(`Corpus cases/ may contain case directories only: ${entry.name}.`);
    }
    const corpusCase = caseOf(
      JSON.parse(await readFile(new URL(`${entry.name}/case.json`, CASES_ROOT), "utf8")) as unknown,
      entry.name,
    );
    if (corpusCase.expected.kind === "error") {
      cases.push(corpusCase);
      continue;
    }

    let paths: readonly string[];
    try {
      paths = await filesUnder(new URL(`${corpusCase.id}/expected/`, CASES_ROOT));
    } catch {
      throw new TypeError(`Success corpus case "${corpusCase.id}" must contain expected/.`);
    }
    if (paths.length === 0) {
      throw new TypeError(`Success corpus case "${corpusCase.id}" must contain an artifact.`);
    }
    cases.push({
      ...corpusCase,
      expected: {
        ...corpusCase.expected,
        artifacts: paths
          .map((path) => ({ file: `expected/${path}`, path }))
          .sort((left, right) => {
            const leftIndex = left.path.endsWith("/index.schema.json");
            const rightIndex = right.path.endsWith("/index.schema.json");
            return leftIndex === rightIndex
              ? left.path.localeCompare(right.path)
              : leftIndex
                ? -1
                : 1;
          }),
      },
    });
  }

  return cases;
}

export async function assertCorpusFiles(corpus: readonly CorpusCase[]): Promise<void> {
  for (const corpusCase of corpus) {
    const referenced = new Set<string>(["case.json", corpusCase.input]);
    if (corpusCase.expected.kind === "success") {
      corpusCase.expected.artifacts.forEach((artifact) => referenced.add(artifact.file));
      corpusCase.expected.instances.forEach((instance) => referenced.add(instance.file));
    }

    await Promise.all([...referenced].map((file) => access(caseFileUrl(corpusCase, file))));
    const orphaned = (await filesUnder(new URL(`${corpusCase.id}/`, CASES_ROOT))).filter(
      (file) => !referenced.has(file),
    );
    if (orphaned.length > 0) {
      throw new TypeError(
        `Orphan files in corpus case "${corpusCase.id}": ${orphaned.join(", ")}.`,
      );
    }
  }
}
