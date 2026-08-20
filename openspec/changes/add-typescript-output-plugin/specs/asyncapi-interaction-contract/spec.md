# AsyncAPI Interaction Contract Specification

## ADDED Requirements

### Requirement: Core supplies one target-neutral contract to plugins

Core SHALL expose `readonly interaction: InteractionContract` on `PluginContext`. The contract SHALL describe normalized schemas, messages, channels, operations, replies, provenance, formats, and dependencies without generated artifacts or target-language values. Core SHALL lazily build the contract on first access and SHALL memoize the same immutable result for every plugin in one pipeline run.

#### Scenario: A plugin reads the interaction contract

- **WHEN** a plugin reads `context.interaction`
- **THEN** it receives normalized schema, message, channel, operation, reply, and dependency collections
- **AND** no collection contains a TypeScript name, Zod expression, output path, or generated source string

#### Scenario: Two plugins share one contract

- **WHEN** two plugins read `context.interaction` in the same pipeline run
- **THEN** both reads return the same object identity
- **AND** Core performs normalization once

#### Scenario: A plugin does not need interaction semantics

- **WHEN** every configured plugin uses only `document`, `diagnostics`, or `source`
- **THEN** Core does not build the interaction contract
- **AND** existing plugin execution behavior is preserved

#### Scenario: Contract construction fails inside a plugin

- **WHEN** a plugin first accesses `interaction` and contract construction fails
- **THEN** Core attributes the failure to that plugin through the existing plugin execution error boundary
- **AND** no later plugin runs

### Requirement: Public contracts are available from Core and the facade

`@opalesce/core` SHALL export `InteractionContract` and its public readonly root, role, metadata, and dependency contracts. The `opalesce` facade SHALL re-export the same types for third-party plugin authors. Core SHALL NOT expose a second parser, resolver, or separately configured interaction plugin.

#### Scenario: Author a plugin from the facade

- **WHEN** a consumer imports `definePlugin` and `InteractionContract` from `opalesce`
- **THEN** `generate(context)` exposes `context.interaction` with that contract type
- **AND** the consumer does not install or configure a separate interaction package

#### Scenario: Configure the pipeline without a contract plugin

- **WHEN** a consumer configures TypeScript, Zod, or another contract consumer
- **THEN** the plugin list contains only the requested output plugins
- **AND** Core provides the shared interaction contract implicitly

### Requirement: Supported AsyncAPI versions share one contract shape

The contract builder SHALL normalize AsyncAPI 2.6, 3.0, and 3.1 into the same public root kinds while preserving the exact source version. Accessing `interaction` for another version MUST fail rather than infer untested semantics.

#### Scenario: Normalize an AsyncAPI 2.6 channel operation

- **WHEN** an AsyncAPI 2.6 channel contains `publish` or `subscribe` with effective messages
- **THEN** the contract contains an operation with normalized `send` or `receive` action and the effective message selection
- **AND** it contains no reply because AsyncAPI 2.6 does not define operation replies

#### Scenario: Normalize AsyncAPI 3 operations and replies

- **WHEN** an AsyncAPI 3.0 or 3.1 document contains top-level operations with selected messages and replies
- **THEN** each operation links its channel, effective messages, and effective reply messages through the same public contracts

#### Scenario: Reject an unsupported version on access

- **WHEN** a plugin accesses `interaction` for a parsed document outside AsyncAPI 2.6, 3.0, and 3.1
- **THEN** construction fails with an unsupported-version code and `/asyncapi` pointer
- **AND** a plugin that never accesses `interaction` can still use the parsed document

### Requirement: Contract roots follow interaction ownership

The contract SHALL expose every named component schema, every reusable component message, every effective channel message, every channel with address parameters, and every operation and reply selection. Nested property, item, and composition schemas SHALL remain dependencies of their owning schema role and SHALL NOT become anonymous public roots.

#### Scenario: Include used and unused component schemas

- **WHEN** `components.schemas` contains referenced and unreferenced entries
- **THEN** every named entry appears once in the schema-root collection

#### Scenario: Include reusable and inline messages

- **WHEN** a document contains a component message and an inline channel message
- **THEN** both messages appear with distinct stable identities
- **AND** each message identifies its payload and application headers when present

#### Scenario: Include channel parameters

- **WHEN** a channel declares address parameters
- **THEN** its contract preserves every exact parameter key plus schema, description, location, and source pointer when available

#### Scenario: Exclude non-contract metadata roots

- **WHEN** a document contains servers, bindings, security, correlation IDs, examples, tags, or external documentation
- **THEN** those values do not become schema, message, parameter, operation, or reply roots

### Requirement: Every root has stable semantic identity and provenance

Each public root SHALL expose a kind-qualified logical identity, source pointer, authored or owner-derived name, exact AsyncAPI version, and effective schema format where applicable. Identity MUST NOT depend on collection iteration order or a target-language naming rule.

#### Scenario: Identify named component roots

- **WHEN** a schema or message is defined under a component map key
- **THEN** its identity retains the exact component key and component kind
- **AND** its source pointer identifies that map entry

#### Scenario: Scope an inline channel message

- **WHEN** equal inline message keys occur in two channels
- **THEN** their identities include their owning channel identities
- **AND** the roots remain distinct without numeric suffixes

#### Scenario: Identify AsyncAPI 3 operations

- **WHEN** an AsyncAPI 3 operation is stored under a top-level operation map key
- **THEN** its identity retains that exact key and source pointer

#### Scenario: Derive an AsyncAPI 2.6 operation identity

- **WHEN** an AsyncAPI 2.6 operation has no `operationId`
- **THEN** its identity is derived from the exact channel identity and publish or subscribe role

#### Scenario: Scope same-role AsyncAPI 2.6 operations by channel

- **WHEN** two AsyncAPI 2.6 channels each define publish operations or each define subscribe operations without `operationId`
- **THEN** the operations have distinct identities that retain their exact channel identities and authored roles
- **AND** a parser fallback ID such as `publish` or `subscribe` is not treated as an authored operation identity

#### Scenario: Preserve an authored AsyncAPI 2.6 operation ID

- **WHEN** an AsyncAPI 2.6 operation declares a non-empty `operationId`
- **THEN** its identity retains that authored value instead of replacing it with the derived channel-and-role identity

### Requirement: Parser-effective semantics determine relationships

Core SHALL use the official parsed document as the authority for resolved references, applied traits, channels, operation-selected messages, and reply-selected messages. Contract construction MUST NOT parse the document again or reimplement effective relationships from unresolved source when the parser model already exposes them.

#### Scenario: Apply message traits

- **WHEN** a message receives payload, application headers, or annotations through supported traits
- **THEN** its contract exposes the effective trait-applied values

#### Scenario: Select explicit operation messages

- **WHEN** an operation selects a subset of channel messages
- **THEN** its message relationship contains exactly that effective subset

#### Scenario: Use the parser fallback

- **WHEN** an operation omits an explicit message or reply selection and the parser exposes a fallback set
- **THEN** the contract contains that effective parser-selected set

### Requirement: Dependencies preserve references and recursion

Schema roles SHALL retain their readonly official `SchemaInterface`, effective schema format, source pointer, and stable dependency identities. Dependency collection SHALL represent referenced roots and transitive edges without expanding the complete graph. Repeated, self-recursive, and mutually recursive relationships MUST terminate.

#### Scenario: Preserve a component reference

- **WHEN** a payload schema references a named component schema
- **THEN** its dependency targets that component identity rather than creating a duplicate public root

#### Scenario: Deduplicate repeated references

- **WHEN** one root references the same target more than once
- **THEN** its dependency collection contains one stable target edge

#### Scenario: Preserve recursion

- **WHEN** schema roots reference themselves or one another cyclically
- **THEN** construction completes without serializing a cyclic parser graph
- **AND** dependency identities preserve the cycle

#### Scenario: Reject an unrepresentable target

- **WHEN** a parser-resolved reference has no stable representable identity
- **THEN** construction fails with an unsupported-reference code and source pointer
- **AND** Core performs no additional resolution

#### Scenario: Reject an externally resolved anonymous target

- **WHEN** the parser resolves an external schema reference to a model that is not a representable component or owner-scoped interaction dependency
- **THEN** contract construction fails with `INTERACTION_REFERENCE_UNSUPPORTED` at the authored schema-role pointer
- **AND** the contract does not silently expose that model as an anonymous schema with an empty dependency collection

### Requirement: Schema formats remain target-neutral

The interaction contract SHALL record native AsyncAPI Schema Object, explicit JSON Schema Draft 07, and foreign effective schema formats without converting them. Each output plugin SHALL decide which formats it supports.

#### Scenario: Retain a native schema

- **WHEN** a schema role uses the native AsyncAPI schema format
- **THEN** it retains the official schema model and native effective format

#### Scenario: Retain Draft 07

- **WHEN** a schema role uses explicit JSON Schema Draft 07
- **THEN** that effective format remains available to output plugins

#### Scenario: Retain a foreign format

- **WHEN** a schema role uses a foreign format
- **THEN** the contract records that format without claiming JSON Schema semantics
- **AND** Core does not invoke a converter

### Requirement: Contract-owned values are immutable and deterministic

Core SHALL recursively freeze all contract-owned objects and arrays in canonical root-kind and logical-identity order. It MUST NOT freeze, clone, or mutate parser-owned model instances retained as readonly schema handles.

#### Scenario: Reject contract mutation

- **WHEN** a consumer attempts to add, replace, reorder, or remove a root or dependency
- **THEN** the operation fails or leaves the contract unchanged

#### Scenario: Normalize the same document twice

- **WHEN** equivalent parsed documents are normalized
- **THEN** root identities, order, pointers, formats, and dependency identities are equal

#### Scenario: Preserve parser models

- **WHEN** contract construction completes or fails
- **THEN** the parsed document and its nested parser models remain unchanged and retain their original freeze state

### Requirement: Contract construction has no external side effects

Contract construction MUST NOT read files, access the network, write artifacts, load configuration, run plugins, or invoke another parser. Resolution and validation remain owned by the Core parse that produced `document`.

#### Scenario: Build from an in-memory parsed document

- **WHEN** a plugin reads the interaction contract for an already parsed in-memory document
- **THEN** construction performs no filesystem or network operation

#### Scenario: Encounter an unsupported external identity

- **WHEN** an externally resolved model cannot be assigned a stable identity
- **THEN** construction fails instead of fetching, rebasing, or dereferencing the resource again
