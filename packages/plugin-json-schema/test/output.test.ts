import type { AsyncAPISource } from "@opalesce/core";
import { describe, expect, it } from "vitest";
import { buildOutput } from "../src/output.js";
import { JsonSchemaGenerationError } from "../src/errors.js";
import { stableJson } from "../src/serialize.js";
import { validateOutput } from "../src/validate.js";

function expectGenerationError(
  action: () => unknown,
  code: JsonSchemaGenerationError["code"],
  sourcePointer: string,
): JsonSchemaGenerationError {
  let rejection: unknown;
  try {
    action();
  } catch (error) {
    rejection = error;
  }

  expect(rejection).toBeInstanceOf(JsonSchemaGenerationError);
  if (!(rejection instanceof JsonSchemaGenerationError)) {
    throw new Error("Expected JsonSchemaGenerationError.");
  }
  expect(rejection.code).toBe(code);
  expect(rejection.sourcePointer).toBe(sourcePointer);
  return rejection;
}

function documents(source: AsyncAPISource): Record<string, unknown> {
  const output = buildOutput(source);
  return Object.fromEntries([
    ["index.schema.json", output.index],
    ...output.components.map((component) => [component.filename, component.document] as const),
  ]);
}

describe("buildOutput", () => {
  it("emits one index and exact boolean component resources", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Allow: true,
            Deny: {
              schemaFormat: "application/schema+json; version=draft-07",
              schema: false,
            },
          },
          messages: { Ignored: { payload: { type: "string" } } },
        },
      },
    } satisfies AsyncAPISource;

    expect(documents(source)).toEqual({
      "index.schema.json": {
        $schema: "http://json-schema.org/draft-07/schema#",
        definitions: {
          Allow: { $ref: "./Allow.schema.json" },
          Deny: { $ref: "./Deny.schema.json" },
        },
      },
      "Allow.schema.json": true,
      "Deny.schema.json": false,
    });
  });

  it("adds root dialects and rewrites local references with pointer suffixes", () => {
    const source = {
      data: {
        asyncapi: "3.0.0",
        components: {
          schemas: {
            Address: {
              type: "object",
              properties: { city: { type: "string" } },
            },
            User: {
              type: "object",
              properties: {
                address: { $ref: "#/components/schemas/Address" },
                city: { $ref: "#/components/schemas/Address/properties/city" },
              },
              "x-domain": "catalog",
              "x-parser-schema-id": "removed",
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    const output = buildOutput(source);

    expect(output.components.map(({ filename }) => filename)).toEqual([
      "Address.schema.json",
      "User.schema.json",
    ]);
    expect(documents(source)).toMatchObject({
      "Address.schema.json": {
        $schema: "http://json-schema.org/draft-07/schema#",
      },
      "User.schema.json": {
        $schema: "http://json-schema.org/draft-07/schema#",
        properties: {
          address: { $ref: "./Address.schema.json" },
          city: { $ref: "./Address.schema.json#/properties/city" },
        },
        "x-domain": "catalog",
      },
    });
    expect(output.components.map(({ document }) => stableJson(document)).join("\n")).not.toContain(
      "x-parser-",
    );
    expect(() => validateOutput(output)).not.toThrow();
  });

  it("preserves prototype-shaped schema keys as own JSON properties", () => {
    const propertyName = "__proto__";
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Event: {
              type: "object",
              properties: { [propertyName]: { type: "string" } },
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    const document = buildOutput(source).components[0]?.document;
    if (document === undefined) {
      throw new Error("Expected one component document.");
    }
    const serialized = stableJson(document);

    expect(serialized).toContain('"__proto__": {');
    expect(JSON.parse(serialized)).toMatchObject({
      properties: { [propertyName]: { type: "string" } },
    });
  });

  it("accepts URI references to authored resources in sibling artifacts", () => {
    const identifier = "https://schemas.example.test/target.json";
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Consumer: { $ref: identifier },
            Target: { $id: identifier, type: "string" },
          },
        },
      },
    } satisfies AsyncAPISource;

    const output = buildOutput(source);

    expect(documents(source)).toMatchObject({
      "Consumer.schema.json": { $ref: identifier },
      "Target.schema.json": { $id: identifier },
    });
    expect(() => validateOutput(output)).not.toThrow();
  });

  it("preserves fragment references scoped by an authored identifier", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Identifier: {
              $id: "https://schemas.example.test/identifier.json",
              $ref: "#/definitions/Value",
              definitions: { Value: { type: "string" } },
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    const output = buildOutput(source);

    expect(documents(source)).toMatchObject({
      "Identifier.schema.json": { $ref: "#/definitions/Value" },
    });
    expect(() => validateOutput(output)).not.toThrow();
  });

  it("preserves a matching root dialect and rejects every nested declaration", () => {
    const matching = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Event: {
              $schema: "https://json-schema.org/draft-07/schema#",
              type: "string",
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    expect(documents(matching)).toMatchObject({
      "Event.schema.json": { $schema: "https://json-schema.org/draft-07/schema#" },
    });

    const nested = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Event: {
              type: "object",
              properties: {
                nested: { $schema: "http://json-schema.org/draft-07/schema#" },
              },
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    expectGenerationError(
      () => buildOutput(nested),
      "DIALECT_CONFLICT",
      "/components/schemas/Event/properties/nested/$schema",
    );
  });

  it.each(["Tree/Node", "Tree\\Node", "bad:name", "trailing.", "trailing ", "CON", "nul.contract"])(
    "rejects non-portable component name %j",
    (name) => {
      const source = {
        data: {
          asyncapi: "3.1.0",
          components: { schemas: { [name]: { type: "string" } } },
        },
      } satisfies AsyncAPISource;

      expectGenerationError(
        () => buildOutput(source),
        "INVALID_COMPONENT_NAME",
        `/components/schemas/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      );
    },
  );

  it("rejects the reserved index name and case-insensitive collisions", () => {
    const reserved = {
      data: {
        asyncapi: "3.1.0",
        components: { schemas: { index: { type: "string" } } },
      },
    } satisfies AsyncAPISource;
    expectGenerationError(
      () => buildOutput(reserved),
      "COMPONENT_NAME_COLLISION",
      "/components/schemas/index",
    );

    const collision = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            User: { type: "string" },
            user: { type: "number" },
          },
        },
      },
    } satisfies AsyncAPISource;
    const error = expectGenerationError(
      () => buildOutput(collision),
      "COMPONENT_NAME_COLLISION",
      "/components/schemas/user",
    );
    expect(error.details).toMatchObject({
      firstSourcePointer: "/components/schemas/User",
      secondSourcePointer: "/components/schemas/user",
    });
  });

  const rejectionCases: readonly {
    readonly name: string;
    readonly source: AsyncAPISource;
    readonly code: JsonSchemaGenerationError["code"];
    readonly pointer: string;
  }[] = [
    {
      name: "unsupported version",
      source: { data: { asyncapi: "2.5.0" } },
      code: "UNSUPPORTED_ASYNCAPI_VERSION",
      pointer: "/asyncapi",
    },
    {
      name: "foreign schema format",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: {
              Event: { schemaFormat: "application/vnd.apache.avro+json", schema: {} },
            },
          },
        },
      },
      code: "UNSUPPORTED_SCHEMA_FORMAT",
      pointer: "/components/schemas/Event",
    },
    {
      name: "dialect conflict",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: { Event: { $schema: "https://json-schema.org/draft/2020-12/schema" } },
          },
        },
      },
      code: "DIALECT_CONFLICT",
      pointer: "/components/schemas/Event/$schema",
    },
    {
      name: "missing component",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: { schemas: { Event: { $ref: "#/components/schemas/Missing" } } },
        },
      },
      code: "UNRESOLVED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
    {
      name: "out-of-scope reference",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: { schemas: { Event: { $ref: "#/components/messages/Event/payload" } } },
        },
      },
      code: "UNSUPPORTED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
    {
      name: "external reference",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: { schemas: { Event: { $ref: "https://example.test/event.json" } } },
        },
      },
      code: "UNSUPPORTED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
    {
      name: "relative identifier",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: { schemas: { Event: { $id: "event.json" } } },
        },
      },
      code: "INVALID_SCHEMA_ID",
      pointer: "/components/schemas/Event/$id",
    },
    {
      name: "identifier-scoped reference",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: {
              Event: {
                $id: "https://schemas.example.test/event.json",
                $ref: "#/components/schemas/Event",
              },
            },
          },
        },
      },
      code: "UNSUPPORTED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
  ];

  it.each(rejectionCases)("rejects $name", ({ source, code, pointer }) => {
    expectGenerationError(() => buildOutput(source), code, pointer);
  });

  it("rejects duplicate resolved identifiers", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            First: { $id: "https://schemas.example.test/same.json" },
            Second: { $id: "https://schemas.example.test/same.json" },
          },
        },
      },
    } satisfies AsyncAPISource;

    const error = expectGenerationError(
      () => buildOutput(source),
      "DUPLICATE_SCHEMA_ID",
      "/components/schemas/Second/$id",
    );
    expect(error.details).toMatchObject({
      firstSourcePointer: "/components/schemas/First/$id",
      secondSourcePointer: "/components/schemas/Second/$id",
    });
  });

  it("serializes object keys deterministically while preserving array order", () => {
    const left = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: { Event: { type: ["string", "null"], description: "event" } },
        },
      },
    } satisfies AsyncAPISource;
    const right = {
      data: {
        components: {
          schemas: { Event: { description: "event", type: ["string", "null"] } },
        },
        asyncapi: "3.1.0",
      },
    } satisfies AsyncAPISource;

    const first = buildOutput(left).components.map(({ document }) => stableJson(document));
    const second = buildOutput(right).components.map(({ document }) => stableJson(document));

    expect(first).toEqual(second);
    expect(first[0]?.endsWith("\n")).toBe(true);
    expect(first[0]?.endsWith("\n\n")).toBe(false);
    expect(first[0]).toContain('"type": [\n    "string",\n    "null"');
  });
});

describe("validateOutput", () => {
  it("rejects invalid Draft 07 keyword values", () => {
    const output = buildOutput({
      data: {
        asyncapi: "3.1.0",
        components: { schemas: { Event: { type: "string", minLength: -1 } } },
      },
    });

    expectGenerationError(
      () => validateOutput(output),
      "INVALID_JSON_SCHEMA",
      "/components/schemas/Event/minLength",
    );
  });

  it("attributes strict compilation failures to the component root", () => {
    const output = buildOutput({
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: { Event: { type: "string", misspelledKeyword: true } },
        },
      },
    });

    expectGenerationError(
      () => validateOutput(output),
      "INVALID_JSON_SCHEMA",
      "/components/schemas/Event",
    );
  });
});
