import { run, type Input } from "@opalesce/core";
import { describe, expect, it } from "vitest";
import typescript from "../src/index.js";

async function schemaContents(input: Input, name: string): Promise<string> {
  const result = await run({ input, plugins: [typescript()] });
  const artifact = result.artifacts.find((candidate) =>
    candidate.path.endsWith(`/schemas/${name}.ts`),
  );
  if (artifact === undefined) {
    throw new Error(`Expected schema artifact ${name}.ts.`);
  }
  return artifact.contents;
}

const projectionInput = {
  asyncapi: "3.1.0",
  info: { title: "Projection", version: "1.0.0" },
  components: {
    schemas: {
      Base: {
        type: "object",
        required: ["id", "secret"],
        additionalProperties: false,
        properties: {
          id: { type: "string", readOnly: true },
          secret: { type: "string", writeOnly: true, description: "bad */ source" },
          note: { type: ["string", "null"], default: null, examples: ["hello"] },
        },
      },
      Extra: { type: "object", properties: { count: { type: "integer" } } },
      Combined: {
        allOf: [{ $ref: "#/components/schemas/Base" }, { $ref: "#/components/schemas/Extra" }],
      },
      Choice: {
        oneOf: [{ const: "created" }, { const: "processed" }],
      },
      Tuple: {
        type: "array",
        items: [{ type: "string" }, { type: "number" }],
      },
      StringMap: {
        type: "object",
        properties: { fixed: { type: "string" } },
        additionalProperties: { type: "string" },
      },
      MixedMap: {
        type: "object",
        properties: { fixed: { type: "number" } },
        additionalProperties: { type: "string" },
      },
      Left: {
        type: "object",
        properties: { right: { $ref: "#/components/schemas/Right" } },
      },
      Right: {
        type: "object",
        properties: { left: { $ref: "#/components/schemas/Left" } },
      },
    },
  },
} satisfies Input;

describe("schema projection", () => {
  it("projects property modifiers, nullable values, annotations, and closed objects", async () => {
    const contents = await schemaContents(projectionInput, "Base");

    expect(contents).toContain("readonly id: string;");
    expect(contents).toContain("note?: string | null;");
    expect(contents).toContain("secret: string;");
    expect(contents).toContain("@writeOnly");
    expect(contents).toContain("bad *\\/ source");
    expect(contents).not.toContain("[key: string]");
  });

  it("projects composition, literals, and tuples", async () => {
    await expect(schemaContents(projectionInput, "Combined")).resolves.toContain("Base & Extra");
    await expect(schemaContents(projectionInput, "Choice")).resolves.toContain(
      '"created" | "processed"',
    );
    await expect(schemaContents(projectionInput, "Tuple")).resolves.toMatch(
      /Tuple = \[\s*string,\s*number\s*\]/u,
    );
  });

  it("retains compatible index values and widens incompatible values", async () => {
    await expect(schemaContents(projectionInput, "StringMap")).resolves.toContain(
      "[key: string]: string;",
    );
    await expect(schemaContents(projectionInput, "MixedMap")).resolves.toContain(
      "[key: string]: unknown;",
    );
  });

  it("uses symbolic imports for mutual recursion", async () => {
    const result = await run({ input: projectionInput, plugins: [typescript()] });
    const left = result.artifacts.find((artifact) => artifact.path.endsWith("/Left.ts"));
    const right = result.artifacts.find((artifact) => artifact.path.endsWith("/Right.ts"));

    expect(left?.contents).toContain('import type { Right } from "./Right.js";');
    expect(left?.contents).toContain("right?: Right;");
    expect(right?.contents).toContain('import type { Left } from "./Left.js";');
    expect(right?.contents).toContain("left?: Left;");
  });
});
