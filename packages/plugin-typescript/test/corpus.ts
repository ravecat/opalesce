import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TypeScriptGenerationErrorCode } from "../src/errors.js";

interface CorpusSuccessExpectation {
  readonly kind: "success";
  readonly artifacts: readonly { readonly file: string; readonly path: string }[];
}

interface CorpusErrorExpectation {
  readonly kind: "error";
  readonly code: TypeScriptGenerationErrorCode;
  readonly pointer: string;
}

export interface CorpusCase {
  readonly id: string;
  readonly input: string;
  readonly version: string;
  readonly tags: readonly string[];
  readonly schemaParser?: "avro" | "draft07-unchecked";
  readonly expected: CorpusErrorExpectation | CorpusSuccessExpectation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string, pointer: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${pointer}/${field} must be a non-empty string.`);
  }
  return value;
}

function relativeFile(record: Record<string, unknown>, field: string, pointer: string): string {
  const value = stringField(record, field, pointer);
  if (value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) {
    throw new TypeError(`${pointer}/${field} must be case-relative.`);
  }
  return value;
}

function errorCode(value: string, pointer: string): TypeScriptGenerationErrorCode {
  switch (value) {
    case "TYPESCRIPT_FILENAME_COLLISION":
    case "TYPESCRIPT_FORMAT_UNSUPPORTED":
    case "TYPESCRIPT_NAME_INVALID":
    case "TYPESCRIPT_SCHEMA_UNSUPPORTED":
    case "TYPESCRIPT_SYMBOL_COLLISION":
    case "TYPESCRIPT_SYNTAX_INVALID":
      return value;
    default:
      throw new TypeError(`${pointer} must be a known TypeScript generation error code.`);
  }
}

function expectation(
  value: unknown,
  pointer: string,
): CorpusErrorExpectation | CorpusSuccessExpectation {
  if (!isRecord(value)) {
    throw new TypeError(`${pointer} must contain an object.`);
  }
  const kind = stringField(value, "kind", pointer);
  if (kind === "success") {
    return { kind, artifacts: Object.freeze([]) };
  }
  if (kind === "error") {
    return {
      kind,
      code: errorCode(stringField(value, "code", pointer), `${pointer}/code`),
      pointer: stringField(value, "pointer", pointer),
    };
  }
  throw new TypeError(`${pointer}/kind must be "success" or "error".`);
}

function decodeCase(value: unknown, id: string): CorpusCase {
  const pointer = `${id}/case.json`;
  if (!isRecord(value)) {
    throw new TypeError(`${pointer} must contain an object.`);
  }
  if (
    value.schemaParser !== undefined &&
    value.schemaParser !== "avro" &&
    value.schemaParser !== "draft07-unchecked"
  ) {
    throw new TypeError(
      `${pointer}/schemaParser must be "avro" or "draft07-unchecked" when present.`,
    );
  }
  if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string")) {
    throw new TypeError(`${pointer}/tags must be an array of strings.`);
  }
  return {
    id,
    input: relativeFile(value, "input", pointer),
    version: stringField(value, "version", pointer),
    tags: Object.freeze([...value.tags]),
    ...(value.schemaParser === undefined ? {} : { schemaParser: value.schemaParser }),
    expected: expectation(value.expected, `${pointer}/expected`),
  };
}

async function filesUnder(root: URL, prefix = ""): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const relative = join(prefix, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(new URL(`${entry.name}/`, root), relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new TypeError(`Corpus contains a non-regular entry: ${relative}.`);
    }
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
      throw new TypeError(`Corpus cases must be directories: ${entry.name}.`);
    }
    const parsed: unknown = JSON.parse(
      await readFile(new URL(`${entry.name}/case.json`, CASES_ROOT), "utf8"),
    );
    const decoded = decodeCase(parsed, entry.name);
    if (decoded.expected.kind === "error") {
      cases.push(Object.freeze(decoded));
      continue;
    }
    const artifactPaths = [...(await filesUnder(new URL(`${entry.name}/expected/`, CASES_ROOT)))];
    artifactPaths.sort((left, right) => {
      if (left === "types/index.ts") return -1;
      if (right === "types/index.ts") return 1;
      return left.localeCompare(right);
    });
    const artifacts = artifactPaths.map((path) =>
      Object.freeze({ path, file: `expected/${path}` }),
    );
    if (artifacts.length === 0) {
      throw new TypeError(`Corpus case ${entry.name} has no expected artifacts.`);
    }
    cases.push(
      Object.freeze({
        ...decoded,
        expected: Object.freeze({ kind: "success", artifacts: Object.freeze(artifacts) }),
      }),
    );
  }
  return Object.freeze(cases);
}

export async function assertCorpusFiles(corpus: readonly CorpusCase[]): Promise<void> {
  for (const corpusCase of corpus) {
    const referenced = new Set([
      "case.json",
      corpusCase.input,
      ...(corpusCase.expected.kind === "success"
        ? corpusCase.expected.artifacts.map((artifact) => artifact.file)
        : []),
    ]);
    await Promise.all([...referenced].map((file) => access(caseFileUrl(corpusCase, file))));
    const orphaned = (await filesUnder(new URL(`${corpusCase.id}/`, CASES_ROOT))).filter(
      (file) => !referenced.has(file),
    );
    if (orphaned.length > 0) {
      throw new TypeError(`Orphan corpus files in ${corpusCase.id}: ${orphaned.join(", ")}.`);
    }
  }
}
