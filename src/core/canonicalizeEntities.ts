import type {
  AsyncApiEntityIdentity,
  AsyncApiEntitySeed,
  EntitySource,
} from "~/types";

const SOURCE_PRIORITY: Record<EntitySource, number> = {
  component: 0,
  operation: 1,
  channel: 2,
};

export function canonicalizeEntities(
  entities: AsyncApiEntitySeed[],
): AsyncApiEntitySeed[] {
  const groups = new Map<string, AsyncApiEntitySeed[]>();

  for (const entity of entities) {
    const key = entity.canonicalKey ?? entity.id;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }

  return [...groups.values()].map((group) => {
    const [canonical] = [...group].sort(
      (left, right) =>
        SOURCE_PRIORITY[left.source] - SOURCE_PRIORITY[right.source],
    );

    return {
      ...canonical,
      identity: mergeIdentity(group.map((item) => item.identity)),
    };
  });
}

function mergeIdentity(
  identities: Array<AsyncApiEntityIdentity | undefined>,
): AsyncApiEntityIdentity | undefined {
  const merged = identities.reduce<AsyncApiEntityIdentity>(
    (accumulator, current) => ({
      ...accumulator,
      ...current,
    }),
    {},
  );

  return Object.keys(merged).length > 0 ? merged : undefined;
}
