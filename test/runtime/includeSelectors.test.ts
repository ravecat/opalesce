import { describe, expect, test } from "vitest";
import { normalizeInclude } from "~/core/include";

describe("normalizeInclude", () => {
  test("returns undefined when include is omitted", () => {
    expect(normalizeInclude()).toBeUndefined();
  });

  test("accepts AsyncAPI selectors", () => {
    expect(normalizeInclude(["components.schemas", "channels.parameters"])).toEqual([
      "components.schemas",
      "channels.parameters",
    ]);
  });

  test("rejects legacy kind literals", () => {
    expect(() => normalizeInclude(["message-payload" as never])).toThrowError(
      "Unknown include selector: message-payload",
    );
  });
});
