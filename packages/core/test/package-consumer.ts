import {
  AsyncAPIParseError,
  parseAsyncAPI,
  type AsyncAPIDocumentInterface,
  type AsyncAPIParserOptions,
  type Diagnostic,
  type Input,
  type ParseAsyncAPIOptions,
  type ParseOptions,
  type ParsedAsyncAPI,
} from "@opalesce/core";

declare const input: Input;
declare const parserOptions: AsyncAPIParserOptions;
declare const parseOptions: ParseOptions;
declare const document: AsyncAPIDocumentInterface;
declare const diagnostics: readonly Diagnostic[];

const options: ParseAsyncAPIOptions = {
  parser: parserOptions,
  parse: parseOptions,
};
const result: Promise<ParsedAsyncAPI> = parseAsyncAPI(input, options);
const error = new AsyncAPIParseError(diagnostics);

document.version();
document.channels();
document.operations();
void result;
void error;
