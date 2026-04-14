import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generate } from "~/generate";

describe("generate", () => {
  test("writes to the overridden output directory", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const configPath = join(workspace, "asyncapi.config.mjs");
    const outDir = join(workspace, "overridden-output");

    try {
      await writeFile(
        configPath,
        `export default {
  input: { path: "./test/fixtures/smoke/basic.asyncapi.yaml" },
  output: { path: "./generated" },
  plugins: [],
};
`,
      );

      const result = await generate({
        cwd: process.cwd(),
        config: configPath,
        out: outDir,
      });

      expect(result.total).toBe(0);
      expect(result.artifacts).toEqual([]);
      expect(result.outDir).toBe(outDir);
      await expect(
        readFile(join(outDir, "index.ts"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
