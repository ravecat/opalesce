export type JsonPrimitive = boolean | null | number | string;

export type JsonArray = readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export interface AsyncAPISource {
  readonly data: JsonValue;
  readonly uri?: string;
}

function sourceValueError(pointer: string): TypeError {
  return new TypeError(`AsyncAPI parser source at "${pointer || "/"}" is not JSON-compatible.`);
}

function copyJsonValue(value: unknown, pointer: string, ancestors: ReadonlySet<object>): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (typeof value !== "object") {
    throw sourceValueError(pointer);
  }

  if (ancestors.has(value)) {
    throw sourceValueError(pointer);
  }

  const nextAncestors = new Set(ancestors).add(value);

  if (Array.isArray(value)) {
    const copy = value.map((item, index) =>
      copyJsonValue(item, `${pointer}/${index}`, nextAncestors),
    );
    return Object.freeze(copy);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw sourceValueError(pointer);
  }

  const entries: Array<readonly [string, JsonValue]> = [];
  for (const [key, child] of Object.entries(value)) {
    const escapedKey = key.replaceAll("~", "~0").replaceAll("/", "~1");
    entries.push([key, copyJsonValue(child, `${pointer}/${escapedKey}`, nextAncestors)]);
  }

  return Object.freeze(Object.fromEntries(entries));
}

export function createAsyncAPISource(data: unknown, uri: string | null): AsyncAPISource {
  const source: AsyncAPISource = {
    data: copyJsonValue(data, "", new Set()),
    ...(uri === null ? {} : { uri }),
  };

  return Object.freeze(source);
}
