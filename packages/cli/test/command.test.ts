import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, type CommandIO } from "../src/command.js";

const VALID_ASYNCAPI = `asyncapi: 3.1.0
info:
  title: Command fixture
  version: 1.0.0
`;

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opalesce-cli-command-"));
  temporaryDirectories.push(directory);
  return directory;
}

function captureIO(): {
  readonly io: CommandIO;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout: {
        write(text) {
          stdout.push(text);
        },
      },
      stderr: {
        write(text) {
          stderr.push(text);
        },
      },
    },
    stdout,
    stderr,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runCli", () => {
  it.each([
    { arguments_: ["--help"], expected: "Usage: opalesce <command>" },
    {
      arguments_: ["generate", "--help"],
      expected: "Usage: opalesce generate [input]",
    },
  ])("prints help with exit code 0", async ({ arguments_, expected }) => {
    const capture = captureIO();

    await expect(runCli(arguments_, { io: capture.io })).resolves.toBe(0);
    expect(capture.stdout.join("")).toContain(expected);
    expect(capture.stderr).toEqual([]);
  });

  it.each([
    { arguments_: [], expected: "Missing command" },
    { arguments_: ["unknown"], expected: 'Unknown command "unknown"' },
    {
      arguments_: ["generate", "--unsupported"],
      expected: "Unknown option",
    },
  ])("returns exit code 2 for invalid usage", async ({ arguments_, expected }) => {
    const capture = captureIO();

    await expect(runCli(arguments_, { io: capture.io })).resolves.toBe(2);
    expect(capture.stderr.join("")).toContain(expected);
  });

  it("returns exit code 1 for an operational failure without a stack trace", async () => {
    const directory = await temporaryDirectory();
    const capture = captureIO();

    await expect(runCli(["generate"], { cwd: directory, io: capture.io })).resolves.toBe(1);
    expect(capture.stderr.join("")).toContain("config not found");
    expect(capture.stderr.join("")).not.toContain("\n    at ");
  });

  it("applies cwd-relative input and output overrides", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, "custom.config.ts");
    await writeFile(join(directory, "override.yaml"), VALID_ASYNCAPI);
    await writeFile(
      configPath,
      `export default {
  input: "./unused.yaml",
  output: { path: "./unused-output" },
  plugins: [{
    name: "command-fixture",
    build(context) {
      context.emit({ path: "value.txt", contents: "generated\\n" });
    },
  }],
};
`,
    );
    const capture = captureIO();

    await expect(
      runCli(
        [
          "generate",
          "./override.yaml",
          "--config",
          "./custom.config.ts",
          "--out",
          "./override-output",
        ],
        { cwd: directory, io: capture.io },
      ),
    ).resolves.toBe(0);

    await expect(readFile(join(directory, "override-output", "value.txt"), "utf8")).resolves.toBe(
      "generated\n",
    );
    expect(capture.stdout.join("")).toContain(
      `Generated 1 artifact -> ${join(directory, "override-output")}`,
    );
  });
});
