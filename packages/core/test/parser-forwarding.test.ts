import type { Input, ParseOptions, ParseOutput } from "@asyncapi/parser";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ParserControl {
  constructorOptions?: unknown;
  input?: unknown;
  output?: ParseOutput;
  parseOptions?: unknown;
}

const parserControl = vi.hoisted((): ParserControl => ({}));

vi.mock("@asyncapi/parser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@asyncapi/parser")>();

  return {
    ...actual,
    Parser: class {
      constructor(options?: unknown) {
        parserControl.constructorOptions = options;
      }

      parse(input: unknown, options?: unknown): Promise<ParseOutput> {
        parserControl.input = input;
        parserControl.parseOptions = options;
        return Promise.resolve(
          parserControl.output ?? {
            document: undefined,
            diagnostics: [],
          },
        );
      }
    },
  };
});

import { AsyncAPIParseError, parseAsyncAPI, type AsyncAPIParserOptions } from "../src/index.js";

const input: Input = {
  asyncapi: "3.1.0",
  info: {
    title: "Forwarding test",
    version: "1.0.0",
  },
};

beforeEach(() => {
  delete parserControl.constructorOptions;
  delete parserControl.input;
  delete parserControl.output;
  delete parserControl.parseOptions;
});

describe("parser delegation", () => {
  it("forwards constructor and parse options unchanged", async () => {
    const actual = await vi.importActual<typeof import("@asyncapi/parser")>("@asyncapi/parser");
    const actualOutput = await new actual.Parser().parse(input);
    if (!actualOutput.document) {
      throw new Error("The forwarding fixture must produce a document.");
    }

    parserControl.output = actualOutput;
    const parserOptions: AsyncAPIParserOptions = { schemaParsers: [] };
    const parseOptions: ParseOptions = {
      applyTraits: false,
      parseSchemas: false,
      source: "memory://forwarding/asyncapi.yaml",
    };

    await parseAsyncAPI(input, {
      parser: parserOptions,
      parse: parseOptions,
    });

    expect(parserControl.constructorOptions).toBe(parserOptions);
    expect(parserControl.input).toBe(input);
    expect(parserControl.parseOptions).toBe(parseOptions);
  });

  it("makes a defensive frozen diagnostics copy on success", async () => {
    const actual = await vi.importActual<typeof import("@asyncapi/parser")>("@asyncapi/parser");
    const output = await new actual.Parser().parse({
      ...input,
      asyncapi: "3.0.0",
    });
    if (!output.document || output.diagnostics.length === 0) {
      throw new Error("The diagnostics fixture must produce a document and diagnostic.");
    }

    parserControl.output = output;
    const result = await parseAsyncAPI(input);
    const diagnosticCount = result.diagnostics.length;

    expect(result.diagnostics).not.toBe(output.diagnostics);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);

    output.diagnostics.splice(0);
    expect(result.diagnostics).toHaveLength(diagnosticCount);
  });

  it("rejects a missing parser document even without diagnostics", async () => {
    parserControl.output = {
      document: undefined,
      diagnostics: [],
    };

    const rejection = await parseAsyncAPI(input).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(AsyncAPIParseError);
    if (!(rejection instanceof AsyncAPIParseError)) {
      throw new Error("Expected AsyncAPIParseError.");
    }

    expect(rejection.diagnostics).toEqual([]);
    expect(Object.isFrozen(rejection.diagnostics)).toBe(true);
  });

  it("rejects an error diagnostic and makes a defensive frozen copy", async () => {
    const actual = await vi.importActual<typeof import("@asyncapi/parser")>("@asyncapi/parser");
    const validOutput = await new actual.Parser().parse(input);
    const invalidOutput = await new actual.Parser().parse("invalid");
    if (!validOutput.document || invalidOutput.diagnostics.length === 0) {
      throw new Error("The error fixture must produce a document and diagnostics.");
    }

    parserControl.output = {
      document: validOutput.document,
      diagnostics: invalidOutput.diagnostics,
    };
    const rejection = await parseAsyncAPI(input).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(AsyncAPIParseError);
    if (!(rejection instanceof AsyncAPIParseError)) {
      throw new Error("Expected AsyncAPIParseError.");
    }

    const diagnosticCount = rejection.diagnostics.length;
    expect(rejection.diagnostics).not.toBe(invalidOutput.diagnostics);
    expect(Object.isFrozen(rejection.diagnostics)).toBe(true);

    invalidOutput.diagnostics.splice(0);
    expect(rejection.diagnostics).toHaveLength(diagnosticCount);
  });
});
