## ADDED Requirements

### Requirement: A reusable plugin emits standalone Draft 07 component artifacts

`@opalesce/plugin-json-schema` SHALL expose a default typed plugin factory as its sole public export. The factory SHALL return one standalone JSON Schema artifact per named component schema plus one index artifact. `outputPath` SHALL name an artifact directory and SHALL default to `schemas`.

#### Scenario: Inspect the package interface

- **WHEN** a consumer imports the package entry point
- **THEN** the default factory is its only exported symbol
- **AND** the plugin option shape, plugin name, and generation error types are not independently importable

#### Scenario: Generate with default options

- **WHEN** the plugin processes a supported document whose named components are `User` and `Article`
- **THEN** it returns `schemas/index.schema.json`, `schemas/Article.schema.json`, and `schemas/User.schema.json`
- **AND** the index precedes component artifacts
- **AND** component artifacts are ordered lexicographically by path

#### Scenario: Generate to a configured directory

- **WHEN** `outputPath` is `contracts/schemas`
- **THEN** every artifact path is rooted below `contracts/schemas`
- **AND** Core remains responsible for final canonical path validation

#### Scenario: Generate without component schemas

- **WHEN** the document has no named `components.schemas`
- **THEN** the plugin returns only a valid `schemas/index.schema.json` whose `definitions` object is empty

### Requirement: Component filenames are stable and portable

Each component artifact SHALL use its exact authored component key as the filename stem followed by `.schema.json`. The plugin MUST NOT silently sanitize or recase keys. It SHALL reject keys that cannot form a portable relative filename, conflict with the reserved index filename, or collide after NFC normalization and lowercase mapping.

#### Scenario: Preserve a safe component key

- **WHEN** a component key is `UserProfile`
- **THEN** its artifact is named `UserProfile.schema.json`

#### Scenario: Reject a non-portable component key

- **WHEN** a component key contains a path separator, control character, Windows-reserved character, trailing dot or space, or reserved device basename
- **THEN** generation fails with code `INVALID_COMPONENT_NAME`
- **AND** the failure identifies the component source pointer and key

#### Scenario: Reject an index collision

- **WHEN** a component key would produce `index.schema.json`
- **THEN** generation fails with code `COMPONENT_NAME_COLLISION`

#### Scenario: Reject a case-insensitive collision

- **WHEN** two component keys produce filenames equal after NFC normalization and lowercase mapping
- **THEN** generation fails with code `COMPONENT_NAME_COLLISION`
- **AND** the failure identifies both component source pointers

### Requirement: Only named component schemas are public roots

The plugin SHALL export every named `components.schemas` entry and MUST NOT promote message payloads, message headers, channel parameters, or nested anonymous schemas to independent files in this change.

#### Scenario: Export used and unused component schemas

- **WHEN** `components.schemas` contains referenced and unreferenced entries
- **THEN** every named entry receives one component artifact and one index entry

#### Scenario: Exclude an inline message payload

- **WHEN** a document contains an inline message payload but no named component schema for that payload
- **THEN** the payload receives no artifact or index entry

#### Scenario: Keep nested schemas inside their owner

- **WHEN** a component contains property, item, or composition subschemas
- **THEN** those schemas remain nested within the component artifact and do not receive independent names

### Requirement: Supported schema dialects retain their semantics

The plugin SHALL support AsyncAPI-native Schema Objects and explicit JSON Schema Draft 07 Multi Format Schema Objects in AsyncAPI 2.6, 3.0, and 3.1 source documents. Object and boolean schemas MUST be accepted. Every object component root SHALL declare Draft 07, while a boolean component SHALL remain the exact JSON value `true` or `false`. Unsupported formats, nested `$schema` values, and conflicting root `$schema` declarations MUST fail generation rather than being converted implicitly.

#### Scenario: Export an object schema

- **WHEN** a supported component is an object schema without `$schema`
- **THEN** its artifact adds root `$schema` equal to `http://json-schema.org/draft-07/schema#`
- **AND** it preserves validation keywords and annotations

#### Scenario: Preserve a matching root dialect

- **WHEN** a component root declares a supported Draft 07 `$schema` URI
- **THEN** that declaration remains at the root of its component artifact

#### Scenario: Export an explicit Draft 07 schema

- **WHEN** a Multi Format Schema Object declares JSON Schema Draft 07
- **THEN** its inner schema becomes the component artifact
- **AND** the Multi Format wrapper does not appear in the artifact

#### Scenario: Export boolean schemas

- **WHEN** named components are exactly `true` and `false`, including a Multi Format wrapper whose schema is `false`
- **THEN** their component artifacts contain exactly `true` and `false`

#### Scenario: Reject an unsupported AsyncAPI version

- **WHEN** the source declares a version other than AsyncAPI 2.6, 3.0, or 3.1
- **THEN** generation fails with code `UNSUPPORTED_ASYNCAPI_VERSION`
- **AND** the failure identifies `/asyncapi`

#### Scenario: Reject a foreign format

- **WHEN** a component declares Avro, OpenAPI, Protobuf, RAML, or an unknown schema format
- **THEN** generation fails with code `UNSUPPORTED_SCHEMA_FORMAT`
- **AND** the failure identifies the format and component source pointer

#### Scenario: Reject a conflicting or nested dialect declaration

- **WHEN** a component root declares another dialect or any component subschema contains `$schema`
- **THEN** generation fails with code `DIALECT_CONFLICT`
- **AND** the failure identifies the exact declaration pointer

### Requirement: Generated references remain serializable and self-contained as an artifact set

The plugin SHALL build from the unresolved source snapshot, SHALL rewrite document-local `#/components/schemas/...` references to relative generated-file URI references, and SHALL preserve repeated, self-recursive, and mutually recursive reference semantics without dereferencing object graphs. Every emitted reference MUST resolve within the completed artifact set or to an authored absolute identifier embedded in that set.

#### Scenario: Rewrite a local component reference

- **WHEN** one component references `#/components/schemas/Address`
- **THEN** the emitted reference is `./Address.schema.json`

#### Scenario: Rewrite a reference to a nested target

- **WHEN** a reference is `#/components/schemas/Address/properties/city`
- **THEN** the emitted reference is `./Address.schema.json#/properties/city`

#### Scenario: Preserve self and mutual recursion

- **WHEN** components reference themselves or one another
- **THEN** generation succeeds without circular JavaScript objects
- **AND** each emitted reference resolves to the corresponding component artifact

#### Scenario: Reject an identifier-scoped component reference

- **WHEN** a document-local component reference appears inside a schema resource with an authored `$id`
- **THEN** generation fails with code `UNSUPPORTED_REFERENCE`
- **AND** the failure explains that a relative file reference would change its resolution scope

#### Scenario: Reject a missing local target

- **WHEN** a component reference points to an absent component schema
- **THEN** generation fails with code `UNRESOLVED_REFERENCE`
- **AND** the failure identifies the reference and source pointer

#### Scenario: Reject a reference outside the exported root set

- **WHEN** a component references an AsyncAPI location outside `components.schemas`
- **THEN** generation fails with code `UNSUPPORTED_REFERENCE`

#### Scenario: Reject an unresolved external reference without loading it

- **WHEN** a component contains a file, HTTP, or other reference that does not resolve to an authored identifier in the artifact set
- **THEN** generation fails with code `UNSUPPORTED_REFERENCE`
- **AND** the plugin performs no network or filesystem read

### Requirement: The index is a deterministic schema catalog

The index artifact SHALL declare Draft 07 and SHALL map every exact component key under `definitions` to its relative component artifact. It MUST NOT embed component schemas.

#### Scenario: Index component artifacts

- **WHEN** component artifacts are `User.schema.json` and `Article.schema.json`
- **THEN** `definitions.User.$ref` is `./User.schema.json`
- **AND** `definitions.Article.$ref` is `./Article.schema.json`

#### Scenario: Use the index as a validation entry point

- **WHEN** a consumer compiles `index.schema.json#/definitions/User` with the artifact set registered
- **THEN** it validates with the same behavior as the `User.schema.json` root

### Requirement: Authored identifiers and extensions are handled safely

The plugin SHALL preserve absolute authored `$id` values, descriptions, examples, supported AsyncAPI annotations, and extensions other than parser-reserved `x-parser-*`. It MUST NOT derive `$id` from component keys or output paths. Relative authored identifiers MUST resolve from an absolute authored ancestor or fail generation.

#### Scenario: Preserve authored metadata

- **WHEN** a component contains an absolute `$id`, description, examples, annotations, and `x-domain`
- **THEN** those values survive in its component artifact
- **AND** its filename is not synthesized into `$id`

#### Scenario: Preserve a fragment reference within an authored resource

- **WHEN** a component with an absolute authored `$id` references a fragment inside that resource
- **THEN** the fragment reference remains unchanged
- **AND** it resolves when the generated resource set is compiled

#### Scenario: Remove parser-reserved metadata

- **WHEN** source schema data contains an `x-parser-*` field
- **THEN** no generated artifact contains it
- **AND** unrelated `x-*` extensions remain

#### Scenario: Reject a relative identifier without an authored base

- **WHEN** a component declares a relative `$id` without an absolute authored ancestor
- **THEN** generation fails with code `INVALID_SCHEMA_ID`

#### Scenario: Reject duplicate schema resource identifiers

- **WHEN** two generated resources contain the same resolved absolute `$id`
- **THEN** generation fails with code `DUPLICATE_SCHEMA_ID`
- **AND** the failure identifies both source pointers

### Requirement: Generated resources are validated before return

The plugin SHALL depend directly on Ajv and `ajv-formats`, validate every generated document against the Draft 07 meta-schema, register the supported AsyncAPI annotation keywords and formats, register every artifact under an in-memory retrieval URI, and compile both every component root and every index definition. The plugin MUST NOT return a partial artifact set.

#### Scenario: Compile every exported root

- **WHEN** all components are valid and references resolve
- **THEN** Ajv compiles every component retrieval URI and index definition before artifacts are returned

#### Scenario: Reject an invalid Draft 07 schema

- **WHEN** a component contains an invalid Draft 07 keyword value
- **THEN** generation fails with code `INVALID_JSON_SCHEMA`
- **AND** the failure identifies the component source pointer and validator details

#### Scenario: Preserve instance validation behavior

- **WHEN** the corpus supplies valid and invalid instances for an exported component
- **THEN** validation through the index accepts every declared valid instance
- **AND** it rejects every declared invalid instance

### Requirement: Serialization and artifact order are deterministic

The plugin SHALL serialize generated JSON with two-space indentation, stable lexicographic object-key ordering, authored array order, no byte-order mark, and exactly one trailing newline. The index SHALL be first and component artifacts SHALL follow in lexicographic path order. Repeated generation from the same semantic source and options MUST be byte-identical.

#### Scenario: Repeat one generation

- **WHEN** the same source and options are processed more than once
- **THEN** artifact paths, order, and contents are byte-identical

#### Scenario: Normalize source object key order

- **WHEN** semantically equivalent object inputs differ only in object insertion order
- **THEN** their complete generated artifact sets are byte-identical

### Requirement: Generation failures are actionable

The plugin SHALL internally classify generation failures with a code and source pointer. Diagnostics MUST remain testable without becoming public exports. Core SHALL continue to attribute the original thrown cause to the configured plugin.

#### Scenario: Run without unresolved source

- **WHEN** the plugin receives a context whose `source` is undefined
- **THEN** generation fails with code `SOURCE_UNAVAILABLE`
- **AND** no artifact is returned

#### Scenario: Core attributes a plugin failure

- **WHEN** JSON Schema generation throws an internal generation error
- **THEN** the pipeline rejects with the existing plugin execution error naming the JSON Schema plugin
- **AND** its cause is the original error

### Requirement: A plugin-owned conformance corpus covers the contract

The package SHALL include self-contained case directories with machine-readable metadata, source input, complete expected artifact tree, and optional validation instances. Successful cases SHALL run through the public pipeline twice and compare every artifact path and byte.

#### Scenario: Cover successful output behavior

- **WHEN** the suite discovers success cases
- **THEN** it covers supported AsyncAPI versions, object and boolean roots, safe filenames, empty components, annotations, references, recursion, identifiers, inline payload exclusion, deterministic order, and index generation

#### Scenario: Cover expected failures

- **WHEN** the suite discovers failure cases
- **THEN** it covers unavailable source, unsupported formats, dialect conflicts, missing and out-of-scope references, identifier-scoped references, disabled external references, invalid and duplicate identifiers, invalid component names, filename collisions, and invalid Draft 07 schemas

#### Scenario: Prevent orphan fixtures

- **WHEN** an unreferenced case file exists
- **THEN** the conformance test fails

### Requirement: Consumer configuration integration follows the plugin package

The package SHALL own a consumer-style config fixture that runs through the public CLI API in a temporary directory and compares every persisted component and index artifact with package-local expectations.

#### Scenario: Generate from the package configuration fixture

- **WHEN** the package integration test runs its fixture config
- **THEN** config discovery loads the TypeScript config
- **AND** the CLI persists the configured index and component artifacts
- **AND** every persisted artifact exactly matches its package-local expected file

#### Scenario: Keep integration isolated and repeatable

- **WHEN** the integration test completes or fails
- **THEN** output exists only in the temporary directory
- **AND** no repository fixture output is created or reused
