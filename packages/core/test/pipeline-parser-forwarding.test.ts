import type { Input, ParseAsyncAPIOptions, parseAsyncAPI } from "../src/parseAsyncAPI.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const parseAsyncAPISpy = vi.hoisted(() => vi.fn<typeof parseAsyncAPI>());

vi.mock("../src/parseAsyncAPI.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/parseAsyncAPI.js")>();

  parseAsyncAPISpy.mockImplementation(actual.parseAsyncAPI);

  return {
    ...actual,
    parseAsyncAPI: parseAsyncAPISpy,
  };
});

import { run } from "../src/index.js";

const input: Input = {
  asyncapi: "3.1.0",
  info: {
    title: "Orchestrator forwarding",
    version: "1.0.0",
  },
};

beforeEach(() => {
  parseAsyncAPISpy.mockClear();
});

describe("Core delegation", () => {
  it("parses exactly once and forwards the input and options unchanged", async () => {
    const parser: ParseAsyncAPIOptions = {
      parser: { schemaParsers: [] },
      parse: {
        applyTraits: false,
        parseSchemas: false,
        source: "memory://core/asyncapi.yaml",
      },
    };

    await run({ input, parser });

    expect(parseAsyncAPISpy).toHaveBeenCalledTimes(1);
    expect(parseAsyncAPISpy).toHaveBeenCalledWith(input, parser);
  });
});
