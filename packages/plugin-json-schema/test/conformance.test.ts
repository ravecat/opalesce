import { readFile } from "node:fs/promises";
import type { JsonObject, JsonValue } from "@opalesce/core";
import { parseAsyncAPI, run } from "@opalesce/core";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { escapePointerToken } from "../src/bundle.js";
import { JsonSchemaGenerationError } from "../src/errors.js";
import jsonSchema from "../src/index.js";
import { assertCorpusFiles, caseFileUrl, loadCorpus, type CorpusCase } from "./corpus.js";

const REQUIRED_TAGS: readonly string[] = [
  "annotations",
  "boolean-false",
  "boolean-true",
  "dialect-conflict",
  "draft-07-wrapper",
  "duplicate-id",
  "empty-components",
  "extensions",
  "file-ref",
  "http-ref",
  "identifier-scoped-ref",
  "identifiers",
  "inline-payload",
  "invalid-json-schema",
  "local-ref",
  "missing-ref",
  "mutual-recursive",
  "native",
  "ordering",
  "out-of-scope-ref",
  "relative-id",
  "repeated-ref",
  "self-recursive",
  "source-unavailable",
  "unsupported-format",
  "unsupported-version",
  "unused-component",
  "version-2.6",
  "version-3.0",
  "version-3.1",
];

function jsonValue(value: unknown, pointer = ""): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item, index) => jsonValue(item, `${pointer}/${index}`)));
  }
  if (typeof value !== "object") {
    throw new TypeError(`Fixture value at "${pointer || "/"}" is not JSON-compatible.`);
  }

  const entries: Array<readonly [string, JsonValue]> = [];
  for (const [key, child] of Object.entries(value)) {
    entries.push([key, jsonValue(child, `${pointer}/${escapePointerToken(key)}`)]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonObject(value: unknown): JsonObject {
  const decoded = jsonValue(value);
  if (!isJsonObject(decoded)) {
    throw new TypeError("Expected a JSON object fixture root.");
  }
  return decoded;
}

async function pipelineArtifacts(corpusCase: CorpusCase) {
  const inputUrl = caseFileUrl(corpusCase, corpusCase.input);
  const result = await run({
    input: await readFile(inputUrl, "utf8"),
    parser: { parse: { source: inputUrl.href } },
    plugins: [jsonSchema()],
  });

  expect(result.document.version()).toBe(corpusCase.version);
  expect(result.pluginNames).toEqual(["json-schema"]);
  return result.artifacts;
}

async function expectInstances(corpusCase: CorpusCase, contents: string): Promise<void> {
  if (corpusCase.expected.kind !== "success") {
    return;
  }

  const schemaUri = `urn:opalesce:corpus:${corpusCase.id}`;
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  ajv.addSchema(jsonObject(JSON.parse(contents) as unknown), schemaUri);

  for (const expectation of corpusCase.expected.instances) {
    const validate = ajv.getSchema(
      `${schemaUri}#/definitions/${escapePointerToken(expectation.definition)}`,
    );
    if (validate === undefined) {
      throw new Error(
        `Corpus case "${corpusCase.id}" has no definition "${expectation.definition}".`,
      );
    }
    const instance: unknown = JSON.parse(
      await readFile(caseFileUrl(corpusCase, expectation.file), "utf8"),
    );
    expect(Boolean(validate(instance)), `${corpusCase.id}:${expectation.file}`).toBe(
      expectation.valid,
    );
  }
}

const corpus = await loadCorpus();
const discoveryDocument = await parseAsyncAPI({
  asyncapi: "3.1.0",
  info: { title: "Corpus discovery document", version: "1.0.0" },
});

describe("JSON Schema output conformance corpus", () => {
  it("is complete, case-local, and free of orphan fixture files", async () => {
    await expect(assertCorpusFiles(corpus)).resolves.toBeUndefined();

    const tags = new Set(corpus.flatMap((corpusCase) => corpusCase.tags));
    for (const tag of REQUIRED_TAGS) {
      expect(tags.has(tag), `missing corpus tag: ${tag}`).toBe(true);
    }
  });

  it("covers every supported AsyncAPI version", () => {
    expect(
      new Set(
        corpus
          .filter((corpusCase) => corpusCase.expected.kind === "success")
          .map((corpusCase) => corpusCase.version),
      ),
    ).toEqual(new Set(["2.6.0", "3.0.0", "3.1.0"]));
  });

  it("declares both outcomes for every root in reference-validation cases", () => {
    for (const corpusCase of corpus.filter(
      (item) =>
        item.tags.includes("local-ref") ||
        item.tags.includes("self-recursive") ||
        item.tags.includes("mutual-recursive"),
    )) {
      if (corpusCase.expected.kind !== "success") {
        throw new Error(`Reference case "${corpusCase.id}" must succeed.`);
      }
      const outcomes = new Map<string, Set<boolean>>();
      for (const instance of corpusCase.expected.instances) {
        const values = outcomes.get(instance.definition) ?? new Set<boolean>();
        values.add(instance.valid);
        outcomes.set(instance.definition, values);
      }
      for (const [definition, values] of outcomes) {
        expect(values, `${corpusCase.id}:${definition}`).toEqual(new Set([false, true]));
      }
    }
  });

  it.each(corpus)("conforms: $id", async (corpusCase) => {
    if (corpusCase.expected.kind === "error") {
      let rejection: unknown;
      try {
        if (corpusCase.sourceUnavailable) {
          await jsonSchema().generate(
            Object.freeze({
              document: discoveryDocument.document,
              diagnostics: discoveryDocument.diagnostics,
            }),
          );
        } else {
          const inputUrl = caseFileUrl(corpusCase, corpusCase.input);
          await jsonSchema().generate(
            Object.freeze({
              document: discoveryDocument.document,
              diagnostics: discoveryDocument.diagnostics,
              source: Object.freeze({
                data: jsonObject(JSON.parse(await readFile(inputUrl, "utf8")) as unknown),
                uri: inputUrl.href,
              }),
            }),
          );
        }
      } catch (error) {
        rejection = error;
      }

      expect(rejection).toBeInstanceOf(JsonSchemaGenerationError);
      if (!(rejection instanceof JsonSchemaGenerationError)) {
        throw new Error(`Corpus case "${corpusCase.id}" did not throw a generation error.`);
      }
      expect(rejection.code).toBe(corpusCase.expected.code);
      expect(rejection.sourcePointer).toBe(corpusCase.expected.sourcePointer);
      return;
    }

    const actualArtifacts = await pipelineArtifacts(corpusCase);
    const expectedArtifacts = await Promise.all(
      corpusCase.expected.artifacts.map(async (artifact) => ({
        path: artifact.path,
        contents: await readFile(caseFileUrl(corpusCase, artifact.file), "utf8"),
      })),
    );
    expect(actualArtifacts).toEqual(expectedArtifacts);
    expect(await pipelineArtifacts(corpusCase)).toEqual(actualArtifacts);

    const artifact = actualArtifacts.find(({ path }) => path === "schemas.json");
    if (artifact === undefined) {
      throw new Error(`Corpus case "${corpusCase.id}" returned no schemas.json artifact.`);
    }
    await expectInstances(corpusCase, artifact.contents);
  });
});
