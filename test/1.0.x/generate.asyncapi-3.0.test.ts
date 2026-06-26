import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { asyncapi } from "~/plugins/asyncapi";
import { typescript } from "~/plugins/typescript";
import { zod } from "~/plugins/zod";
import { runGeneration } from "~/runtime/runGeneration";
import { writeArtifacts } from "~/runtime/writeArtifacts";
import type { PluginInstance } from "~/types";
import { createGenerationConfig, createSharedPlugins } from "../support/createGenerationConfig";
import { matchGeneratedFiles } from "../support/matchGeneratedFiles";

const repoRoot = resolve(import.meta.dirname, "../..");

function createReplyPayloadPlugins(): PluginInstance[] {
  return [
    asyncapi({ output: false }),
    typescript({
      output: { path: "types" },
      include: ["operations.messages.payloads", "operations.replies.payloads"],
    }),
    zod({
      output: { path: "zod" },
      include: ["operations.messages.payloads", "operations.replies.payloads"],
    }),
  ];
}

function createChannelParameterPlugins(): PluginInstance[] {
  return [
    asyncapi({ output: false }),
    typescript({
      output: { path: "types" },
      include: ["channels.parameters"],
    }),
    zod({
      output: { path: "zod" },
      include: ["channels.parameters"],
    }),
  ];
}

const cases = [
  {
    testName: "generates baseline artifacts for the smoke fixture",
    behavior: "smoke",
    caseId: "basic",
    input: "./test/fixtures/smoke/basic.asyncapi.yaml",
    createPlugins: createSharedPlugins,
    expectTotalMin: 8,
  },
  {
    testName: "generates reply payload artifacts from operation replies",
    behavior: "operations-replies-payloads",
    caseId: "reply-payload",
    input: "./test/fixtures/regressions/reply-payload.asyncapi.yaml",
    createPlugins: createReplyPayloadPlugins,
    expectTotalMin: 4,
  },
  {
    testName: "generates channel parameter artifacts from channel addresses",
    behavior: "channels-parameters",
    caseId: "channel-parameter",
    input: "./test/fixtures/regressions/channel-parameter.asyncapi.yaml",
    createPlugins: createChannelParameterPlugins,
    expectTotalMin: 2,
  },
];

describe("generate 1.0.x - AsyncAPI 3.0", () => {
  test.each(cases)("$testName", async (scenario) => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const outDir = join(workspace, "generated");

    try {
      const result = await runGeneration({
        cwd: repoRoot,
        config: createGenerationConfig({
          inputPath: scenario.input,
          outputPath: outDir,
          plugins: scenario.createPlugins(),
        }),
      });

      await writeArtifacts({
        cwd: result.cwd,
        outDir: result.config.output.path,
        artifacts: result.artifacts,
      });

      expect(result.artifacts.length).toBeGreaterThanOrEqual(scenario.expectTotalMin);
      await matchGeneratedFiles({
        rootDir: outDir,
        snapshotSegments: ["generate", scenario.behavior, scenario.caseId],
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("supports alternate specs in programmatic configs", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const specPath = join(workspace, "override.asyncapi.yaml");
    const outDir = join(workspace, "out");

    try {
      await writeFile(
        specPath,
        `asyncapi: 3.0.0
info:
  title: Override Spec
  version: 1.0.0
channels: {}
components:
  schemas:
    userId:
      type: string
`,
      );

      const result = await runGeneration({
        cwd: repoRoot,
        config: createGenerationConfig({
          inputPath: specPath,
          outputPath: outDir,
          plugins: createSharedPlugins(),
        }),
      });

      await writeArtifacts({
        cwd: result.cwd,
        outDir: result.config.output.path,
        artifacts: result.artifacts,
      });

      expect(result.artifacts.some((artifact) => artifact.filePath === "types/UserId.ts")).toBe(
        true,
      );
      expect(result.artifacts.some((artifact) => artifact.filePath === "zod/UserIdSchema.ts")).toBe(
        true,
      );
      expect(
        result.artifacts.some((artifact) => artifact.filePath === "types/JoinRoomPayload.ts"),
      ).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("empty plugins emit no artifacts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));

    try {
      const result = await runGeneration({
        cwd: repoRoot,
        config: createGenerationConfig({
          inputPath: "./test/fixtures/smoke/basic.asyncapi.yaml",
          outputPath: join(workspace, "generated"),
          plugins: [],
        }),
      });

      expect(result.artifacts).toEqual([]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
