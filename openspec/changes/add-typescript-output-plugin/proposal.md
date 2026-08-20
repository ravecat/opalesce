## Why

Projects can export validation-oriented JSON Schema resources, but application code still has to hand-write the TypeScript contracts used to exchange messages with external systems. Generating only named component schemas leaves the interaction boundary incomplete because message payloads, application headers, channel parameters, operation-selected messages, and replies can be defined outside `components.schemas`.

TypeScript and the planned Zod output must interpret those entities identically. If every plugin normalizes the parsed document independently, their identities, message selections, and dependency graphs can drift. Core therefore needs to provide one target-neutral interaction contract to every plugin execution.

## What Changes

- Add an immutable `InteractionContract` to `@opalesce/core` that normalizes AsyncAPI 2.6, 3.0, and 3.1 schema, message, channel, operation, reply, provenance, format, and dependency relationships.
- Add `readonly interaction: InteractionContract` to `PluginContext`; Core lazily builds and memoizes it once per pipeline context so plugins that never access it retain their current execution behavior.
- Re-export the public interaction-contract types from the `opalesce` facade for third-party plugin authors without exposing a second parser or requiring an additional pipeline plugin.
- Add a separately installable `@opalesce/plugin-typescript` package in the existing `@opalesce` scope whose default typed factory consumes `context.interaction` and returns deterministic ESM TypeScript artifacts through the existing Core plugin contract.
- Generate importable contracts for named schemas, reusable and channel messages, message payloads and application headers, channel parameters, operation message selections, and operation replies, including required transitive schema dependencies.
- Emit TypeScript type aliases, literal unions, type-only imports, message and operation boundary declarations, and one named barrel entry point without runtime code.
- Define explicit behavior for schema composition, recursion, optional and nullable values, enums and constants, additional properties, annotations, unsupported formats, unsafe names, and unresolved references.
- Add Core contract fixtures, a TypeScript plugin conformance corpus, and CLI coverage using `opalesce` with `@opalesce/plugin-typescript` for exact artifacts, strict compilation, representative assignability, failure diagnostics, and determinism.
- Use the existing Core `@asyncapi/parser` result as the sole AsyncAPI parse and resolution boundary and the official TypeScript compiler AST and printer for source generation.
- Keep runtime validators, clients, servers, transports, serializers, mocks, Zod output, configurable style variants, external loading, foreign schema conversion, package publication, and Core artifact persistence changes out of this delivery.

## Capabilities

### New Capabilities

- `asyncapi-interaction-contract`: Core-owned immutable interaction semantics shared by target plugins through `PluginContext.interaction`.
- `typescript-interaction-output`: Deterministic TypeScript contracts for the AsyncAPI entities required to exchange data with external systems.

### Modified Capabilities

None.

## Impact

- Extends `packages/core` with contract types, normalization, memoization, diagnostics, fixtures, tests, and the new `PluginContext.interaction` field.
- Adds `packages/plugin-typescript` as an independently publishable `@opalesce/plugin-typescript` package depending on `@opalesce/core` and TypeScript for AST printing; no separate interaction-model package is introduced.
- Keeps `opalesce` free of output-plugin dependencies and re-exports only the public interaction types from Core.
- Extends workspace references, pnpm metadata, aggregate checks, and package verification for the new plugin package.
- Preserves existing plugin order, artifact isolation, parser ownership, CLI persistence, and JSON Schema output behavior.

## Tracking

- GitHub feature: [#13 Projects Can Generate TypeScript Interaction Contracts](https://github.com/ravecat/opalesce/issues/13)
- Acceptance bug: [#14 AsyncAPI 2.6 Operations Collide Without operationId](https://github.com/ravecat/opalesce/issues/14)
- Acceptance bug: [#15 TypeScript Emits Invalid Index Signatures for Incompatible Object Properties](https://github.com/ravecat/opalesce/issues/15)
- Acceptance bug: [#16 TypeScript Rejects Recursive Anonymous Schemas](https://github.com/ravecat/opalesce/issues/16)
- Acceptance bug: [#17 Interaction Contract Loses Unrepresentable External Reference Identities](https://github.com/ravecat/opalesce/issues/17)
