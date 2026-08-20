import { PluginExecutionError, run, type Input } from "@opalesce/core";
import { describe, expect, it } from "vitest";
import typescript, { TypeScriptGenerationError } from "../src/index.js";
import { renderFile } from "../src/render.js";

const completeInput = {
  asyncapi: "3.1.0",
  info: { title: "TypeScript plugin", version: "1.0.0" },
  channels: {
    users: {
      address: "users/{userId}",
      parameters: { userId: { location: "$message.payload#/id" } },
      messages: { created: { $ref: "#/components/messages/UserCreated" } },
    },
    replies: {
      address: "replies",
      messages: { accepted: { payload: { type: "boolean" } } },
    },
  },
  operations: {
    sendUser: {
      action: "send",
      channel: { $ref: "#/channels/users" },
      reply: { channel: { $ref: "#/channels/replies" } },
    },
  },
  components: {
    messages: {
      UserCreated: {
        name: "created",
        headers: {
          type: "object",
          required: ["trace-id"],
          properties: { "trace-id": { type: "string" } },
        },
        payload: { $ref: "#/components/schemas/User" },
      },
    },
    schemas: {
      Status: { enum: ["pending", "done"] },
      User: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          friend: { $ref: "#/components/schemas/User" },
        },
      },
    },
  },
} satisfies Input;

function pluginCause(error: unknown): unknown {
  expect(error).toBeInstanceOf(PluginExecutionError);
  if (!(error instanceof PluginExecutionError)) {
    throw new Error("Expected PluginExecutionError.");
  }
  expect(error.pluginName).toBe("typescript");
  return error.cause;
}

describe("typescript", () => {
  it("generates the complete interaction boundary with default options", async () => {
    const result = await run({ input: completeInput, plugins: [typescript()] });

    expect(result.pluginNames).toEqual(["typescript"]);
    expect(result.artifacts.map((artifact) => artifact.path)).toEqual([
      "types/index.ts",
      "types/channels/UsersParameters.ts",
      "types/messages/RepliesAccepted.ts",
      "types/messages/UserCreated.ts",
      "types/operations/SendUser.ts",
      "types/schemas/Status.ts",
      "types/schemas/User.ts",
    ]);
    expect(
      result.artifacts.find((artifact) => artifact.path.endsWith("/User.ts"))?.contents,
    ).toContain("friend?: User;");
    expect(
      result.artifacts.find((artifact) => artifact.path.endsWith("UserCreated.ts"))?.contents,
    ).toContain('"trace-id": string;');
    expect(
      result.artifacts.find((artifact) => artifact.path.endsWith("SendUser.ts"))?.contents,
    ).toContain("export type SendUserReplyMessage = RepliesAcceptedMessage;");
    expect(result.artifacts.every((artifact) => artifact.contents.endsWith("\n"))).toBe(true);
  });

  it("uses a custom output path and emits only a barrel for an empty interaction", async () => {
    const result = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Empty", version: "1.0.0" },
      },
      plugins: [typescript({ outputPath: "generated/contracts" })],
    });

    expect(result.artifacts).toEqual([{ path: "generated/contracts/index.ts", contents: "\n" }]);
  });

  it("emits unknown payloads and omits undeclared headers", async () => {
    const result = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Messages", version: "1.0.0" },
        channels: {
          events: {
            address: "events",
            messages: { ping: { name: "ping" } },
          },
        },
        operations: {
          receivePing: { action: "receive", channel: { $ref: "#/channels/events" } },
        },
      },
      plugins: [typescript()],
    });
    const message = result.artifacts.find((artifact) => artifact.path.includes("messages"));

    expect(message?.contents).toContain("Payload = unknown;");
    expect(message?.contents).not.toContain("Headers");
    expect(message?.contents).toContain("payload:");
  });

  it("supports Draft 07 boolean schemas", async () => {
    const result = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Boolean schemas", version: "1.0.0" },
        components: {
          schemas: {
            Allow: {
              schemaFormat: "application/schema+json;version=draft-07",
              schema: true,
            },
            Deny: {
              schemaFormat: "application/schema+json;version=draft-07",
              schema: false,
            },
          },
        },
      },
      plugins: [typescript()],
    });

    expect(
      result.artifacts.find((artifact) => artifact.path.endsWith("Allow.ts"))?.contents,
    ).toContain("Allow = unknown;");
    expect(
      result.artifacts.find((artifact) => artifact.path.endsWith("Deny.ts"))?.contents,
    ).toContain("Deny = never;");
  });

  it("normalizes AsyncAPI 2.6 operations", async () => {
    const result = await run({
      input: {
        asyncapi: "2.6.0",
        info: { title: "Legacy", version: "1.0.0" },
        channels: {
          users: {
            subscribe: {
              operationId: "receiveUser",
              message: { payload: { type: "string" } },
            },
          },
        },
      },
      plugins: [typescript()],
    });

    expect(result.artifacts.map((artifact) => artifact.path)).toContain(
      "types/operations/ReceiveUser.ts",
    );
    expect(
      result.artifacts.find((artifact) => artifact.path.endsWith("ReceiveUser.ts"))?.contents,
    ).toContain("export type ReceiveUserMessage");
  });

  it("rejects foreign schema formats atomically", async () => {
    const error = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Foreign", version: "1.0.0" },
        components: {
          schemas: {
            Event: {
              schemaFormat: "application/vnd.apache.avro+json;version=1.11.0",
              schema: { type: "record", name: "Event", fields: [] },
            },
          },
        },
      },
      parser: {
        parser: {
          schemaParsers: [
            {
              getMimeTypes() {
                return ["application/vnd.apache.avro+json;version=1.11.0"];
              },
              validate() {},
              parse() {
                return { type: "object" };
              },
            },
          ],
        },
      },
      plugins: [typescript()],
    }).catch((cause: unknown) => cause);
    const cause = pluginCause(error);

    expect(cause).toBeInstanceOf(TypeScriptGenerationError);
    expect(cause).toMatchObject({
      code: "TYPESCRIPT_FORMAT_UNSUPPORTED",
      pointer: "/components/schemas/Event",
    });
  });

  it("rejects normalized symbol and filename collisions", async () => {
    const error = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Collision", version: "1.0.0" },
        components: {
          schemas: {
            "foo-bar": { type: "string" },
            foo_bar: { type: "number" },
          },
        },
      },
      plugins: [typescript()],
    }).catch((cause: unknown) => cause);
    const cause = pluginCause(error);

    expect(cause).toBeInstanceOf(TypeScriptGenerationError);
    expect(cause).toMatchObject({ code: "TYPESCRIPT_FILENAME_COLLISION" });
  });

  it.each([
    ["case-folded", { User: { type: "string" }, user: { type: "number" } }],
    ["unicode-normalized", { "E\u0301vent": { type: "string" }, Évent: { type: "number" } }],
    ["portable-reserved", { con: { type: "string" } }],
  ])("rejects %s filenames", async (_name, schemas) => {
    const error = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Portable filenames", version: "1.0.0" },
        components: { schemas },
      },
      plugins: [typescript()],
    }).catch((cause: unknown) => cause);

    expect(pluginCause(error)).toMatchObject({ code: "TYPESCRIPT_FILENAME_COLLISION" });
  });

  it("scopes equal inline message names by channel ownership", async () => {
    const result = await run({
      input: {
        asyncapi: "3.1.0",
        info: { title: "Inline message ownership", version: "1.0.0" },
        channels: {
          audit: { address: "audit", messages: { event: { payload: { type: "string" } } } },
          events: { address: "events", messages: { event: { payload: { type: "number" } } } },
        },
      },
      plugins: [typescript()],
    });

    expect(result.artifacts.map((artifact) => artifact.path)).toEqual([
      "types/index.ts",
      "types/messages/AuditEvent.ts",
      "types/messages/EventsEvent.ts",
    ]);
  });

  it("is byte-identical across repeated runs", async () => {
    const first = await run({ input: completeInput, plugins: [typescript()] });
    const second = await run({ input: completeInput, plugins: [typescript()] });

    expect(second.artifacts).toEqual(first.artifacts);
  });

  it("rejects invalid rendered syntax before returning artifacts", () => {
    expect(() =>
      renderFile({
        path: "types/schemas/Broken.ts",
        imports: [],
        references: [],
        declarations: [
          {
            identity: "schema:broken",
            name: "broken-name",
            type: { kind: "string" },
            documentation: [],
          },
        ],
        exports: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "TYPESCRIPT_SYNTAX_INVALID",
        pointer: "types/schemas/Broken.ts",
      }),
    );
  });
});
