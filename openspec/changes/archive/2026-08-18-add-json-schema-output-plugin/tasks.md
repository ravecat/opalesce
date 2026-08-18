## 1. Core Source Document Contract

- [x] 1.1 Add exported readonly JSON value and optional AsyncAPI source types, plus a recursive copy-and-freeze utility that rejects non-JSON-compatible parser extras.
- [x] 1.2 Capture unresolved `extras.document.data` and normalized source URI in `parseAsyncAPI`, while leaving source absent for existing parsed-document input.
- [x] 1.3 Propagate the same immutable source identity through `PluginContext` and `PipelineResult` without changing parsed document or diagnostic identities.
- [x] 1.4 Add Core runtime tests for preserved `$ref`, boolean schemas, caller-input isolation, recursive immutability, shared plugin identity, source absence, and parser-version edge behavior.
- [x] 1.5 Update Core public export and TypeScript contract tests to prove the readonly source API is available and Spectral/parser internals are not exported.

## 2. CLI Source Identity

- [x] 2.1 Merge the absolute input file URL into CLI parser options only when `parse.source` is not explicitly configured.
- [x] 2.2 Add CLI tests for derived file URLs, explicit source precedence, parser option preservation, and unchanged output persistence behavior.

## 3. JSON Schema Plugin Package Foundation

- [x] 3.1 Scaffold `packages/plugin-json-schema` with the workspace package metadata, project configuration, TypeScript configs, Vitest config, license, changelog, source entry point, and check scripts used by sibling packages.
- [x] 3.2 Add direct `@opalesce/core`, Ajv, and `ajv-formats` dependencies and update the pnpm lockfile without adding parser or external-reference resolver dependencies.
- [x] 3.3 Export only the default typed plugin factory with an optional `outputPath`, inline the plugin name, and keep generation diagnostics internal.
- [x] 3.4 Add package export and type-contract tests for the default-only interface, default output, configured output, and stable plugin name inference.

## 4. Bundle Extraction and Transformation

- [x] 4.1 Implement validated raw-source discovery for AsyncAPI 2.6, 3.0, and 3.1 `components.schemas`, including native, explicit Draft 07, object, and boolean schema classification, with an explicit unsupported-version error.
- [x] 4.2 Build the fixed Draft 07 bundle without a configurable root `$id`, with exact component keys, empty definitions support, and exclusion of payload, header, parameter, and nested anonymous roots.
- [x] 4.3 Implement structural copying that removes only `x-parser-*`, preserves other annotations and extensions, and unwraps supported Multi Format Schema Objects including `schema: false`.
- [x] 4.4 Rewrite local component pointers to bundle definitions, reject unsafe rewrites under authored `$id` scopes, and verify missing, out-of-scope, and external references fail without filesystem or network access.
- [x] 4.5 Index absolute authored schema resources, resolve nested relative identifiers only from authored absolute ancestors, and detect unresolved or duplicate identifiers with source pointers.
- [x] 4.6 Implement stable recursive object-key serialization with preserved array order, two-space JSON indentation, and exactly one trailing newline.

## 5. Bundle Validation and Failure Semantics

- [x] 5.1 Configure a strict Draft 07 Ajv instance with `ajv-formats` plus the supported AsyncAPI annotation keywords and format registrations.
- [x] 5.2 Validate the complete bundle against the meta-schema and compile every definition root, including repeated, self-recursive, and mutually recursive references.
- [x] 5.3 Map source, format, dialect, reference, identifier, and Ajv failures to internal `JsonSchemaGenerationError` codes, JSON Pointers, and code-specific details without a configurable-base error.
- [x] 5.4 Add focused unit tests proving invalid output is never returned and Core preserves the original internal generation error as the cause of its existing plugin execution error.

## 6. AsyncAPI Specification Fixture Corpus

- [x] 6.1 Maintain `packages/plugin-json-schema/test/fixtures/corpus` with documented machine-readable case metadata, a typed loader, file-existence checks, and orphan fixture/artifact detection.
- [x] 6.2 Add supported-version fixtures for AsyncAPI 2.6, 3.0, and 3.1 native components plus explicit Draft 07 Multi Format components.
- [x] 6.3 Add success fixtures and expected artifacts for true and false schemas, used and unused components, annotations and non-parser extensions, absolute identifiers, inline payload exclusion, empty components, and source key-order normalization.
- [x] 6.4 Add success fixtures and validation instances for local, repeated, self-recursive, and mutually recursive references, proving positive and negative instance behavior for every declared root.
- [x] 6.5 Add failure fixtures for unavailable source, unsupported AsyncAPI versions and formats, conflicting dialects, missing and out-of-scope local refs, identifier-scoped refs, file and HTTP refs, relative and duplicate IDs, and invalid Draft 07 keyword values.
- [x] 6.6 Implement one parameterized conformance suite that verifies artifact bytes, instance results, error codes, error pointers, case metadata completeness, and repeated-run determinism for the entire corpus.

## 7. Consumer Documentation and Integration

- [x] 7.1 Document the default-only factory interface, installation, supported AsyncAPI versions and formats, default bundle shape, output option, exclusions, reference policy, failure behavior, and a minimal config example in the plugin README.
- [x] 7.2 Update Core and CLI documentation for optional unresolved source and source URI behavior, including the limitation for existing parsed-document input.
- [x] 7.3 Cover the JSON Schema plugin's public pipeline artifact contract in package-owned fixtures instead of a repository-global smoke configuration.

## 8. Validation

- [x] 8.1 Run focused `check` targets for `@opalesce/core`, `@opalesce/cli`, and `@opalesce/plugin-json-schema`, then fix all type and test failures.
- [x] 8.2 Run ESLint and oxfmt checks for all changed source, fixture metadata, documentation, and OpenSpec files.
- [x] 8.3 Run `just check`, confirming the complete workspace passes while repeated plugin generation bytes are verified by the package corpus.

## 9. Pipeline-first Plugin Conformance Follow-up

- [x] 9.1 Replace the type-grouped corpus directories and global manifest with self-contained case directories containing local metadata, input, expected artifact tree, and optional instances.
- [x] 9.2 Refactor the typed corpus loader to discover cases, derive expected artifact paths from each local tree, and reject unregistered directories, missing artifacts, and orphan case files.
- [x] 9.3 Run every successful corpus case twice through the public Core pipeline with `jsonSchema()` installed, compare the complete artifact set by path and exact bytes, and retain direct plugin-boundary execution only for parser-incompatible failure fixtures.
- [x] 9.4 Remove JSON Schema conformance coupling from the global smoke fixture, update corpus documentation, and run focused formatting, type checking, and tests for `@opalesce/plugin-json-schema`.

## 10. Package-owned Toolchain Integration Follow-up

- [x] 10.1 Add a JSON Schema package fixture whose TypeScript config imports the facade and package factory, installs only `jsonSchema()`, and keeps its AsyncAPI input and expected persisted artifact local.
- [x] 10.2 Add a plugin integration test that runs the fixture through the public CLI API in a temporary directory and verifies exit output, artifact count, configured path, exact bytes, and repository isolation.
- [x] 10.3 Add only test-time CLI and facade dependencies to the plugin package, remove `fixtures/smoke`, `just generate`, the obsolete root facade dependency, and stale current documentation references.
- [x] 10.4 Run focused Nx checks for the plugin and affected toolchain packages, formatting, lint, strict OpenSpec validation, and diff checks.

## 11. Test Harness Simplification Follow-up

- [x] 11.1 Inline one-use proxy helpers and intermediate values in the corpus, conformance, and config integration tests while preserving metadata validation, pipeline coverage, deterministic artifact comparison, and cleanup behavior.
- [x] 11.2 Run focused plugin checks, formatting, lint, strict OpenSpec validation, and diff checks.

## 12. Per-component Artifact Contract Correction

- [x] 12.1 Replace the unpublished bundle proposal, design, and delta specification with standalone component artifacts, a schema index, portable filename rules, relative cross-file references, and root-only Draft 07 declarations.
- [x] 12.2 Update focused unit, public type-contract, plugin integration, and conformance tests to require one index plus one artifact per named component and to cover filename failures.
- [x] 12.3 Replace bundle assembly and validation with deterministic component planning, cross-file reference rewriting, index generation, and in-memory multi-resource Ajv compilation.
- [x] 12.4 Replace package-owned expected artifact trees and documentation with the per-component consumer contract.
- [x] 12.5 Run focused package checks, formatting, lint, strict OpenSpec validation, the full workspace check, and final diff review.
