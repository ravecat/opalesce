import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { run, type Input } from "@opalesce/core";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import typescript from "../src/index.js";

const input = {
  asyncapi: "3.0.0",
  info: { title: "Conformance", version: "1.0.0" },
  channels: {
    events: {
      address: "events",
      messages: { created: { $ref: "#/components/messages/EventCreated" } },
    },
  },
  operations: {
    sendEvent: { action: "send", channel: { $ref: "#/channels/events" } },
  },
  components: {
    messages: {
      EventCreated: { payload: { $ref: "#/components/schemas/Event" } },
    },
    schemas: {
      Event: {
        type: "object",
        required: ["id"],
        additionalProperties: false,
        properties: {
          id: { type: "string", readOnly: true },
          state: { enum: ["created", "processed"] },
          note: { type: ["string", "null"] },
        },
      },
    },
  },
} satisfies Input;

describe("TypeScript conformance", () => {
  it("compiles generated ESM types and representative assignments under strict NodeNext", async () => {
    const result = await run({ input, plugins: [typescript()] });
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "opalesce-typescript-"));

    try {
      for (const artifact of result.artifacts) {
        const path = join(temporaryDirectory, artifact.path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, artifact.contents, "utf8");
      }
      await writeFile(
        join(temporaryDirectory, "package.json"),
        JSON.stringify({ type: "module" }),
        "utf8",
      );
      const consumerPath = join(temporaryDirectory, "consumer.ts");
      await writeFile(
        consumerPath,
        [
          'import type { Event, EventCreatedMessage, SendEventMessage } from "./types/index.js";',
          'const event: Event = { id: "1", state: "created", note: null };',
          "const message: EventCreatedMessage = { payload: event };",
          "const operation: SendEventMessage = message;",
          "void operation;",
          "// @ts-expect-error id is required",
          'const missing: Event = { state: "created" };',
          "// @ts-expect-error enum member is invalid",
          'const invalid: Event = { id: "1", state: "invalid" };',
          "void missing;",
          "void invalid;",
          "",
        ].join("\n"),
        "utf8",
      );

      const rootNames = [
        consumerPath,
        ...result.artifacts.map((artifact) => join(temporaryDirectory, artifact.path)),
      ];
      const program = ts.createProgram({
        rootNames,
        options: {
          exactOptionalPropertyTypes: true,
          isolatedModules: true,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          noEmit: true,
          noUncheckedIndexedAccess: true,
          strict: true,
          target: ts.ScriptTarget.ES2022,
        },
      });
      const diagnostics = ts.getPreEmitDiagnostics(program);

      expect(
        diagnostics.map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        ),
      ).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
