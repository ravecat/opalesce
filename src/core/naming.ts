// @ts-check

const KIND_SUFFIX = {
  "component-schema": "Schema",
  "message-payload": "Payload",
  "reply-payload": "ReplyPayload",
  "channel-parameter": "Parameter",
  "message-header": "Headers",
};

/**
 * @param {string} value
 * @returns {string}
 */
export function pascalCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/**
 * @param {string} value
 * @returns {string}
 */
export function camelCase(value) {
  const normalized = pascalCase(value);

  if (!normalized) {
    return normalized;
  }

  return normalized[0].toLowerCase() + normalized.slice(1);
}

/**
 * @param {Array<{ id: string, kind: keyof typeof KIND_SUFFIX, baseName?: string, name?: string }>} entities
 * @returns {Array<{ id: string, kind: keyof typeof KIND_SUFFIX, baseName?: string, name: string }>}
 */
export function resolveEntityNames(entities) {
  const initial = entities.map((entity) => ({
    ...entity,
    name: pascalCase(entity.baseName ?? entity.name ?? entity.id) || "Entity",
  }));

  const initialCounts = countByName(initial);
  const withSemanticSuffix = initial.map((entity) => {
    if ((initialCounts.get(entity.name) ?? 0) < 2) {
      return entity;
    }

    return {
      ...entity,
      name: `${entity.name}${KIND_SUFFIX[entity.kind]}`,
    };
  });

  const finalCounts = countByName(withSemanticSuffix);
  /** @type {Map<string, number>} */
  const seen = new Map();

  return withSemanticSuffix.map((entity) => {
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

/**
 * @param {Array<{ name: string }>} entities
 * @returns {Map<string, number>}
 */
function countByName(entities) {
  /** @type {Map<string, number>} */
  const counts = new Map();

  for (const entity of entities) {
    counts.set(entity.name, (counts.get(entity.name) ?? 0) + 1);
  }

  return counts;
}
