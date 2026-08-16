## Context

`@opalesce/core` currently gives every output plugin the same `AsyncAPIDocumentInterface` and parser diagnostics. That model is appropriate for semantic discovery, but `@asyncapi/parser` builds it from a resolved graph, adds `x-parser-*` metadata, and restores recursive references as shared JavaScript identities. Consequently, a plugin cannot serialize the model or reliably reconstruct the authored `$ref` graph.

Parser 3.6.0 also returns `extras.document`, a Spectral `Document` whose `data` and `source` describe the validated input before resolved model construction. Core currently discards this value. Exposing the Spectral object would leak an unstable parser implementation type, while copying its data at the Core boundary gives plugins a stable unresolved source without changing the model they already consume.

The first concrete consumer is a JSON Schema output plugin. The selected delivery is intentionally narrower than a universal generation model: it exports named `components.schemas` to one Draft 07 bundle. This proves source preservation, recursive reference handling, deterministic artifacts, and reusable plugin packaging before message roots or other output languages expand the shared architecture.

The change crosses Core, CLI source loading, a new package, and test fixtures. It adds Ajv dependencies and processes identifiers and references, so the implementation choices need to be fixed before code is written.

## Goals / Non-Goals

**Goals:**

- Preserve unresolved validated source data and source identity in a parser-independent, immutable Core contract.
- Export every named component schema from AsyncAPI 2.6, 3.0, and 3.1 into one self-contained Draft 07 bundle.
- Preserve supported schema semantics, authored metadata, local reference sharing, and recursion.
- Fail before artifact return when formats, dialects, identifiers, references, or generated schemas are unsafe or invalid.
- Make output byte-deterministic and validate every exported root with Ajv.
- Establish a documented plugin-owned fixture corpus with case-local inputs, expected artifact trees, validation instances, and expected errors.
- Verify consumer configuration, config discovery, pipeline execution, and artifact persistence with a package-owned integration fixture.
- Keep package ownership and dependency direction explicit within the existing pnpm and Nx workspace.

**Non-Goals:**

- Export message payloads, message headers, channel parameters, operations, replies, or anonymous nested schemas as public roots.
- Define a shared schemas/messages/channels/operations generation model for TypeScript, Zod, SDK, or documentation plugins.
- Emit one file per component or derive filenames from component keys.
- Convert Avro, OpenAPI, Protobuf, RAML, or custom formats into JSON Schema.
- Resolve external file or network references or copy parser resolver credentials into plugin configuration.
- Migrate to JSON Schema 2019-09 or 2020-12.
- Change plugin ordering, artifact persistence, CLI cleanup, package release, or unrelated root artifacts.

## Decisions

### Core exposes an optional Opalesce-owned source snapshot

Core adds readonly JSON value types and a source shape equivalent to:

```ts
interface AsyncAPISource {
  readonly data: JsonValue;
  readonly uri?: string;
}
```

`ParsedAsyncAPI`, `PluginContext`, and `PipelineResult` expose `source?: AsyncAPISource`. For raw string or object input, Core copies `output.extras.document.data`, normalizes the nullable Spectral source to `string | undefined`, recursively freezes the copy, and passes the same source identity through one run. The copy is necessary because the public value must not alias caller input or parser-owned objects.

For an existing `AsyncAPIDocumentInterface` input, source remains absent. Reconstructing source from `document.json()` was rejected because it would present resolved and possibly cyclic data as though it were authored input. Making source required was rejected because Core already accepts parsed document inputs for use cases that do not need reference preservation.

The CLI adds the absolute input file URL to `parse.source` when configuration has not supplied a source. Explicit configuration remains authoritative because callers may deliberately choose another resolution base.

### The new package owns JSON Schema interpretation

The Nx project lives at `packages/plugin-json-schema` with package name `@opalesce/plugin-json-schema`. It depends on `@opalesce/core` for plugin contracts and on direct `ajv` and `ajv-formats` runtime dependencies. Core does not depend on the plugin, Ajv, or JSON Schema generation code.

The package exports only a default plugin factory, so each consumer chooses its local import name. Its optional `outputPath` property remains visible through the factory parameter, while the plugin name, error class, error-code union, and construction details remain internal. Internal modules separate source extraction, format recognition, reference rewriting, identifier indexing, validation, and stable serialization. This keeps the plugin independently testable without adding a generalized abstraction to Core for one consumer or committing consumers to implementation-specific diagnostics.

Putting the implementation in `@opalesce/core` was rejected because artifact formats are plugin concerns. Extending the smoke fixture was rejected because the feature needs a reusable plugin factory, direct dependencies, fixtures, and actionable failure behavior.

### The plugin emits a fixed bundle shape

The plugin returns exactly one artifact. `outputPath` defaults to `schemas.json`; a configured path is passed unchanged to the existing Core artifact validator. The plugin does not implement duplicate path or traversal checks itself.

The JSON document has this logical shape:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "ComponentName": {}
  }
}
```

The bundle does not synthesize or accept configuration for a root `$id`. Definition keys are the exact authored component keys. A document with no component schemas still produces one valid bundle with empty `definitions`, which makes plugin execution observable and keeps the artifact count stable.

Only raw `components.schemas` entries are roots. AsyncAPI 3 Multi Format wrappers are unwrapped after their `schemaFormat` is checked. AsyncAPI-native and explicit Draft 07 schemas enter the same bundle representation. Message payloads and other schema-bearing locations remain excluded even when the parser model discovers them.

### Reference rewriting is deliberately limited and does not dereference

The plugin recursively copies each selected schema and rewrites fragment pointers rooted at `#/components/schemas/` to `#/definitions/`. It never expands a `$ref`, so self-recursive, mutually recursive, and repeated references remain serializable and share one target definition.

When a component-local reference appears inside a schema resource with an authored `$id`, a fragment-only rewritten reference would resolve against that embedded resource instead of the bundle root. The plugin rejects that reference rather than adding a configurable root identifier or returning a reference whose target changed silently.

All `$ref` values are indexed with their source JSON Pointer. After definitions and authored identifiers are indexed, every reference must resolve to an embedded resource. Missing component targets and fragment pointers outside the exported root set fail. File, HTTP, and other external resources are never loaded. URI references that resolve to an authored `$id` already embedded in the bundle may compile normally; all unresolved URI references fail before return.

Using `@apidevtools/json-schema-ref-parser` was considered. Its bundle mode is useful when external resources must be loaded, but the first delivery intentionally forbids external loading and only changes one known document-local prefix. A direct structural rewrite has a smaller security and dependency surface. Its dereference mode is explicitly unsuitable because recursive schemas would produce cyclic JavaScript graphs.

### Draft 07 is the only output dialect

The bundle root always declares Draft 07. AsyncAPI-native Schema Objects are treated as the AsyncAPI-supported Draft 07 superset; supported AsyncAPI annotations remain present and are registered with Ajv as known annotation keywords. An explicit Draft 07 Multi Format Schema Object contributes its inner schema.

An authored component `$schema` is preserved only when it declares Draft 07. Any conflicting dialect is a generation error. Newer dialects are not rewritten because array keywords, dependencies, reference siblings, and vocabulary processing differ. Foreign `schemaFormat` values fail with their exact format and component pointer instead of invoking hidden converters.

The parser 3.6.0 boolean-wrapper defect is bypassed by recognizing `{ schemaFormat, schema: false }` from the unresolved source rather than asking the resolved schema model to classify it.

### Identifiers are preserved, never inferred

Component keys remain logical definition names and are never synthesized into `$id`. Absolute authored identifiers are preserved. A relative authored identifier resolves only when nested under an absolute authored identifier; otherwise generation fails because the bundle has no configured or synthesized resolution base. Duplicate resolved resource identifiers fail with both source pointers.

Adding a default or configurable bundle identifier was rejected because it expands the factory interface and silently changes the base of relative references. Consumers that require a published root `$id` need a separate contract rather than an incidental generator option.

### Ajv validates both structure and reference closure

The package uses the main Ajv Draft 07 class. It registers `ajv-formats`, known AsyncAPI annotations, and supported AsyncAPI format names without disabling strict checking globally. Generation performs two checks:

1. Validate the complete bundle against the Draft 07 meta-schema.
2. Compile a small root `$ref` for every `definitions` entry after adding the bundle to Ajv.

Meta-schema validation catches invalid keyword shapes. Per-root compilation proves that every exported contract closes over its references, including recursion. Ajv asynchronous loading is not configured, so validation cannot trigger network or filesystem access.

Disabling Ajv strict checks was rejected because it would hide misspelled or unsupported keywords. Depending on the parser's transitive Ajv installation was rejected because plugin validation behavior must not change with an unrelated parser dependency graph.

### Stable serialization is part of the artifact contract

The serializer recursively sorts all object keys lexicographically, including root keys, preserves array order, uses two-space indentation, and appends exactly one newline. It does not sort arrays because order is significant for examples and composition keywords.

Plain `JSON.stringify` over the constructed object was rejected because source insertion order could vary between equivalent object and YAML inputs. Serializing the parser model was rejected because recursion can make it throw and parser-owned metadata would leak.

### Errors use internal codes and source JSON Pointers

The internal `JsonSchemaGenerationError` carries a code, a source JSON Pointer, and code-specific details such as `schemaFormat`, `$ref`, identifier, or Ajv errors. Core continues to wrap the original error in the existing plugin execution error with the configured plugin name. Keeping the diagnostic types internal avoids expanding the package interface while retaining precise conformance checks and actionable failure messages. The source pointer is stable across YAML and JSON and does not require Spectral range types in the public interface.

The first code set covers source unavailability, unsupported AsyncAPI versions, unsupported formats and references, unresolved references, dialect conflicts, invalid and duplicate identifiers, and invalid Draft 07 output. Line and column ranges are deferred because exposing or translating parser range data is not necessary for an actionable first contract.

### The conformance corpus is case-local and pipeline-first

The plugin owns its corpus under `packages/plugin-json-schema/test/fixtures/corpus/cases`. Each case is one directory containing:

- `case.json` with the AsyncAPI version, feature tags, input filename, and expected outcome;
- the raw AsyncAPI input;
- for success, an `expected/` tree whose relative paths are the expected returned artifact paths;
- optional valid/invalid instance files next to that case.

The suite discovers case directories instead of maintaining one global file index. Success cases execute raw fixture text through `run({ input, plugins: [jsonSchema()] })`, then compare the entire returned artifact array against the files under `expected/` by path and exact bytes. Running each success twice also proves determinism across parsing, orchestration, and generation rather than only inside the plugin factory. Failure inputs that the AsyncAPI parser rejects before plugin execution use a controlled `PluginContext` with the case's unresolved source snapshot so plugin-specific error semantics remain testable. A focused integration test separately proves that Core wraps an internal plugin failure with the plugin name and original cause.

Success cases cover version structure, native and wrapped schemas, booleans, used and unused components, annotations, recursion, repeated refs, absolute identifiers, inline payload exclusion, and ordering. Failure cases cover every internal generation error, including disabled file and HTTP references. Corpus validation rejects non-directory entries, missing expected artifacts, and any input, artifact, instance, or case file not owned by its local metadata.

Core keeps focused source-snapshot fixtures under its own tests. The larger generation corpus stays inside the plugin project so Nx test caching, package ownership, and fixture changes share the same project boundary. A shared cross-plugin harness is deferred until a second output plugin proves which parts are genuinely common.

### Consumer configuration integration follows each plugin package

The JSON Schema package owns one `test/fixtures/config` directory with a consumer-style `opalesce.config.ts`, AsyncAPI input, and expected persisted artifact. Its integration test discovers that config in place, overrides only the output root to a temporary directory, calls the public `@opalesce/cli` command API, and compares the written artifact bytes. The config imports `defineConfig` from `opalesce` and the plugin factory from `@opalesce/plugin-json-schema`, so the test covers the same package entry points shown in consumer documentation without writing generated output into the fixture.

`@opalesce/cli` and `opalesce` are test-only development dependencies of the plugin package. They do not enter its runtime dependency or published artifact surface. Nx `check` builds the dependency graph before Vitest, ensuring that the consumer imports exercise current package outputs. Existing CLI and facade tests continue to own generic config formats, argument handling, and binary wrappers; the plugin integration test owns only its configured generation outcome.

The repository-global `fixtures/smoke` directory and `just generate` command are removed. A single shared teaching config cannot represent independent plugin inputs, options, and artifacts, duplicates package tests, and encourages unrelated plugin dependencies at the workspace root. Future reusable plugins should own an equivalent focused config fixture rather than extending a global scenario.

## Risks / Trade-offs

- [The parser removes or changes `extras.document` in a future version] -> Keep access isolated in `parseAsyncAPI`, cover unresolved refs and source URI with pin-sensitive tests, and expose only the Opalesce-owned copy.
- [Deep copying and freezing duplicates a large source document] -> Pay the cost once per pipeline run, share one snapshot across plugins, and benchmark before adding lazy snapshots or alternate representations.
- [A valid AsyncAPI-native keyword is unknown to strict Ajv] -> Maintain an explicit keyword and format registration list with fixtures; do not hide the failure by disabling strict mode globally.
- [A reference is valid in the original AsyncAPI document but points outside `components.schemas`] -> Fail with `UNSUPPORTED_REFERENCE`; broadening the root registry requires the separate generation-model change.
- [External references parsed successfully but cannot be emitted] -> Report the deliberate plugin limitation before return; a later resolver-aware design must align parser and emitter policies instead of silently resolving twice.
- [Recursive schemas break naive traversal] -> Traverse raw JSON with an explicit visited-path strategy and preserve `$ref` values rather than following them.
- [Stable key sorting changes authored presentation order] -> Treat JSON object order as non-semantic and preserve all array order and values; document byte determinism as the stronger artifact contract.
- [The fixture matrix becomes expensive] -> Use one case-discovered parameterized suite, keep fixtures minimal, and separate full artifact checks from targeted instance validation.

## Migration Plan

1. Add Core readonly JSON source types, capture and freeze raw parser extras, and propagate the optional source through parsing, plugin contexts, and pipeline results.
2. Update CLI parsing to supply the input file URL when no source is configured, then extend Core and CLI type and runtime tests.
3. Scaffold `packages/plugin-json-schema` with the existing pnpm, TypeScript, Vitest, ESLint, oxfmt, and inferred Nx conventions.
4. Implement extraction, dialect checks, local reference rewriting, identifier handling, structured internal errors, Ajv validation, and serialization.
5. Add the case-local fixture corpus and pipeline-first artifact/instance/error conformance suite.
6. Add the default package export, package documentation, a package-owned consumer config fixture, and exact CLI persistence integration coverage.
7. Remove the repository-global smoke fixture and command, then run focused Core, CLI, plugin, and complete workspace validation.

Rollback removes the plugin package and its fixtures, reverts CLI source injection, and removes the additive optional source fields from Core. No persisted data, generated artifact migration, or compatibility adapter is required because package publication is outside this change.

## Open Questions

None. Message roots, a cross-generator model, external resolver policy, and per-schema files require separate specifications rather than implementation-time expansion of this change.
