import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { runGeneration } from "~/runtime/runGeneration";
import { writeArtifacts } from "~/runtime/writeArtifacts";
import {
  createGenerationConfig,
  createGraphOnlyPlugins,
} from "../support/createGenerationConfig";

const repoRoot = resolve(import.meta.dirname, "../..");
const GENERATED_GITATTRIBUTES =
  "* linguist-generated=true\n**/* linguist-generated=true\n";

describe("generate 1.0.x - AsyncAPI 3.1", () => {
  test("generates artifacts for the anonymized realtime room fixture", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const outDir = join(workspace, "generated");

    try {
      const result = await runGeneration({
        cwd: repoRoot,
        config: createGenerationConfig({
          inputPath: "./test/fixtures/smoke/realtime-room.asyncapi.yaml",
          outputPath: outDir,
          plugins: createGraphOnlyPlugins(),
        }),
      });

      await writeArtifacts({
        cwd: result.cwd,
        outDir: result.config.output.path,
        artifacts: result.artifacts,
      });

      expect(result.diagnostics).toEqual([]);
      expect(result.artifacts).toHaveLength(40);
      const artifactPaths = result.artifacts.map(
        (artifact) => artifact.filePath,
      );
      expect(new Set(artifactPaths).size).toBe(result.artifacts.length);
      expect(artifactPaths).toEqual(
        expect.arrayContaining([
          "types/Game.ts",
          "types/RoomId.ts",
          "types/InvalidCredentialsReply.ts",
          "types/JoinReply.ts",
          "types/UpdateProviderPayload.ts",
          "zod/GameSchema.ts",
          "zod/TurnSchema.ts",
          "zod/RoomIdSchema.ts",
          "zod/InvalidCredentialsReplySchema.ts",
          "zod/UpdateProviderPayloadSchema.ts",
        ]),
      );
      expect(artifactPaths).not.toEqual(
        expect.arrayContaining([
          "types/GameRoomRoomIdParameter.ts",
          "types/GetProviderInvalidCredentialsReplyPayload.ts",
          "types/UpdateProviderPayloadPayload.ts",
          "zod/UpdateProviderPayloadPayloadSchema.ts",
          "zod/UpdateProviderPayloadSchemaSchema.ts",
        ]),
      );

      const gitAttributes = await readFile(
        join(outDir, ".gitattributes"),
        "utf8",
      );
      expect(gitAttributes).toBe(GENERATED_GITATTRIBUTES);

      const rootIndex = await readFile(join(outDir, "index.ts"), "utf8");
      expect(rootIndex).toBe(
        'export * from "./types/index.js";\nexport * from "./zod/index.js";\n',
      );

      const providerReply = await readFile(
        join(outDir, "types/InvalidCredentialsReply.ts"),
        "utf8",
      );
      expect(providerReply).toContain('"invalid_credentials"');

      const turnSchema = await readFile(
        join(outDir, "zod/TurnSchema.ts"),
        "utf8",
      );
      expect(turnSchema).toContain("deadline_at_ms");
      expect(turnSchema).toContain("winner_id");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
