## Why

Opalesce plugins can inspect a parsed AsyncAPI model, but they cannot faithfully emit schema artifacts because the model is dereferenced, may contain cycles, and no longer preserves the authored `$ref` graph. A reusable JSON Schema output plugin needs a stable ref-preserving Core input and a tested artifact contract before additional schema and code generators independently invent incompatible extraction rules.

The first implementation proved that contract with one `definitions` bundle. Pre-publication review found that the bundle is the wrong consumer layout: named component schemas are intended to be independently usable generated resources, and Draft 07 forbids `$schema` inside the subschemas of a shared document. The active change therefore owns the correction to one file per named component before the package is published.

## What Changes

- Extend the Core plugin context with an immutable Opalesce-owned snapshot of the unresolved AsyncAPI source and its source URI, without exposing parser-internal Spectral types.
- Add a focused `@opalesce/plugin-json-schema` package whose sole public export is a default plugin factory that emits one standalone Draft 07 artifact per named `components.schemas` entry plus one index schema.
- Treat `outputPath` as an artifact directory, default it to `schemas`, and use each safe component key as `<Component>.schema.json` without silently sanitizing or renaming it.
- Reject non-portable component names, names that collide with `index.schema.json`, and case-insensitive or Unicode-normalized filename collisions before returning artifacts.
- Support AsyncAPI-native Schema Objects and explicit JSON Schema Draft 07 Multi Format Schema Objects, including object and boolean schemas.
- Rewrite document-local component references into relative generated-file references while preserving authored identifiers, annotations, examples, and non-parser extensions.
- Reject unsupported schema formats, conflicting dialect declarations, unresolved or out-of-scope references, duplicate schema resource identifiers, and external file or HTTP references with actionable source locations.
- Validate every generated resource and the completed index against the Draft 07 meta-schema, then compile every exported component root with direct Ajv and `ajv-formats` dependencies before returning artifacts.
- Emit deterministic UTF-8 JSON with a trailing newline through the existing artifact-return contract, leaving persistence and final path-collision enforcement in Core and the CLI.
- Add a plugin-owned AsyncAPI conformance corpus whose self-contained cases cover supported versions, schema shapes, reference graphs, identifiers, filename safety, dialect failures, unsupported formats, excluded inline payloads, and deterministic output. Successful cases run through the public pipeline with the plugin installed and compare the complete returned artifact set byte-for-byte.
- Add a plugin-owned consumer configuration fixture that imports the package factory, runs through the public CLI API, persists artifacts in a temporary directory, and compares them with package-local expectations.
- Remove the repository-global teaching smoke fixture and its root command so integration coverage follows each reusable plugin package instead of accumulating in one shared scenario.
- Defer message payload and header roots, channel parameters, an optional single-file bundle mode, foreign-format conversion, external reference resolution, a shared cross-generator model, package publication, and migration of unrelated root artifacts to separate changes.

## Capabilities

### New Capabilities

- `plugin-source-document`: Provides plugins with immutable unresolved AsyncAPI source data and source identity alongside the parsed discovery model.
- `json-schema-component-output`: Defines reusable standalone Draft 07 generation from named AsyncAPI component schemas, including filenames, cross-file references, validation, diagnostics, determinism, and conformance fixtures.

### Modified Capabilities

None.

## Impact

- Adds an additive public input contract to `@opalesce/core` parsing, pipeline results, and plugin context types.
- Adds the focused Nx package `packages/plugin-json-schema` published under the workspace name `@opalesce/plugin-json-schema` when release work is later authorized.
- Adds direct package dependencies for Draft 07 validation and formats; reference transformation remains limited to document-local component pointers in this change.
- Extends Core and plugin tests plus a case-local plugin fixture corpus for AsyncAPI 2.6, 3.0, and 3.1 documents.
- Updates package exports, type-contract tests, README examples, and test-only plugin dependencies on the CLI and facade used by the package-owned integration fixture.
- Replaces the unpublished one-bundle implementation and expected artifacts rather than preserving compatibility with it.
- Removes the global smoke fixture, its root generation command, and the root facade dependency that existed only to run that fixture.
- Does not change artifact persistence, CLI output ownership, plugin ordering, or the existing parsed AsyncAPI model API.
