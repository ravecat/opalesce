import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import type { ParseAsyncAPIOptions } from "@opalesce/core";
import { afterEach, describe, expect, it } from "vitest";
import { generate, parserOptionsForInput } from "../src/generate.js";

const VALID_ASYNCAPI = `asyncapi: 3.1.0
info:
  title: CLI fixture
  version: 1.0.0
`;

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opalesce-cli-generate-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function writeConfig(directory: string, input: string, source?: string): Promise<string> {
  const configPath = join(directory, "opalesce.config.mjs");
  await writeFile(
    configPath,
    `export default {
  input: ${JSON.stringify(input)},
  output: { path: "./generated", clean: true },
  ${source === undefined ? "" : `parser: { parse: { source: ${JSON.stringify(source)} } },`}
  plugins: [{
    name: "fixture",
    generate(context) {
      return [{
        path: "metadata/version.txt",
        contents: \`\${context.document.version()}\\n\${context.source?.uri ?? "<none>"}\\n\`,
      }];
    },
  }],
};
`,
  );
  return configPath;
}

describe("generate", () => {
  it("reads input, runs the pipeline once, and persists exact artifacts", async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, "asyncapi.yaml"), VALID_ASYNCAPI);
    await writeConfig(directory, "./asyncapi.yaml");

    const result = await generate({ cwd: directory });

    expect(result.artifactCount).toBe(1);
    expect(result.outputPath).toBe(join(directory, "generated"));
    await expect(
      readFile(join(directory, "generated", "metadata", "version.txt"), "utf8"),
    ).resolves.toBe(`3.1.0\n${pathToFileURL(join(directory, "asyncapi.yaml")).href}\n`);
  });

  it("keeps an explicitly configured parser source authoritative", async () => {
    const directory = await temporaryDirectory();
    const configuredSource = "memory://contracts/asyncapi.yaml";
    await writeFile(join(directory, "asyncapi.yaml"), VALID_ASYNCAPI);
    await writeConfig(directory, "./asyncapi.yaml", configuredSource);

    await generate({ cwd: directory });

    await expect(
      readFile(join(directory, "generated", "metadata", "version.txt"), "utf8"),
    ).resolves.toBe(`3.1.0\n${configuredSource}\n`);
  });

  it("leaves existing output untouched when input reading fails", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "generated");
    const sentinel = join(outputPath, "sentinel.txt");
    await mkdir(outputPath);
    await writeFile(sentinel, "preserved\n");
    await writeConfig(directory, "./missing.yaml");

    await expect(generate({ cwd: directory })).rejects.toThrow();

    await expect(readFile(sentinel, "utf8")).resolves.toBe("preserved\n");
  });

  it("leaves existing output untouched when the pipeline fails", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "generated");
    const sentinel = join(outputPath, "sentinel.txt");
    await mkdir(outputPath);
    await writeFile(sentinel, "preserved\n");
    await writeFile(join(directory, "asyncapi.yaml"), "not an asyncapi document\n");
    await writeConfig(directory, "./asyncapi.yaml");

    await expect(generate({ cwd: directory })).rejects.toThrow();

    await expect(readFile(sentinel, "utf8")).resolves.toBe("preserved\n");
    await expect(access(join(outputPath, "metadata", "version.txt"))).rejects.toThrow();
  });
});

describe("parserOptionsForInput", () => {
  it("preserves parser and parse options while deriving the file URL", () => {
    const configured = {
      parser: {
        schemaParsers: [],
      },
      parse: {
        applyTraits: false,
        parseSchemas: false,
      },
    } satisfies ParseAsyncAPIOptions;
    const inputPath = "/workspace/specs/asyncapi.yaml";

    const result = parserOptionsForInput(configured, inputPath);

    expect(result.parser).toBe(configured.parser);
    expect(result.parse).toEqual({
      applyTraits: false,
      parseSchemas: false,
      source: pathToFileURL(inputPath).href,
    });
  });

  it("does not replace an explicit source", () => {
    const configured = {
      parse: {
        source: "memory://configured/asyncapi.yaml",
      },
    } satisfies ParseAsyncAPIOptions;

    expect(parserOptionsForInput(configured, "/ignored.yaml").parse?.source).toBe(
      configured.parse.source,
    );
  });
});
