import type {
  AsyncApiEntityGraph,
  EntityKind,
  GeneratedArtifact,
} from "~/types";

export function emitJsonSchemaArtifacts({
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
    .map((entity) => ({
      kind: "json-schema",
      filePath: `${outputPath}/${entity.name}.schema.json`,
      code: `${JSON.stringify(entity.schema, null, 2)}\n`,
    }));
}
