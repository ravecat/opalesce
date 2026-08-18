import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { run } from "@opalesce/cli";
import { describe, expect, it } from "vitest";

const FIXTURE_ROOT = fileURLToPath(new URL("./fixtures/config/", import.meta.url));

describe("JSON Schema consumer config", () => {
  it("loads the package plugin through the CLI and persists its exact artifact set", async () => {
    const outputPath = await mkdtemp(join(tmpdir(), "opalesce-plugin-json-schema-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    try {
      await expect(access(join(FIXTURE_ROOT, "generated"))).rejects.toThrow();
      await expect(
        run(["generate", "--out", outputPath], {
          cwd: FIXTURE_ROOT,
          io: {
            stdout: { write: (text) => stdout.push(text) },
            stderr: { write: (text) => stderr.push(text) },
          },
        }),
      ).resolves.toBe(0);

      for (const filename of ["index.schema.json", "Event.schema.json"]) {
        await expect(readFile(join(outputPath, "schemas", filename), "utf8")).resolves.toBe(
          await readFile(join(FIXTURE_ROOT, "expected", "schemas", filename), "utf8"),
        );
      }
      expect(stdout).toEqual([`Generated 2 artifacts -> ${outputPath}\n`]);
      expect(stderr).toEqual([]);
      await expect(access(join(FIXTURE_ROOT, "generated"))).rejects.toThrow();
    } finally {
      await rm(outputPath, { recursive: true, force: true });
    }
  });
});
