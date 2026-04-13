import { jsonSchemaToZod } from "json-schema-to-zod";
import { camelCase } from "~/core/naming";
import type {
  AsyncApiEntityGraph,
  EntityKind,
  GeneratedArtifact,
} from "~/types";

const BANNER = `/**
 * Generated from AsyncAPI spec.
 * Do not edit manually.
 */`;

function normalizeZodSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeZodSchema(item));
  }

  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    const transformed = Object.fromEntries(
      Object.entries(node).map(([key, nested]) => [
        key,
        normalizeZodSchema(nested),
      ]),
    );

    if (Array.isArray(transformed.oneOf) && transformed.anyOf === undefined) {
      return {
        ...transformed,
        anyOf: transformed.oneOf,
        oneOf: undefined,
      };
    }

    return transformed;
  }

  return value;
}

function withBinaryArrayBufferZodParser(
  node: Record<string, unknown>,
): string | undefined {
  if (node.type === "string" && node.format === "binary") {
    return "z.instanceof(ArrayBuffer)";
  }

  return undefined;
}

function emitZodExpression(schema: unknown): string {
  return jsonSchemaToZod(
    normalizeZodSchema(schema) as Record<string, unknown>,
    {
      parserOverride: withBinaryArrayBufferZodParser,
    },
  )
    .replace(/z\.record\((?!z\.string\(\),\s)/g, "z.record(z.string(), ")
    .replaceAll("z.any()", "z.unknown()")
    .trim()
    .replace(/;$/, "");
}

export function emitZodArtifacts({
  graph,
  outputPath,
  include,
}: {
  graph: AsyncApiEntityGraph;
  outputPath: string;
  include?: EntityKind[];
}): GeneratedArtifact[] {
  return graph.entities
    .filter((entity) =>
      Array.isArray(include) ? include.includes(entity.kind) : true,
    )
    .map((entity) => {
      const exportName = `${camelCase(entity.name)}Schema`;

      return {
        kind: "zod" as const,
        filePath: `${outputPath}/${entity.name}Schema.ts`,
        code: `${BANNER}

import { z } from "zod/v4";

export const ${exportName} = ${emitZodExpression(entity.schema)};
`,
        export: {
          name: exportName,
          kind: "value" as const,
        },
      };
    });
}
