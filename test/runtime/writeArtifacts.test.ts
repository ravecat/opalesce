import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { writeArtifacts } from "~/runtime/writeArtifacts";

describe("writeArtifacts", () => {
  test("writes files and barrel exports deterministically", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));

    try {
      await writeArtifacts({
        cwd: process.cwd(),
        outDir,
        artifacts: [
          {
            kind: "types",
            filePath: "types/UserCreatedPayload.ts",
            code: "export type UserCreatedPayload = { id: string };\n",
            export: {
              name: "UserCreatedPayload",
              kind: "type",
            },
          },
        ],
      });

      await expect(
        readFile(join(outDir, "types/UserCreatedPayload.ts"), "utf8"),
      ).resolves.toContain("UserCreatedPayload");
      await expect(
        readFile(join(outDir, "types/index.ts"), "utf8"),
      ).resolves.toContain(
        'export type { UserCreatedPayload } from "./UserCreatedPayload.js";',
      );
      await expect(
        readFile(join(outDir, "index.ts"), "utf8"),
      ).resolves.toContain('export * from "./types/index.js";');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
