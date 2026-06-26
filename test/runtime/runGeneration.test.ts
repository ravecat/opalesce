import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runGeneration } from "~/runtime/runGeneration";
import type { PluginInstance } from "~/types";

describe("runGeneration", () => {
  test("returns artifacts without writing files", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const plugins: PluginInstance[] = [
      {
        name: "fixture",
        options: {},
        install() {
          this.addArtifact({
            kind: "types",
            filePath: "types/UserCreatedPayload.ts",
            code: "export type UserCreatedPayload = { id: string };\n",
            export: {
              name: "UserCreatedPayload",
              kind: "type",
            },
          });
        },
      },
    ];

    try {
      const result = await runGeneration({
        cwd: process.cwd(),
        config: {
          input: { path: "./test/fixtures/smoke/basic.asyncapi.yaml" },
          output: { path: outDir },
          plugins,
        },
      });

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0]?.filePath).toBe("types/UserCreatedPayload.ts");
      expect(existsSync(join(outDir, "types/UserCreatedPayload.ts"))).toBe(false);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
