import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { writeArtifacts } from "~/runtime/writeArtifacts";

const GENERATED_GITATTRIBUTES =
  "* linguist-generated=true\n**/* linguist-generated=true\n";

describe("writeArtifacts", () => {
  test("writes files, barrel exports, and repository metadata deterministically", async () => {
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
      await expect(
        readFile(join(outDir, ".gitattributes"), "utf8"),
      ).resolves.toBe(GENERATED_GITATTRIBUTES);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  test("skips repository metadata when there are no generated files", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));

    try {
      await writeArtifacts({
        cwd: process.cwd(),
        outDir,
        artifacts: [],
      });

      await expect(
        readFile(join(outDir, ".gitattributes"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
