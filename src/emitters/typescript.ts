import { compile, type JSONSchema } from "json-schema-to-typescript";
import { matchesInclude } from "~/core/include";
import type {
  AsyncApiEntityGraph,
  GeneratedArtifact,
  IncludeSelector,
} from "~/types";

const BANNER = `/**
 * Generated from AsyncAPI spec.
 * Do not edit manually.
 */`;

function applyBinaryTsType(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => applyBinaryTsType(item));
  }

  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    const transformed = Object.fromEntries(
      Object.entries(node).map(([key, nested]) => [
        key,
        applyBinaryTsType(nested),
      ]),
    );

    if (transformed.type === "string" && transformed.format === "binary") {
      return {
        ...transformed,
        tsType: "ArrayBuffer",
      };
    }

    return transformed;
  }

  return value;
}

export async function emitTypescriptArtifacts({
  graph,
  outputPath,
  include,
}: {
  graph: AsyncApiEntityGraph;
  outputPath: string;
  include?: IncludeSelector[];
}): Promise<GeneratedArtifact[]> {
  return Promise.all(
    graph.entities
      .filter((entity) =>
        Array.isArray(include)
          ? include.some((selector) => matchesInclude(entity, selector))
          : true,
      )
      .map(async (entity) => ({
        kind: "types" as const,
        filePath: `${outputPath}/${entity.name}.ts`,
        code: await compile(
          applyBinaryTsType(entity.schema) as JSONSchema,
          entity.name,
          {
            additionalProperties: false,
            bannerComment: BANNER,
            format: false,
          },
        ),
        export: {
          name: entity.name,
          kind: "type" as const,
        },
      })),
  );
}
