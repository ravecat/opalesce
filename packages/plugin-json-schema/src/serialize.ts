import type { JsonObject, JsonValue } from "@opalesce/core";

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const entries: Array<readonly [string, JsonValue]> = [];
  for (const key of Object.keys(value).sort(compareKeys)) {
    const child = value[key];
    if (child !== undefined) {
      entries.push([key, sortJsonValue(child)]);
    }
  }

  return Object.fromEntries(entries);
}

export function stableJson(document: JsonObject): string {
  return `${JSON.stringify(sortJsonValue(document), null, 2)}\n`;
}
