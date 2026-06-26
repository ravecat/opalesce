import type { AsyncApiEntity, AsyncApiEntitySeed } from "~/types";

export function pascalCase(value: string): string {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

export function camelCase(value: string): string {
  const normalized = pascalCase(value);

  if (!normalized) {
    return normalized;
  }

  return normalized[0].toLowerCase() + normalized.slice(1);
}

export function assignEntityNames(entities: AsyncApiEntitySeed[]): AsyncApiEntity[] {
  const initial = entities.map((entity) => ({
    ...entity,
    name: deriveEntityName(entity),
  }));

  const initialCounts = countByName(initial);
  const withNamespace = initial.map((entity) => {
    if ((initialCounts.get(entity.name) ?? 0) < 2) {
      return entity;
    }

    const namespaced = pascalCase([entity.namespaceHint, entity.name].filter(Boolean).join(" "));

    return {
      ...entity,
      name: namespaced || entity.name,
    };
  });

  const finalCounts = countByName(withNamespace);
  const seen = new Map<string, number>();

  return withNamespace.map((entity) => {
    if ((finalCounts.get(entity.name) ?? 0) < 2) {
      return entity;
    }

    const nextIndex = (seen.get(entity.name) ?? 0) + 1;
    seen.set(entity.name, nextIndex);

    return nextIndex === 1
      ? entity
      : {
          ...entity,
          name: `${entity.name}${nextIndex}`,
        };
  });
}

function deriveEntityName(entity: AsyncApiEntitySeed): string {
  if (entity.source === "component") {
    return (
      pascalCase(
        entity.identity?.schemaId ??
          entity.identity?.schemaTitle ??
          entity.displayNameHint ??
          entity.id,
      ) || "Entity"
    );
  }

  if (entity.source === "operation" && entity.role === "payload") {
    return (
      pascalCase(
        entity.identity?.schemaId ??
          entity.identity?.messageId ??
          entity.identity?.messageTitle ??
          entity.displayNameHint ??
          entity.id,
      ) || "Entity"
    );
  }

  if (entity.source === "operation" && entity.role === "header") {
    return (
      pascalCase(
        entity.identity?.messageId ??
          entity.identity?.messageTitle ??
          entity.displayNameHint ??
          entity.id,
      ) || "Entity"
    );
  }

  if (entity.source === "channel" && entity.role === "parameter") {
    return (
      pascalCase(entity.identity?.parameterId ?? entity.displayNameHint ?? entity.id) || "Entity"
    );
  }

  return pascalCase(entity.displayNameHint ?? entity.id) || "Entity";
}

function countByName(
  entities: Array<{
    name: string;
  }>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entity of entities) {
    counts.set(entity.name, (counts.get(entity.name) ?? 0) + 1);
  }

  return counts;
}
