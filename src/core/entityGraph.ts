import type { AsyncApiEntity, AsyncApiEntityGraph } from "~/types";

export function createEntityGraph(
  entities: AsyncApiEntity[],
): AsyncApiEntityGraph {
  const byId = new Map<string, AsyncApiEntity>();

  for (const entity of entities) {
    if (byId.has(entity.id)) {
      throw new Error(`Duplicate entity id detected: ${entity.id}`);
    }

    byId.set(entity.id, entity);
  }

  return {
    entities,
    byId,
  };
}
