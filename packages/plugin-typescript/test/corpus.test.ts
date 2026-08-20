import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PluginExecutionError, run } from "@opalesce/core";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import typescript, { TypeScriptGenerationError } from "../src/index.js";
import { assertCorpusFiles, caseFileUrl, loadCorpus } from "./corpus.js";

const corpus = await loadCorpus();

async function compileArtifacts(
  id: string,
  artifacts: readonly { readonly path: string; readonly contents: string }[],
): Promise<readonly string[]> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), `opalesce-typescript-${id}-`));
  try {
    const rootNames: string[] = [];
    for (const artifact of artifacts) {
      const path = join(temporaryDirectory, artifact.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, artifact.contents, "utf8");
      rootNames.push(path);
    }
    await writeFile(
      join(temporaryDirectory, "package.json"),
      JSON.stringify({ type: "module" }),
      "utf8",
    );
    const program = ts.createProgram({
      rootNames,
      options: {
        exactOptionalPropertyTypes: true,
        isolatedModules: true,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        noEmit: true,
        noUncheckedIndexedAccess: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
      },
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

describe("TypeScript output conformance corpus", () => {
  it("is case-local, complete, and covers every supported version", async () => {
    await expect(assertCorpusFiles(corpus)).resolves.toBeUndefined();
    expect(new Set(corpus.map((corpusCase) => corpusCase.version))).toEqual(
      new Set(["2.6.0", "3.0.0", "3.1.0"]),
    );
    const tags = new Set(corpus.flatMap((corpusCase) => corpusCase.tags));
    for (const required of [
      "additional-properties",
      "access-annotations",
      "collision",
      "composition",
      "headers",
      "inline-message",
      "jsdoc-escaping",
      "literals",
      "mutual-recursive",
      "nullability",
      "operation",
      "parameters",
      "references",
      "reply",
      "self-recursive",
      "unsafe-key",
      "unsupported-format",
      "unsupported-reference",
      "unrepresentable-root",
      "unused-schema",
    ]) {
      expect(tags.has(required), `missing corpus tag: ${required}`).toBe(true);
    }
  });

  it.each(corpus)("conforms: $id", async (corpusCase) => {
    const input = await readFile(caseFileUrl(corpusCase, corpusCase.input), "utf8");
    const generate = () =>
      run({
        input,
        parser: {
          parse: { source: caseFileUrl(corpusCase, corpusCase.input).href },
          ...(corpusCase.schemaParser === undefined
            ? {}
            : {
                parser: {
                  schemaParsers: [
                    corpusCase.schemaParser === "avro"
                      ? {
                          getMimeTypes() {
                            return ["application/vnd.apache.avro+json;version=1.11.0"];
                          },
                          validate() {},
                          parse() {
                            return { type: "object" };
                          },
                        }
                      : {
                          getMimeTypes() {
                            return ["application/schema+json;version=draft-07"];
                          },
                          validate() {},
                          parse() {
                            return { $ref: "https://example.com/Event.schema.json" };
                          },
                        },
                  ],
                },
              }),
        },
        plugins: [typescript()],
      });

    if (corpusCase.expected.kind === "error") {
      const reject = async (): Promise<TypeScriptGenerationError> => {
        const rejection = await generate().catch((error: unknown) => error);
        expect(rejection).toBeInstanceOf(PluginExecutionError);
        if (!(rejection instanceof PluginExecutionError)) {
          throw new Error(`Corpus case ${corpusCase.id} did not fail in the plugin pipeline.`);
        }
        expect(rejection.pluginName).toBe("typescript");
        expect(rejection.cause).toBeInstanceOf(TypeScriptGenerationError);
        if (!(rejection.cause instanceof TypeScriptGenerationError)) {
          throw new Error(`Corpus case ${corpusCase.id} did not expose a generation error.`);
        }
        return rejection.cause;
      };
      const first = await reject();
      const second = await reject();
      expect(first).toMatchObject({
        code: corpusCase.expected.code,
        pointer: corpusCase.expected.pointer,
      });
      expect({ code: second.code, pointer: second.pointer, details: second.details }).toEqual({
        code: first.code,
        pointer: first.pointer,
        details: first.details,
      });
      return;
    }

    const first = await generate();
    const second = await generate();
    const expected = await Promise.all(
      corpusCase.expected.artifacts.map(async (artifact) => ({
        path: artifact.path,
        contents: await readFile(caseFileUrl(corpusCase, artifact.file), "utf8"),
      })),
    );

    expect(first.document.version()).toBe(corpusCase.version);
    expect(first.artifacts).toEqual(expected);
    expect(second.artifacts).toEqual(first.artifacts);
    await expect(compileArtifacts(corpusCase.id, first.artifacts)).resolves.toEqual([]);
  });
});
