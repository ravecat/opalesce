# Plugin Source Document Specification

## Purpose

Define the immutable unresolved AsyncAPI source snapshot and source identity exposed to plugins alongside the parsed model.

## Requirements

### Requirement: Raw parsing retains an unresolved source snapshot

Core SHALL expose an optional `source` value on `ParsedAsyncAPI`, `PluginContext`, and `PipelineResult`. When parsing raw text or object input, `source.data` MUST be an Opalesce-owned JSON-compatible snapshot of the validated source before reference resolution and parser model construction.

#### Scenario: Preserve authored references from text input

- **WHEN** Core parses valid AsyncAPI text containing a local `$ref`
- **THEN** the parsed model remains available through `document`
- **AND** `source.data` contains the authored `$ref` string rather than the resolved target object

#### Scenario: Preserve boolean schemas from object input

- **WHEN** Core parses a JavaScript object containing `true` or `false` component schemas
- **THEN** `source.data` retains those boolean values without coercing them to objects

#### Scenario: Do not alias caller-owned input

- **WHEN** a caller mutates an object input after parsing succeeds
- **THEN** the retained `source.data` does not change

### Requirement: Source identity is retained when known

Core SHALL expose the parser source URI as `source.uri` when the caller supplies one. The CLI SHALL provide the absolute input file URL as the parser source unless the resolved parser configuration explicitly supplies a source URI.

#### Scenario: Direct caller supplies a source URI

- **WHEN** a caller parses raw input with `parse.source` set to an absolute URI
- **THEN** `source.uri` equals that URI

#### Scenario: CLI parses a configured input file

- **WHEN** the CLI reads an AsyncAPI input file and no explicit parser source is configured
- **THEN** every plugin receives that input file's absolute file URL in `source.uri`

#### Scenario: Explicit CLI parser source remains authoritative

- **WHEN** CLI configuration supplies an explicit parser source URI
- **THEN** Core retains that configured URI instead of replacing it with the input file URL

### Requirement: Source snapshots are immutable shared run input

Core SHALL recursively freeze the source snapshot and SHALL provide the same source object identity to every configured plugin in one pipeline run.

#### Scenario: Plugins inspect one source snapshot

- **WHEN** two plugins run for the same raw input
- **THEN** both plugin contexts reference the same `source` object
- **AND** attempts to add, replace, or remove nested source values fail

#### Scenario: Pipeline results expose the retained source

- **WHEN** a pipeline run succeeds for raw input
- **THEN** `PipelineResult.source` is the same immutable snapshot supplied to its plugins

### Requirement: Source availability is explicit

Core MUST NOT reconstruct a purported unresolved source from an already parsed AsyncAPI model. When the input is an existing parser document and no unresolved snapshot accompanies it, `source` SHALL be `undefined`.

#### Scenario: Run from an existing parsed document

- **WHEN** a caller supplies an existing AsyncAPI document as pipeline input
- **THEN** parsing preserves that document
- **AND** `source` is `undefined`

#### Scenario: A source-dependent plugin receives no snapshot

- **WHEN** a plugin that requires unresolved source runs with `source` undefined
- **THEN** the plugin can fail with a source-unavailable error instead of inspecting a dereferenced cyclic graph

### Requirement: Public source types do not expose parser internals

The public Core source contract SHALL contain only readonly JSON-compatible data and an optional URI string. It MUST NOT expose Spectral `Document`, parser `extras`, resolver instances, or mutable parser-owned values.

#### Scenario: Compile against the Core type contract

- **WHEN** a TypeScript consumer imports the source types from `@opalesce/core`
- **THEN** it can read readonly JSON data and the optional URI
- **AND** parser-internal Spectral fields are not part of the exported contract
