import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { OutputError, writeArtifacts } from "../src/output.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opalesce-cli-output-"));
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

describe("writeArtifacts", () => {
  it("writes nested UTF-8 artifacts and preserves unrelated files by default", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "generated");
    await mkdir(outputPath);
    await writeFile(join(outputPath, "keep.txt"), "keep\n");

    await writeArtifacts({
      artifacts: [
        {
          path: "nested/value.txt",
          contents: "zażółć\n",
        },
      ],
      outputPath,
      configDir: directory,
      cwd: directory,
      clean: false,
    });

    await expect(readFile(join(outputPath, "nested", "value.txt"), "utf8")).resolves.toBe(
      "zażółć\n",
    );
    await expect(readFile(join(outputPath, "keep.txt"), "utf8")).resolves.toBe("keep\n");
  });

  it("cleans a dedicated descendant output directory", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "generated");
    await mkdir(outputPath);
    await writeFile(join(outputPath, "stale.txt"), "stale\n");

    await writeArtifacts({
      artifacts: [{ path: "fresh.txt", contents: "fresh\n" }],
      outputPath,
      configDir: directory,
      cwd: directory,
      clean: true,
    });

    await expect(access(join(outputPath, "stale.txt"))).rejects.toThrow();
    await expect(readFile(join(outputPath, "fresh.txt"), "utf8")).resolves.toBe("fresh\n");
  });

  it.each(["config", "outside", "cwd"])("rejects an unsafe %s cleanup target", async (kind) => {
    const directory = await temporaryDirectory();
    const nestedCwd = join(directory, "packages", "consumer");
    await mkdir(nestedCwd, { recursive: true });
    const outputPath =
      kind === "config"
        ? directory
        : kind === "outside"
          ? join(directory, "..", "outside")
          : nestedCwd;

    await expect(
      writeArtifacts({
        artifacts: [],
        outputPath,
        configDir: directory,
        cwd: nestedCwd,
        clean: true,
      }),
    ).rejects.toBeInstanceOf(OutputError);
  });

  it("rejects an artifact that escapes the output directory before cleanup", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "generated");
    const sentinel = join(outputPath, "sentinel.txt");
    await mkdir(outputPath);
    await writeFile(sentinel, "preserved\n");

    await expect(
      writeArtifacts({
        artifacts: [{ path: "../escaped.txt", contents: "escape\n" }],
        outputPath,
        configDir: directory,
        cwd: directory,
        clean: true,
      }),
    ).rejects.toBeInstanceOf(OutputError);

    await expect(readFile(sentinel, "utf8")).resolves.toBe("preserved\n");
    await expect(access(join(directory, "escaped.txt"))).rejects.toThrow();
  });

  it("rejects filesystem root cleanup", async () => {
    const directory = await temporaryDirectory();

    await expect(
      writeArtifacts({
        artifacts: [],
        outputPath: parse(directory).root,
        configDir: directory,
        cwd: directory,
        clean: true,
      }),
    ).rejects.toBeInstanceOf(OutputError);
  });
});
