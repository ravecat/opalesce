## ADDED Requirements

### Requirement: Scoped Core package boundary

The workspace SHALL provide an ESM TypeScript library at `packages/core` with package and Nx project identity `@opalesce/core`. The package SHALL emit JavaScript and TypeScript declarations from a single root export and SHALL declare `@asyncapi/parser` as its own direct runtime dependency.

#### Scenario: Core builds as an isolated package

- **WHEN** the Core build target runs from a clean workspace
- **THEN** `packages/core/dist` contains the JavaScript entry point and its declaration file
- **AND** the entry points resolve without importing transitional root modules

#### Scenario: Built package verification orders its prerequisites

- **WHEN** the Core package-consumer verification target runs without an existing `dist`
- **THEN** Nx builds Core before executing runtime and declaration assertions
- **AND** source-level tests remain runnable without a prior build

#### Scenario: Dependency ownership is explicit

- **WHEN** the Core package manifest is inspected
- **THEN** `@asyncapi/parser` is declared by `@opalesce/core`
- **AND** parser availability does not rely only on dependency hoisting from the workspace root

### Requirement: Official AsyncAPI document model

Core SHALL use `AsyncAPIDocumentInterface` from `@asyncapi/parser` as its document model and MUST NOT introduce a parallel or normalized AsyncAPI document representation. It SHALL expose a `ParsedAsyncAPI` result containing a valid official document and a shallow-frozen readonly collection of official parser diagnostics.

#### Scenario: Consumer uses official document methods

- **WHEN** valid input is parsed through Core
- **THEN** the returned document is assignable to `AsyncAPIDocumentInterface`
- **AND** the consumer can call official model methods such as `version()`, `channels()`, and `operations()`

#### Scenario: Result types use the parser vocabulary

- **WHEN** a TypeScript consumer imports the Core result and parser-related types
- **THEN** no conversion to a Core-specific document class is required
- **AND** Core exposes type-only exports for the official root-exported `Input`, `ParseOptions`, `AsyncAPIDocumentInterface`, and `Diagnostic` types
- **AND** exposes `AsyncAPIParserOptions` derived from the official `Parser` constructor argument without a deep package import

### Requirement: In-memory parsing API

Core SHALL export `parseAsyncAPI(input, options?)`, accepting official parser `Input` and a `ParseAsyncAPIOptions` object containing optional derived `AsyncAPIParserOptions` and official `ParseOptions`. The function MUST parse in-memory YAML or JSON text, JavaScript AsyncAPI objects, and existing official AsyncAPI documents. Core MUST NOT interpret the top-level input as a filesystem path, call `fromFile`, or discover configuration.

#### Scenario: Parse YAML or JSON text

- **WHEN** a consumer passes valid AsyncAPI text to `parseAsyncAPI`
- **THEN** the promise resolves with a parsed result

#### Scenario: Parse a JavaScript AsyncAPI object

- **WHEN** a consumer passes an object satisfying the official parser `Input` type
- **THEN** the promise resolves with a parsed result

#### Scenario: Accept an existing official document

- **WHEN** a consumer passes an existing `AsyncAPIDocumentInterface`
- **THEN** Core accepts it through the same parsing API
- **AND** returns a valid official document result

#### Scenario: Forward parser construction and parse options

- **WHEN** a consumer supplies derived `AsyncAPIParserOptions` and official `ParseOptions`
- **THEN** Core passes parser options to the `Parser` constructor unchanged
- **AND** passes parse options to `Parser.parse` unchanged

#### Scenario: External references retain official behavior

- **WHEN** in-memory input contains an external `$ref`
- **THEN** resolution follows the official parser, source, and resolver-option semantics
- **AND** Core does not claim that external reference resolution is free of filesystem or network reads

### Requirement: Supported AsyncAPI versions

Core SHALL successfully parse valid AsyncAPI 3.0 and 3.1 documents supported by the installed official parser.

#### Scenario: Parse AsyncAPI 3.0

- **WHEN** Core receives the repository's valid AsyncAPI 3.0 fixture
- **THEN** the returned document reports an AsyncAPI 3.0 version

#### Scenario: Parse AsyncAPI 3.1

- **WHEN** Core receives the repository's valid AsyncAPI 3.1 fixture
- **THEN** the returned document reports an AsyncAPI 3.1 version

### Requirement: Successful diagnostic preservation

`parseAsyncAPI` SHALL resolve only when the official parser returns a document and no error-severity diagnostic. The successful `ParsedAsyncAPI` result SHALL retain every non-fatal diagnostic returned by the parser in a defensive, shallow-frozen array copy.

#### Scenario: Valid document has no fatal diagnostics

- **WHEN** the parser returns a document with no error-severity diagnostics
- **THEN** Core resolves with that document and the complete diagnostics collection

#### Scenario: Warning remains observable

- **WHEN** the parser returns a valid document together with a warning, information, or hint diagnostic
- **THEN** Core resolves successfully
- **AND** the diagnostic remains available in `ParsedAsyncAPI.diagnostics`
- **AND** the diagnostics array cannot be mutated at runtime

### Requirement: Typed parse failure

Core SHALL export `AsyncAPIParseError`. `parseAsyncAPI` MUST reject with this error when the official parser returns no document or returns any error-severity diagnostic. The error SHALL retain the complete diagnostics collection from that parse attempt in a defensive, shallow-frozen array copy.

#### Scenario: Invalid input has parser diagnostics

- **WHEN** invalid AsyncAPI input produces one or more error-severity diagnostics
- **THEN** `parseAsyncAPI` rejects with `AsyncAPIParseError`
- **AND** the error exposes all diagnostics from the parser result

#### Scenario: Parser returns no document

- **WHEN** the parser result has no document
- **THEN** `parseAsyncAPI` rejects with `AsyncAPIParseError`
- **AND** no result with an optional or undefined document is returned as success

### Requirement: Core excludes generation and process concerns

The initial `@opalesce/core` public API MUST NOT expose filesystem loading, config discovery, CLI processing, plugin management, template rendering, artifact writing, or JSON Schema, TypeScript, and Zod emitters.

#### Scenario: Public runtime surface stays focused

- **WHEN** a consumer inspects the Core runtime exports
- **THEN** the exports contain the parsing function and typed parse error
- **AND** they contain no legacy generator, plugin, config, runner, or emitter entry point

#### Scenario: Parsing performs no file writes

- **WHEN** Core parses valid or invalid in-memory input
- **THEN** no generated artifact or metadata file is written
