## ADDED Requirements

### Requirement: A reusable plugin emits one Draft 07 bundle

`@opalesce/plugin-json-schema` SHALL expose a default typed plugin factory as its sole public export. The factory SHALL return one artifact containing a JSON Schema Draft 07 bundle. The artifact path SHALL default to `schemas.json` and MAY be replaced by one configured relative output path that remains subject to Core artifact path validation.

#### Scenario: Inspect the package interface

- **WHEN** a consumer imports the package entry point
- **THEN** the default factory is its only exported symbol
- **AND** the plugin option shape, plugin name, and generation error types are not independently importable

#### Scenario: Generate with default options

- **WHEN** the plugin processes a supported AsyncAPI document with default options
- **THEN** it returns exactly one artifact at `schemas.json`
- **AND** the artifact is a JSON object with `$schema` equal to `http://json-schema.org/draft-07/schema#`
- **AND** the artifact contains a `definitions` object

#### Scenario: Generate to a configured path

- **WHEN** the plugin is configured with a valid relative output path
- **THEN** its single artifact uses that path

#### Scenario: Generate without component schemas

- **WHEN** the document has no named `components.schemas`
- **THEN** the plugin emits a valid bundle whose `definitions` object is empty

### Requirement: Only named component schemas are bundle roots

The plugin SHALL export every named `components.schemas` entry and MUST NOT promote message payloads, message headers, channel parameters, or nested anonymous schemas to top-level definitions in this change.

#### Scenario: Export used and unused component schemas

- **WHEN** `components.schemas` contains both referenced and unreferenced entries
- **THEN** every named entry appears under the same component key in `definitions`

#### Scenario: Exclude an inline message payload

- **WHEN** a document contains an inline message payload but no named component schema for that payload
- **THEN** the payload does not become a definition

#### Scenario: Keep nested schemas inside their owner

- **WHEN** a component contains property, item, or composition subschemas
- **THEN** those schemas remain nested within the component definition and do not receive independent generated names

### Requirement: Supported schema dialects retain their semantics

The plugin SHALL support AsyncAPI-native Schema Objects and explicit JSON Schema Draft 07 Multi Format Schema Objects in AsyncAPI 2.6, 3.0, and 3.1 source documents. Object and boolean schemas MUST be accepted. Unsupported formats and conflicting `$schema` declarations MUST fail generation rather than being converted implicitly.

#### Scenario: Export an AsyncAPI-native object schema

- **WHEN** a supported document contains an AsyncAPI-native object component schema
- **THEN** the corresponding Draft 07 definition preserves its validation keywords and annotations

#### Scenario: Export an explicit Draft 07 schema

- **WHEN** a Multi Format Schema Object declares JSON Schema Draft 07
- **THEN** the inner schema becomes the corresponding bundle definition
- **AND** the Multi Format wrapper does not appear in the definition

#### Scenario: Export boolean schemas

- **WHEN** named components are exactly `true` and `false`, including a Multi Format wrapper whose schema is `false`
- **THEN** the bundle retains the exact boolean definitions

#### Scenario: Reject an unsupported AsyncAPI version

- **WHEN** the source document declares a version other than AsyncAPI 2.6, 3.0, or 3.1
- **THEN** generation fails with code `UNSUPPORTED_ASYNCAPI_VERSION`
- **AND** the failure identifies the declared version at `/asyncapi`

#### Scenario: Reject a foreign format

- **WHEN** a component declares Avro, OpenAPI, Protobuf, RAML, or an unknown schema format
- **THEN** generation fails with code `UNSUPPORTED_SCHEMA_FORMAT`
- **AND** the failure identifies the declared format and component source pointer

#### Scenario: Reject a conflicting dialect declaration

- **WHEN** `schemaFormat` declares Draft 07 but the inner `$schema` declares a different dialect
- **THEN** generation fails with code `DIALECT_CONFLICT`
- **AND** the failure identifies the component source pointer

### Requirement: Bundle references remain serializable and self-contained

The plugin SHALL build from the unresolved source snapshot, SHALL rewrite document-local `#/components/schemas/...` references to the corresponding `#/definitions/...` locations, and SHALL preserve repeated, self-recursive, and mutually recursive reference semantics without dereferencing object graphs. Every emitted reference MUST resolve within the completed bundle.

#### Scenario: Rewrite a local component reference

- **WHEN** one component references another through `#/components/schemas/Address`
- **THEN** the emitted reference points to `#/definitions/Address`

#### Scenario: Preserve self recursion

- **WHEN** a component references itself
- **THEN** generation succeeds without a circular serialization failure
- **AND** the emitted self-reference resolves to that component definition

#### Scenario: Preserve mutual recursion and repeated references

- **WHEN** components reference one another or reuse the same target from several locations
- **THEN** each authored use remains a reference to one shared definition

#### Scenario: Reject an identifier-scoped component reference

- **WHEN** a component-local reference appears inside a schema resource with an authored `$id`
- **THEN** generation fails with code `UNSUPPORTED_REFERENCE`
- **AND** the failure explains that the reference cannot be rewritten without changing its resolution scope

#### Scenario: Reject a missing local target

- **WHEN** a component reference points to a component schema that is absent
- **THEN** generation fails with code `UNRESOLVED_REFERENCE`
- **AND** the failure identifies the reference value and source pointer

#### Scenario: Reject a reference outside the exported root set

- **WHEN** a component schema references an AsyncAPI location outside `components.schemas`
- **THEN** generation fails with code `UNSUPPORTED_REFERENCE`
- **AND** the plugin does not silently add that location to the bundle

#### Scenario: Reject an unresolved external reference without loading it

- **WHEN** a component contains a file, HTTP, or other reference that does not resolve to an embedded schema resource
- **THEN** generation fails with code `UNSUPPORTED_REFERENCE`
- **AND** the plugin performs no network or filesystem read

### Requirement: Authored identifiers and extensions are handled safely

The plugin SHALL preserve absolute authored `$id` values, descriptions, examples, supported AsyncAPI annotations, and extensions other than parser-reserved `x-parser-*` fields. It MUST NOT derive or configure a bundle root `$id` from component keys or plugin options. Relative authored identifiers MUST resolve from an absolute authored ancestor or fail generation.

#### Scenario: Preserve authored metadata

- **WHEN** a component contains `$id`, description, examples, annotations, and a custom `x-domain` extension
- **THEN** those values survive in the emitted definition
- **AND** the component key is not written as a synthesized `$id`

#### Scenario: Remove parser-reserved metadata

- **WHEN** source schema data contains an `x-parser-*` field
- **THEN** no `x-parser-*` field appears in the bundle
- **AND** unrelated `x-*` extensions remain

#### Scenario: Reject a relative identifier without an authored base

- **WHEN** a component declares a relative `$id` without an absolute authored ancestor
- **THEN** generation fails with code `INVALID_SCHEMA_ID`
- **AND** the failure identifies the component source pointer

#### Scenario: Reject duplicate schema resource identifiers

- **WHEN** two embedded schema resources resolve to the same absolute `$id`
- **THEN** generation fails with code `DUPLICATE_SCHEMA_ID`
- **AND** the failure identifies both source pointers

### Requirement: Generated bundles are validated before return

The plugin SHALL depend directly on Ajv and `ajv-formats`, validate the completed document against the Draft 07 meta-schema, register the supported AsyncAPI annotation keywords and formats, and compile a `$ref` root for every exported definition. The plugin MUST NOT return an artifact whose schema or references fail validation or compilation.

#### Scenario: Compile every exported root

- **WHEN** all exported components are valid and all references resolve
- **THEN** Ajv compiles every `#/definitions/<component>` root before the artifact is returned

#### Scenario: Reject an invalid Draft 07 schema

- **WHEN** a component contains an invalid Draft 07 keyword value
- **THEN** generation fails with code `INVALID_JSON_SCHEMA`
- **AND** the failure identifies the component source pointer and validator details

#### Scenario: Preserve instance validation behavior

- **WHEN** the fixture corpus supplies valid and invalid instances for an exported root
- **THEN** the compiled generated root accepts every declared valid instance
- **AND** it rejects every declared invalid instance

### Requirement: Serialization is deterministic

The plugin SHALL serialize bundles as UTF-8 compatible JSON with two-space indentation, stable lexicographic object-key ordering, array order preserved, no byte-order mark, and exactly one trailing newline. Repeated generation from the same semantic source and options MUST be byte-identical.

#### Scenario: Repeat one generation

- **WHEN** the same source and plugin options are processed more than once
- **THEN** every returned `contents` string is byte-identical

#### Scenario: Normalize source object key order

- **WHEN** semantically equivalent object inputs differ only in object property insertion order
- **THEN** the generated bundle contents are byte-identical

### Requirement: Generation failures are actionable

The plugin SHALL internally classify generation failures with a code and source pointer that identify unavailable source, unsupported AsyncAPI versions, unsupported formats or references, identifiers, dialects, or invalid generated schemas. These diagnostics MUST remain available to package tests without becoming public exports. Core SHALL continue to attribute the original thrown cause to the configured plugin through its existing plugin execution error contract.

#### Scenario: Run without unresolved source

- **WHEN** the plugin receives a context whose `source` is undefined
- **THEN** generation fails with code `SOURCE_UNAVAILABLE`
- **AND** no artifact is returned

#### Scenario: Core attributes a plugin failure

- **WHEN** JSON Schema generation throws an internal generation error
- **THEN** the pipeline rejects with the existing plugin execution error naming the JSON Schema plugin
- **AND** its cause is the original generation error

### Requirement: A plugin-owned conformance fixture corpus covers the contract

The package SHALL include a documented AsyncAPI fixture corpus made of self-contained case directories. Every case MUST keep its machine-readable metadata, source input, complete expected artifact tree, and optional validation instances together. The metadata MUST identify the supported AsyncAPI version, feature tags, and either instance expectations or an expected error code and source pointer.

#### Scenario: Cover supported success cases

- **WHEN** the conformance suite discovers the case-local metadata
- **THEN** it covers AsyncAPI 2.6, 3.0, and 3.1 native schemas, explicit Draft 07 wrappers, true and false schemas, unused components, annotations and extensions, local repeated references, self recursion, mutual recursion, absolute identifiers, inline payload exclusion, and deterministic ordering

#### Scenario: Cover expected failure cases

- **WHEN** the conformance suite discovers the case-local metadata
- **THEN** it covers unavailable source, unsupported formats, conflicting dialects, missing and out-of-scope local references, identifier-scoped component references, disabled external file and HTTP references, relative and duplicate identifiers, and invalid Draft 07 schemas

#### Scenario: Verify successful case expectations

- **WHEN** a success case runs
- **THEN** Core runs the raw fixture input with the JSON Schema plugin installed through the public pipeline
- **AND** the complete returned artifact set matches the case's expected artifact tree by relative path and exact contents
- **AND** its declared valid and invalid instances produce the expected validation results

#### Scenario: Verify failed case expectations

- **WHEN** a failure case runs
- **THEN** its error code and source pointer match the local case metadata
- **AND** cases that the AsyncAPI parser cannot represent are exercised explicitly at the plugin source-snapshot boundary

#### Scenario: Prevent orphan fixtures

- **WHEN** an unregistered case directory or an unreferenced source, artifact, or instance file exists in the corpus
- **THEN** the conformance test fails

### Requirement: Consumer configuration integration follows the plugin package

The package SHALL own a consumer-style Opalesce configuration fixture that imports `defineConfig` from the facade and the JSON Schema factory from its package entry point. A package integration test MUST run that config through the public CLI API in an isolated temporary directory and compare every persisted artifact with package-local expected contents. Repository-global smoke fixtures and commands MUST NOT be the source of reusable plugin integration coverage.

#### Scenario: Generate from the package configuration fixture

- **WHEN** the JSON Schema package integration test runs its fixture config
- **THEN** config discovery loads the consumer-facing TypeScript config
- **AND** the config installs only the JSON Schema plugin factory
- **AND** the CLI reads the configured AsyncAPI input, runs the Core pipeline, and persists the configured artifact path
- **AND** the persisted artifact exactly matches the package-local expected artifact

#### Scenario: Keep integration isolated and repeatable

- **WHEN** the integration test completes or fails
- **THEN** generated output exists only in the test's temporary directory
- **AND** no repository fixture output is created or reused
