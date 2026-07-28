import {
  DiagnosticSeverity,
  Parser,
  type AsyncAPIDocumentInterface,
  type Diagnostic,
  type Input,
  type ParseOptions,
} from "@asyncapi/parser";

export type { AsyncAPIDocumentInterface, Diagnostic, Input, ParseOptions } from "@asyncapi/parser";

export interface ParsedAsyncAPI {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
}

export type AsyncAPIParserOptions = NonNullable<ConstructorParameters<typeof Parser>[0]>;

export interface ParseAsyncAPIOptions {
  readonly parser?: AsyncAPIParserOptions;
  readonly parse?: ParseOptions;
}

function freezeDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  return Object.freeze([...diagnostics]);
}

export class AsyncAPIParseError extends Error {
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    super("Failed to parse the AsyncAPI document.");
    this.name = "AsyncAPIParseError";
    this.diagnostics = freezeDiagnostics(diagnostics);
  }
}

export async function parseAsyncAPI(
  input: Input,
  options?: ParseAsyncAPIOptions,
): Promise<ParsedAsyncAPI> {
  const parser = new Parser(options?.parser);
  const output = await parser.parse(input, options?.parse);

  if (
    !output.document ||
    output.diagnostics.some((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error)
  ) {
    throw new AsyncAPIParseError(output.diagnostics);
  }

  return {
    document: output.document,
    diagnostics: freezeDiagnostics(output.diagnostics),
  };
}
