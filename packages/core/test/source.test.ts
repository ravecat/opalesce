import { describe, expect, it } from "vitest";
import { createAsyncAPISource } from "../src/source.js";

describe("createAsyncAPISource", () => {
  it("copies and recursively freezes JSON-compatible data", () => {
    const input = {
      nested: [{ value: "original" }],
    };
    const source = createAsyncAPISource(input, "memory://schemas/asyncapi.yaml");

    input.nested[0]!.value = "changed";

    expect(source).toEqual({
      data: { nested: [{ value: "original" }] },
      uri: "memory://schemas/asyncapi.yaml",
    });
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.data)).toBe(true);
    if (typeof source.data !== "object" || source.data === null) {
      throw new Error("Expected source data to be an object.");
    }
    expect(Object.isFrozen(Reflect.get(source.data, "nested"))).toBe(true);
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, new Date(0)])(
    "rejects non-JSON-compatible value %s",
    (value) => {
      expect(() => createAsyncAPISource({ value }, null)).toThrow(TypeError);
    },
  );

  it("rejects cyclic source data", () => {
    const value: { self?: object } = {};
    value.self = value;

    expect(() => createAsyncAPISource(value, null)).toThrow(TypeError);
  });

  it("preserves prototype-shaped keys as own JSON properties", () => {
    const input: unknown = JSON.parse('{"__proto__":{"safe":true}}');
    const source = createAsyncAPISource(input, null);

    if (typeof source.data !== "object" || source.data === null) {
      throw new Error("Expected source data to be an object.");
    }
    expect(Object.hasOwn(source.data, "__proto__")).toBe(true);
    expect(Reflect.get(source.data, "__proto__")).toEqual({ safe: true });
  });
});
