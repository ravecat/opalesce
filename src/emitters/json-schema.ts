import { matchesInclude } from "~/core/include";
import type { AsyncApiEntityGraph, GeneratedArtifact, IncludeSelector } from "~/types";

export function emitJsonSchemaArtifacts({
  graph,
  outputPath,
  include,
}: {
  graph: AsyncApiEntityGraph;
  outputPath: string;
  include?: IncludeSelector[];
}): GeneratedArtifact[] {
  return graph.entities
    .filter((entity) =>
      Array.isArray(include) ? include.some((selector) => matchesInclude(entity, selector)) : true,
    )
    .map((entity) => ({
      kind: "json-schema",
      filePath: `${outputPath}/${entity.name}.schema.json`,
      code: `${JSON.stringify(entity.schema, null, 2)}\n`,
    }));
}
