import type { Parser } from "@asyncapi/parser";
import type {
  AsyncAPIDocumentInterface,
  AsyncAPIParserOptions,
  AsyncAPISource,
  Diagnostic,
  Input,
  InteractionContract,
  InteractionRootMetadata,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
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

export type ResultUsesOptionalSource = Expect<
  Equal<ParsedAsyncAPI["source"], AsyncAPISource | undefined>
>;

export type SourceOnlyExposesPublicJsonData = Expect<Equal<keyof AsyncAPISource, "data" | "uri">>;

export type JsonObjectValuesAreReadonly = Expect<Equal<JsonObject["field"], JsonValue>>;

export type RootTypeExportsAreUsable = [
  Input,
  InteractionContract,
  InteractionRootMetadata,
  ParseOptions,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
];

declare const interaction: InteractionContract;

// @ts-expect-error interaction roots are readonly
interaction.schemas = [];

// @ts-expect-error interaction collections are readonly
interaction.messages.push();
