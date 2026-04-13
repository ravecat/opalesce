import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { generate } from "../../dist/generate.js";
import { createTempConfig } from "../support/createTempConfig";
import { matchGeneratedFiles } from "../support/matchGeneratedFiles";

const repoRoot = resolve(import.meta.dirname, "../..");
const moduleUrl = new URL("../../dist/index.js", import.meta.url).href;

const sharedPluginsSource = `[
  asyncapi({ output: { path: "schemas" } }),
  typescript({
    output: { path: "types" },
    include: [
      "component-schema",
      "message-payload",
      "reply-payload",
      "channel-parameter",
    ],
  }),
  zod({
    output: { path: "zod" },
    include: [
      "component-schema",
      "message-payload",
      "reply-payload",
      "channel-parameter",
    ],
  }),
]`;

const graphOnlyPluginsSource = `[
  asyncapi({ output: false }),
  typescript({
    output: { path: "types" },
    include: [
      "component-schema",
      "message-payload",
      "reply-payload",
      "channel-parameter",
    ],
  }),
  zod({
    output: { path: "zod" },
    include: [
      "component-schema",
      "message-payload",
      "reply-payload",
      "channel-parameter",
    ],
  }),
]`;

const cases = [
  {
    name: "basic-smoke",
    input: "./test/fixtures/smoke/basic.asyncapi.yaml",
    pluginsSource: sharedPluginsSource,
    expectTotalMin: 8,
  },
  {
    name: "reply-payload",
    input: "./test/fixtures/regressions/reply-payload.asyncapi.yaml",
    pluginsSource: `[
  asyncapi({ output: false }),
  typescript({
    output: { path: "types" },
    include: ["message-payload", "reply-payload"],
  }),
  zod({
    output: { path: "zod" },
    include: ["message-payload", "reply-payload"],
  }),
]`,
    expectTotalMin: 4,
  },
  {
    name: "channel-parameter",
    input: "./test/fixtures/regressions/channel-parameter.asyncapi.yaml",
    pluginsSource: `[
  asyncapi({ output: false }),
  typescript({
    output: { path: "types" },
    include: ["channel-parameter"],
  }),
  zod({
    output: { path: "zod" },
    include: ["channel-parameter"],
  }),
]`,
    expectTotalMin: 2,
  },
];

describe("generate smoke", () => {
  test.each(cases)("matches generated files for $name", async (scenario) => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const outDir = join(workspace, "generated");

    try {
      const configPath = createTempConfig({
        workspace,
        moduleUrl,
        inputPath: scenario.input,
        outputPath: "generated",
        pluginsSource: scenario.pluginsSource,
      });

      const result = await generate({
        cwd: repoRoot,
        config: configPath,
        out: outDir,
      });

      expect(result.total).toBeGreaterThanOrEqual(scenario.expectTotalMin);
      await matchGeneratedFiles({
        rootDir: outDir,
        snapshotPrefix: ["generate", scenario.name],
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("generates artifacts for the anonymized realtime room fixture", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
    const outDir = join(workspace, "generated");

    try {
      const configPath = createTempConfig({
        workspace,
        moduleUrl,
        inputPath: "./test/fixtures/smoke/realtime-room.asyncapi.yaml",
        outputPath: "generated",
        pluginsSource: graphOnlyPluginsSource,
      });

      const result = await generate({
        cwd: repoRoot,
        config: configPath,
        out: outDir,
      });

      expect(result.diagnostics).toEqual([]);
      expect(result.total).toBe(82);
      const artifactPaths = result.artifacts.map(
        (artifact) => artifact.filePath,
      );
      expect(new Set(artifactPaths).size).toBe(result.total);
      expect(artifactPaths).toEqual(
        expect.arrayContaining([
          "types/Game.ts",
          "types/GameRoomRoomIdParameter.ts",
          "types/GetProviderInvalidCredentialsReplyPayload.ts",
          "types/JoinRoomReplyPayload.ts",
          "types/UpdateProviderPayloadPayload.ts",
          "types/UpdateProviderPayloadSchema.ts",
          "zod/GameSchema.ts",
          "zod/TurnSchema.ts",
          "zod/UpdateProviderPayloadPayloadSchema.ts",
          "zod/UpdateProviderPayloadSchemaSchema.ts",
        ]),
      );

      const rootIndex = await readFile(join(outDir, "index.ts"), "utf8");
      expect(rootIndex).toBe(
        'export * from "./types/index.js";\nexport * from "./zod/index.js";\n',
      );

      const providerReply = await readFile(
        join(outDir, "types/GetProviderInvalidCredentialsReplyPayload.ts"),
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

  test("input and out overrides replace scenario defaults", async () => {
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

      const configPath = createTempConfig({
        workspace,
        moduleUrl,
        inputPath: "./test/fixtures/smoke/basic.asyncapi.yaml",
        outputPath: "generated",
        pluginsSource: sharedPluginsSource,
      });

      const result = await generate({
        cwd: repoRoot,
        config: configPath,
        input: specPath,
        out: outDir,
      });

      expect(result.outDir).toBe(outDir);
      expect(
        result.artifacts.some(
          (artifact) => artifact.filePath === "types/UserId.ts",
        ),
      ).toBe(true);
      expect(
        result.artifacts.some(
          (artifact) => artifact.filePath === "zod/UserIdSchema.ts",
        ),
      ).toBe(true);
      expect(
        result.artifacts.some(
          (artifact) => artifact.filePath === "types/JoinRoomPayload.ts",
        ),
      ).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("empty plugins emit no artifacts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));

    try {
      const configPath = createTempConfig({
        workspace,
        moduleUrl,
        inputPath: "./test/fixtures/smoke/basic.asyncapi.yaml",
        outputPath: "generated",
        pluginsSource: "[]",
      });

      const result = await generate({
        cwd: repoRoot,
        config: configPath,
      });

      expect(result.total).toBe(0);
      expect(result.artifacts).toEqual([]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
