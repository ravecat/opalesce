# TypeScript Interaction Output Specification

## ADDED Requirements

### Requirement: Consumers configure the independently published TypeScript plugin

The workspace SHALL provide `@opalesce/plugin-typescript` as an independently publishable ESM package whose default export is a typed plugin factory named `typescript` and which exports `TypeScriptPluginOptions`. The `opalesce` facade SHALL NOT depend on or re-export output plugins. The options contract SHALL contain only an optional readonly `outputPath` string in this delivery, and the plugin name exposed to Core SHALL be `typescript`.

The plugin SHALL consume the Core-owned `context.interaction` contract and SHALL NOT construct another normalized document model.

#### Scenario: Configure generation through the primary entry point

- **WHEN** a consumer imports `defineConfig` from `opalesce` and `typescript` from `@opalesce/plugin-typescript`
- **THEN** `defineConfig({ plugins: [typescript()] })` type-checks across the public package boundary
- **AND** the plugin uses `types` as its output path

#### Scenario: Configure a custom output path

- **WHEN** a consumer calls `typescript({ outputPath: "generated/contracts" })`
- **THEN** every returned artifact is rooted below `generated/contracts`

#### Scenario: Consume the plugin package directly

- **WHEN** a consumer imports the default export and `TypeScriptPluginOptions` from `@opalesce/plugin-typescript`
- **THEN** the package exposes the factory and options without a facade re-export

#### Scenario: Consume the shared Core contract

- **WHEN** the plugin generates artifacts
- **THEN** it reads schema, message, channel, operation, reply, and dependency roots from `context.interaction`
- **AND** it does not parse or independently normalize `context.document`

### Requirement: Artifact paths mirror interaction ownership

The plugin SHALL return a fixed directory layout beneath `outputPath`: `schemas/<Schema>.ts`, `messages/<Message>.ts`, `channels/<Channel>Parameters.ts`, `operations/<Operation>.ts`, and `index.ts`. It SHALL create one file for each public semantic root group and SHALL NOT create empty group directories or placeholder files.

#### Scenario: Generate a complete interaction tree

- **WHEN** a document contains a component schema, message, parameterized channel, and operation
- **THEN** the artifact set contains the corresponding schema, message, channel-parameter, and operation files
- **AND** it contains one root `index.ts`

#### Scenario: Generate an empty interaction tree

- **WHEN** a supported document has no schema, message, channel-parameter, or operation root
- **THEN** the plugin returns only an empty named-export `index.ts`

#### Scenario: Keep one semantic root group per file

- **WHEN** a message contains a payload, application headers, and nested inline schemas
- **THEN** its payload alias, headers alias, wrapper, and message-owned nested declarations are emitted in one message file
- **AND** those declarations are not split into anonymous top-level files

### Requirement: Named schemas become public type aliases

Every named component schema SHALL produce one public type alias, whether or not another interaction references it. Nested anonymous schemas SHALL remain private dependency declarations of their owning root unless they resolve to a named public root.

#### Scenario: Emit used and unused schemas

- **WHEN** `components.schemas` contains one referenced and one unreferenced schema
- **THEN** both schemas have public aliases and barrel exports

#### Scenario: Emit boolean schemas

- **WHEN** a schema is the boolean schema `true` or `false`
- **THEN** its alias is `unknown` or `never`, respectively

#### Scenario: Keep nested declarations out of the barrel

- **WHEN** a named schema needs a generated nested dependency declaration
- **THEN** that declaration is available within the owning file
- **AND** the root barrel exports only the named component schema alias

#### Scenario: Preserve recursive anonymous dependencies

- **WHEN** a schema-owned or message-owned anonymous schema references itself or another anonymous schema in the same owner graph
- **THEN** the plugin assigns deterministic owner-scoped private declarations and symbolic references
- **AND** those declarations remain in the owning file, stay out of the root barrel, and compile without recursive expansion

### Requirement: Messages expose payload, application headers, and a wrapper

Every reusable or effective channel message SHALL produce `<Message>Payload` and `<Message>Message`. It SHALL also produce `<Message>Headers` when the message declares application headers. The wrapper SHALL always have `payload: <Message>Payload` and SHALL have `headers: <Message>Headers` only when application headers exist.

#### Scenario: Generate a complete message contract

- **WHEN** a message declares a payload schema and application headers
- **THEN** its file exports payload, headers, and wrapper aliases
- **AND** the wrapper contains both `payload` and `headers` properties

#### Scenario: Generate a message without a payload schema

- **WHEN** a message has no payload schema
- **THEN** its payload alias is `unknown`
- **AND** its wrapper still contains a required `payload` property

#### Scenario: Omit undeclared application headers

- **WHEN** a message declares no application headers
- **THEN** no headers alias or wrapper `headers` property is emitted

#### Scenario: Ignore protocol metadata as data fields

- **WHEN** a message contains bindings, correlation IDs, content types, examples, or protocol header metadata
- **THEN** those values do not become wrapper properties or standalone aliases

### Requirement: Channels expose exact address parameter contracts

Each channel with address parameters SHALL produce `<Channel>Parameters`. Parameter property keys SHALL preserve the exact wire spelling, including quoting keys that are not valid TypeScript identifiers. A parameter without a schema SHALL have type `string`.

#### Scenario: Generate constrained channel parameters

- **WHEN** a channel declares required parameters with string, numeric, enum, or referenced schemas
- **THEN** the parameter object retains their schema-derived types and exact property keys

#### Scenario: Default an unconstrained channel parameter

- **WHEN** a channel parameter has no schema
- **THEN** the corresponding property is typed as `string`

#### Scenario: Omit a channel without parameters

- **WHEN** a channel declares no address parameters
- **THEN** no channel-parameter file or public parameter alias is generated for that channel

### Requirement: Operations expose effective message and reply selections

Every operation SHALL produce `<Operation>Message` as an alias of its effective selected message wrapper or a union of its effective wrappers. An operation with a reply SHALL also produce `<Operation>ReplyMessage` using the effective reply selection. These aliases SHALL be emitted even when a selection contains one message.

#### Scenario: Generate a single-message operation

- **WHEN** an operation selects one effective message
- **THEN** its message alias references that message wrapper without duplicating the wrapper shape

#### Scenario: Generate a multi-message operation

- **WHEN** an operation selects several effective messages
- **THEN** its message alias is a deterministic union of their wrappers

#### Scenario: Use parser-selected fallback messages

- **WHEN** an operation omits an explicit selection and the interaction contract provides channel fallback messages
- **THEN** its message alias uses the effective fallback set

#### Scenario: Generate a reply selection

- **WHEN** an AsyncAPI 3 operation has effective reply messages
- **THEN** its file exports a reply-message alias for those message wrappers

#### Scenario: Omit an absent reply

- **WHEN** an operation has no reply
- **THEN** no reply-message alias or barrel export is generated

#### Scenario: Generate an AsyncAPI 2.6 operation

- **WHEN** the interaction contract contains a normalized AsyncAPI 2.6 publish or subscribe operation
- **THEN** the same operation-message contract is generated
- **AND** no reply alias is invented

### Requirement: JSON-compatible schema values map to TypeScript values

The plugin SHALL map JSON string, number, integer, boolean, and null values to `string`, `number`, `number`, `boolean`, and `null`. Supported string formats SHALL remain `string`. Required object properties SHALL be required, other properties SHALL use `?`, nullable values SHALL include `null`, and `readOnly` properties SHALL use `readonly`. `writeOnly` values SHALL remain present and receive an `@writeOnly` annotation.

#### Scenario: Preserve object property semantics

- **WHEN** an object has required, optional, read-only, write-only, and nullable properties
- **THEN** the generated object type represents each property with the corresponding TypeScript modifier or union

#### Scenario: Preserve wire property names

- **WHEN** an object property name is reserved, contains punctuation, or is not a valid identifier
- **THEN** the emitted property uses an escaped quoted name with the exact wire value

#### Scenario: Generate arrays and tuples

- **WHEN** a schema declares homogeneous items or tuple positions
- **THEN** the generated type uses `T[]` or tuple syntax with the projected item types

### Requirement: Composition and literals use explicit compile-time approximations

The plugin SHALL map `const` and enums to literals or literal unions, `allOf` to intersections, and `anyOf` and `oneOf` to unions. It MUST NOT synthesize discriminator fields or claim that TypeScript enforces exact `oneOf` exclusivity, validation formats, patterns, ranges, item uniqueness, or closed object semantics.

#### Scenario: Emit a literal union

- **WHEN** a schema contains an enum of JSON primitive values
- **THEN** the alias is a deterministic union of those literal types
- **AND** no runtime enum value is generated

#### Scenario: Emit schema composition

- **WHEN** a schema uses `allOf`, `anyOf`, or `oneOf`
- **THEN** the generated type uses the corresponding intersection or union approximation

#### Scenario: Retain discriminator metadata without changing data

- **WHEN** a union declares a discriminator but its branches do not declare literal discriminator properties
- **THEN** the plugin does not add fields to those branches
- **AND** it documents the discriminator metadata in deterministic JSDoc

### Requirement: Additional properties have a safe fixed policy

`additionalProperties: true` SHALL produce a string index signature with `unknown`. A schema-valued `additionalProperties` SHALL use its projected value type only when all fixed properties are assignable to that index value, otherwise it SHALL widen the index value to `unknown`. `additionalProperties: false` SHALL emit no index signature and SHALL NOT claim exact-object enforcement.

#### Scenario: Generate an open object

- **WHEN** an object allows arbitrary additional properties
- **THEN** its type contains `[key: string]: unknown`

#### Scenario: Generate compatible typed additional properties

- **WHEN** an object has typed additional properties and every fixed property is compatible with that type
- **THEN** its index signature retains the projected additional-property value type

#### Scenario: Widen an incompatible index signature

- **WHEN** a fixed property is not assignable to the typed additional-property value
- **THEN** the index signature uses `unknown` rather than making the fixed property invalid

#### Scenario: Compare structured index values by represented type

- **WHEN** a fixed property and a schema-valued `additionalProperties` entry are objects with equal property names but incompatible nested property types or modifiers
- **THEN** the compatibility check does not treat their shallow names as proof of assignability
- **AND** the index signature widens to `unknown` so the complete generated tree compiles under strict TypeScript settings

#### Scenario: Approximate a closed object

- **WHEN** an object sets `additionalProperties: false`
- **THEN** no index signature is emitted
- **AND** the generated documentation does not claim runtime rejection of extra keys

### Requirement: References remain symbolic and recursion-safe

Referenced public roots SHALL become named type references. Cross-file dependencies SHALL use sorted `import type` declarations with relative `.js` specifiers, while same-file dependencies SHALL use local names without imports. The dependency planner SHALL terminate for self-recursive and mutually recursive graphs.

#### Scenario: Import a referenced component schema

- **WHEN** a message payload references a component schema in another file
- **THEN** its message file imports that alias with `import type` and a relative `.js` specifier

#### Scenario: Preserve self recursion

- **WHEN** a schema references itself
- **THEN** its declaration uses its own symbol without importing itself or expanding indefinitely

#### Scenario: Preserve mutual recursion

- **WHEN** two schema roots reference one another
- **THEN** each file has one symbolic type-only import for the other root
- **AND** strict TypeScript compilation succeeds

### Requirement: Documentation is deterministic and safe to print

Descriptions, deprecation, defaults, examples, supported format notes, validation constraints, read-only, write-only, and discriminator metadata SHALL be rendered as deterministic JSDoc where relevant. Source text SHALL be escaped so it cannot terminate a comment or create an unintended declaration.

#### Scenario: Render schema annotations

- **WHEN** a schema or property declares descriptions and supported annotations
- **THEN** its declaration receives stable JSDoc without changing the represented value type

#### Scenario: Escape hostile comment text

- **WHEN** an annotation contains `*/`, line breaks, or TypeScript-looking source text
- **THEN** the generated file remains valid TypeScript
- **AND** the text cannot escape its documentation comment

### Requirement: Names are portable, deterministic, and collision-checked

The plugin SHALL derive valid PascalCase public symbols with semantic role suffixes and SHALL complete the naming table before rendering. Component identities, owner-scoped inline messages, and root-scoped nested dependencies SHALL remain distinguishable. It MUST reject public symbol collisions and per-directory filename collisions after NFC normalization and lowercase mapping, including portable reserved filenames, rather than append counters.

#### Scenario: Scope equal inline message names

- **WHEN** two channels contain equal inline message keys
- **THEN** their generated public names incorporate stable channel ownership

#### Scenario: Reject a public symbol collision

- **WHEN** distinct roots normalize to the same public symbol
- **THEN** generation fails with both logical identities and source pointers
- **AND** no artifact array is returned

#### Scenario: Reject a portable filename collision

- **WHEN** two files in one output group differ only by Unicode normalization or letter case, or a name resolves to a reserved portable filename
- **THEN** generation fails before rendering

### Requirement: Supported versions and schema formats fail closed

The plugin SHALL accept AsyncAPI 2.6, 3.0, and 3.1 interaction contracts containing native AsyncAPI schemas or explicit JSON Schema Draft 07 schemas. It SHALL reject Avro, OpenAPI, RAML, Protobuf, unknown schema formats, and unsupported external identities instead of converting or resolving them. Unsupported AsyncAPI versions SHALL fail when Core constructs `context.interaction`.

#### Scenario: Generate every supported AsyncAPI version

- **WHEN** equivalent interaction contracts are supplied through AsyncAPI 2.6, 3.0, and 3.1
- **THEN** each version generates the same target-language roles with its own stable source attribution

#### Scenario: Generate Draft 07 schemas

- **WHEN** a schema role has explicit JSON Schema Draft 07 format
- **THEN** the plugin projects its supported JSON Schema vocabulary

#### Scenario: Reject a foreign schema format

- **WHEN** a required schema role uses an unsupported format
- **THEN** generation fails with the format and source pointer
- **AND** the plugin does not invoke another parser or converter

### Requirement: Output is deterministic ESM TypeScript

`index.ts` SHALL contain explicit sorted `export type` declarations for every public symbol and no dependency-only nested symbol. Cross-file imports and exports SHALL use relative `.js` specifiers. The plugin SHALL return the barrel first and every remaining artifact in lexicographic path order. Files SHALL use LF, two-space indentation, no byte-order mark, and exactly one trailing newline.

#### Scenario: Generate the root barrel

- **WHEN** several public contracts exist across output groups
- **THEN** `index.ts` exposes all and only those contracts through sorted named type-only exports

#### Scenario: Repeat generation

- **WHEN** the same semantic document and options are generated twice
- **THEN** artifact paths, artifact order, and every output byte are identical

#### Scenario: Ignore consumer formatting configuration

- **WHEN** the workspace contains formatter configuration with different style choices
- **THEN** generated source still follows the plugin's fixed formatting contract

### Requirement: Failures are atomic and actionable

Interaction extraction, schema projection, naming, dependency planning, printing, and syntax validation SHALL complete before the plugin returns artifacts. Internal failures SHALL expose a stable code and relevant source pointer plus conflicting identity, reference, format, or schema detail. Core SHALL continue to attribute the failure to plugin `typescript`.

#### Scenario: Fail during dependency planning

- **WHEN** a required reference target cannot be represented
- **THEN** the plugin returns no partial artifacts
- **AND** the error identifies the reference and source location

#### Scenario: Fail during syntax validation

- **WHEN** a planned declaration cannot be printed as valid TypeScript
- **THEN** the plugin returns no artifacts
- **AND** the error identifies the owning logical root

### Requirement: Conformance proves public consumption

Package-owned conformance tests SHALL compare complete expected artifact trees, generate successful cases twice, compile emitted files with strict TypeScript settings, and check representative positive and `@ts-expect-error` assignments. Facade-owned integration SHALL configure the project through `opalesce`, import the plugin from `@opalesce/plugin-typescript`, persist files through the CLI, import the generated barrel, and compile a consumer.

#### Scenario: Verify a successful corpus case

- **WHEN** a supported fixture is generated through the Core plugin pipeline
- **THEN** every expected path and byte matches
- **AND** strict TypeScript compilation and representative assignments succeed

#### Scenario: Verify a failing corpus case

- **WHEN** a fixture contains a collision, unsupported format, unsupported reference, or unrepresentable declaration
- **THEN** its stable error code and source attribution match the expected failure
- **AND** no partial expected tree is accepted

#### Scenario: Verify the primary package entry point

- **WHEN** an integration fixture imports `opalesce` and `@opalesce/plugin-typescript` to configure the plugin and consume its generated barrel
- **THEN** CLI persistence and consumer compilation succeed without importing Core, config, or CLI packages directly
