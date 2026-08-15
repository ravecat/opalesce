import type { AsyncAPISource } from "@opalesce/core";
import { describe, expect, it } from "vitest";
import { buildBundle } from "../src/bundle.js";
import { JsonSchemaGenerationError } from "../src/errors.js";
import { stableJson } from "../src/serialize.js";
import { validateBundle } from "../src/validate.js";

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

describe("buildBundle", () => {
  it("unwraps boolean Draft 07 schemas and preserves only selected components", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        info: { title: "Booleans", version: "1.0.0" },
        components: {
          schemas: {
            Allow: true,
            Deny: {
              schemaFormat: "application/schema+json; version=draft-07",
              schema: false,
            },
          },
          messages: {
            Ignored: { payload: { type: "string" } },
          },
        },
        channels: {
          events: {
            address: "events",
            messages: {
              Inline: { payload: { type: "number" } },
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    expect(buildBundle(source).document).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      definitions: {
        Allow: true,
        Deny: false,
      },
    });
  });

  it("preserves recursion, annotations, extensions, and exact component keys", () => {
    const source = {
      data: {
        asyncapi: "3.0.0",
        components: {
          schemas: {
            "Tree/Node": {
              description: "Recursive tree",
              examples: [{ value: "root" }],
              type: "object",
              properties: {
                child: { $ref: "#/components/schemas/Tree~1Node" },
              },
              "x-domain": "catalog",
              "x-parser-schema-id": "removed",
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    const bundle = buildBundle(source);

    expect(bundle.document).toMatchObject({
      definitions: {
        "Tree/Node": {
          description: "Recursive tree",
          examples: [{ value: "root" }],
          properties: {
            child: { $ref: "#/definitions/Tree~1Node" },
          },
          "x-domain": "catalog",
        },
      },
    });
    expect(stableJson(bundle.document)).not.toContain("x-parser-");
    expect(() => validateBundle(bundle)).not.toThrow();
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
              properties: {
                [propertyName]: { type: "string" },
              },
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    const bundle = buildBundle(source);
    const serialized = stableJson(bundle.document);

    expect(serialized).toContain('"__proto__": {');
    expect(JSON.parse(serialized)).toMatchObject({
      definitions: {
        Event: {
          properties: {
            [propertyName]: { type: "string" },
          },
        },
      },
    });
  });

  it("accepts URI references to authored resources already embedded in the bundle", () => {
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

    const bundle = buildBundle(source);

    expect(bundle.document).toMatchObject({
      definitions: {
        Consumer: { $ref: identifier },
        Target: { $id: identifier },
      },
    });
    expect(() => validateBundle(bundle)).not.toThrow();
  });

  it("preserves and validates the HTTPS spelling of the Draft 07 dialect", () => {
    const source = {
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

    const bundle = buildBundle(source);

    expect(bundle.document).toMatchObject({
      definitions: {
        Event: { $schema: "https://json-schema.org/draft-07/schema#" },
      },
    });
    expect(() => validateBundle(bundle)).not.toThrow();
  });

  it("rejects conflicting dialects on nested schema resources", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Event: {
              type: "object",
              properties: {
                nested: { $schema: "https://json-schema.org/draft/2020-12/schema" },
              },
            },
          },
        },
      },
    } satisfies AsyncAPISource;

    const error = expectGenerationError(
      () => buildBundle(source),
      "DIALECT_CONFLICT",
      "/components/schemas/Event",
    );

    expect(error.details).toMatchObject({
      dialectPointer: "/components/schemas/Event/properties/nested/$schema",
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
      source: { data: { asyncapi: "2.5.0" } } satisfies AsyncAPISource,
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
      } satisfies AsyncAPISource,
      code: "UNSUPPORTED_SCHEMA_FORMAT",
      pointer: "/components/schemas/Event",
    },
    {
      name: "dialect conflict",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: {
              Event: { $schema: "https://json-schema.org/draft/2020-12/schema" },
            },
          },
        },
      } satisfies AsyncAPISource,
      code: "DIALECT_CONFLICT",
      pointer: "/components/schemas/Event",
    },
    {
      name: "missing component",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: {
              Event: { $ref: "#/components/schemas/Missing" },
            },
          },
        },
      } satisfies AsyncAPISource,
      code: "UNRESOLVED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
    {
      name: "out-of-scope reference",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: {
              Event: { $ref: "#/components/messages/Event/payload" },
            },
          },
        },
      } satisfies AsyncAPISource,
      code: "UNSUPPORTED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
    {
      name: "external reference",
      source: {
        data: {
          asyncapi: "3.1.0",
          components: {
            schemas: {
              Event: { $ref: "https://example.test/event.json" },
            },
          },
        },
      } satisfies AsyncAPISource,
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
      } satisfies AsyncAPISource,
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
      } satisfies AsyncAPISource,
      code: "UNSUPPORTED_REFERENCE",
      pointer: "/components/schemas/Event/$ref",
    },
  ];

  it.each(rejectionCases)("rejects $name", ({ source, code, pointer }) => {
    expectGenerationError(() => buildBundle(source), code, pointer);
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
      () => buildBundle(source),
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
          schemas: {
            Event: { type: ["string", "null"], description: "event" },
          },
        },
      },
    } satisfies AsyncAPISource;
    const right = {
      data: {
        components: {
          schemas: {
            Event: { description: "event", type: ["string", "null"] },
          },
        },
        asyncapi: "3.1.0",
      },
    } satisfies AsyncAPISource;

    const first = stableJson(buildBundle(left).document);
    const second = stableJson(buildBundle(right).document);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(first).toContain('"type": [\n        "string",\n        "null"');
  });
});

describe("validateBundle", () => {
  it("rejects invalid Draft 07 keyword values", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Event: { type: "string", minLength: -1 },
          },
        },
      },
    } satisfies AsyncAPISource;
    const bundle = buildBundle(source);

    expectGenerationError(
      () => validateBundle(bundle),
      "INVALID_JSON_SCHEMA",
      "/components/schemas/Event/minLength",
    );
  });

  it("attributes strict compilation failures to the definition root", () => {
    const source = {
      data: {
        asyncapi: "3.1.0",
        components: {
          schemas: {
            Event: { type: "string", misspelledKeyword: true },
          },
        },
      },
    } satisfies AsyncAPISource;
    const bundle = buildBundle(source);

    expectGenerationError(
      () => validateBundle(bundle),
      "INVALID_JSON_SCHEMA",
      "/components/schemas/Event",
    );
  });
});
