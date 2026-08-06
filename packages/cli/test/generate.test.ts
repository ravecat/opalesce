import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../src/generate.js";

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

async function writeConfig(directory: string, input: string): Promise<string> {
  const configPath = join(directory, "opalesce.config.mjs");
  await writeFile(
    configPath,
    `export default {
  input: ${JSON.stringify(input)},
  output: { path: "./generated", clean: true },
  plugins: [{
    name: "fixture",
    generate(context) {
      return [{
        path: "metadata/version.txt",
        contents: \`\${context.document.version()}\\n\`,
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
    ).resolves.toBe("3.1.0\n");
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
