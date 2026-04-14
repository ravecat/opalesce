import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig } from "~/config";

describe("loadConfig", () => {
  test("autoloads asyncapi.config.mjs from cwd", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));

    try {
      await writeFile(
        join(workspace, "asyncapi.config.mjs"),
        `export default {
  input: { path: "./spec.asyncapi.yaml" },
  output: { path: "./generated" },
};
`,
      );

      await expect(loadConfig({ cwd: workspace })).resolves.toEqual({
        input: { path: "./spec.asyncapi.yaml" },
        output: { path: "./generated" },
        plugins: [],
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("applies explicit input and out overrides", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const outDir = join(workspace, "override-output");

    try {
      const configPath = join(workspace, "custom.config.mjs");

      await writeFile(
        configPath,
        `export default {
  input: { path: "./test/fixtures/smoke/basic.asyncapi.yaml" },
  output: { path: "./generated" },
  plugins: [],
};
`,
      );

      await expect(
        loadConfig({
          cwd: process.cwd(),
          configPath,
          input: "./test/fixtures/regressions/reply-payload.asyncapi.yaml",
          out: outDir,
        }),
      ).resolves.toEqual({
        input: {
          path: "./test/fixtures/regressions/reply-payload.asyncapi.yaml",
        },
        output: { path: outDir },
        plugins: [],
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
