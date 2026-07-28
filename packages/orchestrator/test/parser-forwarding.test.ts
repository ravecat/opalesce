import { type Input, type ParseAsyncAPIOptions, type parseAsyncAPI } from "@opalesce/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const parseAsyncAPISpy = vi.hoisted(() => vi.fn<typeof parseAsyncAPI>());

vi.mock("@opalesce/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@opalesce/core")>();

  parseAsyncAPISpy.mockImplementation(actual.parseAsyncAPI);

  return {
    ...actual,
    parseAsyncAPI: parseAsyncAPISpy,
  };
});

import { runPipeline } from "../src/index.js";

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
        source: "memory://orchestrator/asyncapi.yaml",
      },
    };

    await runPipeline({ input, parser });

    expect(parseAsyncAPISpy).toHaveBeenCalledTimes(1);
    expect(parseAsyncAPISpy).toHaveBeenCalledWith(input, parser);
  });
});
