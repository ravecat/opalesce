import {
  ArtifactError,
  parseAsyncAPI,
  PluginExecutionError,
  run,
  type Input,
} from "@opalesce/core";
import { describe, expect, it } from "vitest";
import { JsonSchemaGenerationError } from "../src/errors.js";
import jsonSchema from "../src/index.js";

const input = {
  asyncapi: "3.1.0",
  info: {
    title: "JSON Schema plugin",
    version: "1.0.0",
  },
  components: {
    schemas: {
      Event: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
  },
} satisfies Input;

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

function pluginCause(error: unknown): unknown {
  expect(error).toBeInstanceOf(PluginExecutionError);
  if (!(error instanceof PluginExecutionError)) {
    throw new Error("Expected PluginExecutionError.");
  }
  expect(error.pluginName).toBe("json-schema");
  return error.cause;
}

describe("jsonSchema", () => {
  it("generates one index and one standalone component with default options", async () => {
    const result = await run({ input, plugins: [jsonSchema()] });

    expect(result.pluginNames).toEqual(["json-schema"]);
    expect(result.artifacts.map(({ path }) => path)).toEqual([
      "schemas/index.schema.json",
      "schemas/Event.schema.json",
    ]);
    expect(JSON.parse(result.artifacts[0]?.contents ?? "")).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      definitions: { Event: { $ref: "./Event.schema.json" } },
    });
    expect(JSON.parse(result.artifacts[1]?.contents ?? "")).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      properties: { id: { type: "string" } },
      required: ["id"],
      type: "object",
    });
    expect(result.artifacts.every(({ contents }) => contents.endsWith("\n"))).toBe(true);
  });

  it("uses the configured output directory", async () => {
    const result = await run({
      input,
      plugins: [jsonSchema({ outputPath: "contracts/schemas" })],
    });

    expect(result.artifacts.map(({ path }) => path)).toEqual([
      "contracts/schemas/index.schema.json",
      "contracts/schemas/Event.schema.json",
    ]);
    expect(JSON.parse(result.artifacts[1]?.contents ?? "")).not.toHaveProperty("$id");
  });

  it("preserves internal generation failures as the Core plugin cause", async () => {
    const parsed = await parseAsyncAPI(input);
    const error = await rejectionOf(run({ input: parsed.document, plugins: [jsonSchema()] }));
    const cause = pluginCause(error);

    expect(cause).toBeInstanceOf(JsonSchemaGenerationError);
    if (!(cause instanceof JsonSchemaGenerationError)) {
      throw new Error("Expected JsonSchemaGenerationError.");
    }
    expect(cause.code).toBe("SOURCE_UNAVAILABLE");
    expect(cause.sourcePointer).toBe("");
  });

  it("returns no artifact when resource validation fails", async () => {
    const error = await rejectionOf(
      run({
        input: {
          ...input,
          components: {
            schemas: {
              Event: { $id: "event.json", type: "string" },
            },
          },
        },
        plugins: [jsonSchema()],
      }),
    );
    const cause = pluginCause(error);

    expect(cause).toBeInstanceOf(JsonSchemaGenerationError);
    if (!(cause instanceof JsonSchemaGenerationError)) {
      throw new Error("Expected JsonSchemaGenerationError.");
    }
    expect(cause.code).toBe("INVALID_SCHEMA_ID");
  });

  it("leaves configured output path enforcement to Core", async () => {
    const error = await rejectionOf(
      run({ input, plugins: [jsonSchema({ outputPath: "../schemas" })] }),
    );
    const cause = pluginCause(error);

    expect(cause).toBeInstanceOf(ArtifactError);
  });
});
