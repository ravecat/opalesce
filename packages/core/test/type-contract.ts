import type { Parser } from "@asyncapi/parser";
import type {
  AsyncAPIDocumentInterface,
  AsyncAPIParserOptions,
  Diagnostic,
  Input,
  ParseOptions,
  ParsedAsyncAPI,
} from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

export type ParserOptionsMatchConstructor = Expect<
  Equal<AsyncAPIParserOptions, NonNullable<ConstructorParameters<typeof Parser>[0]>>
>;

export type ResultUsesOfficialDocument = Expect<
  Equal<ParsedAsyncAPI["document"], AsyncAPIDocumentInterface>
>;

export type ResultUsesReadonlyDiagnostics = Expect<
  Equal<ParsedAsyncAPI["diagnostics"], readonly Diagnostic[]>
>;

export type RootTypeExportsAreUsable = [Input, ParseOptions];
