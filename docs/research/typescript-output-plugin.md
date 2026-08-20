# TypeScript output plugin research

Date: 2026-08-18

Last reviewed: 2026-08-19

## Decision summary

Create an independently publishable `@opalesce/plugin-typescript` package in the existing `@opalesce` scope, while keeping output plugins out of the main `opalesce` package. The plugin should generate compile-time AsyncAPI interaction contracts, not only projections of `components.schemas` and not HTTP request or response types copied from Kubb.

The first delivery should use:

- `@asyncapi/parser` as the authoritative parser and validator already owned by Core.
- An Opalesce-owned interaction root registry that preserves stable source identity, reference relationships, schema format, messages, channels, and operation selections.
- A narrow TypeScript emitter over that registry, preferably using the TypeScript compiler AST and printer rather than string concatenation.
- Directory output only, with one module per public semantic root, type-only imports, and a named `index.ts` barrel.
- Type aliases, question-token optional properties, `T[]`, and literal unions for enums as fixed first-release policy.
- Deterministic native output with no formatter dependency.

Do not embed Kubb. Its reusable contribution is the separation between input adaptation, a semantic AST, target generation, file assembly, and printing. Its actual model and generated operation artifacts are OpenAPI and HTTP-specific: [Kubb adapters](https://kubb.dev/docs/5.x/guide/concepts/adapters), [Kubb AST](https://kubb.dev/docs/5.x/guide/concepts/ast), [Kubb plugins](https://kubb.dev/docs/5.x/guide/concepts/plugins).

Do not make `@asyncapi/modelina` a first-delivery dependency. Stable Modelina 5.10.1 does not accept AsyncAPI 3.1 and generates payload models without application headers or channel parameters. The 6.x prerelease accepts 3.1 and can include header schemas, but it still does not provide the required message wrappers, channel parameter roots, or operation-specific selected-message identities. Modelina remains a candidate lower-level renderer only after Opalesce owns the root registry and its compatibility has dedicated fixtures.

## Source baseline and observed drift

This research used primary sources current on 2026-08-18:

- Kubb core at commit [`52558cd52ce46edbd809c85bd4c80c68c36f6435`](https://github.com/kubb-labs/kubb/tree/52558cd52ce46edbd809c85bd4c80c68c36f6435).
- The current first-party `@kubb/plugin-ts` source at commit [`7cea5b1d01febacc618216e43655c1ffa36da5e6`](https://github.com/kubb-labs/plugins/tree/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts). The package now lives in Kubb's official plugins repository while the adapter, AST, Core, file manager, barrel plugin, and TypeScript parser remain in `kubb-labs/kubb`.
- Kubb v5 plugin and configuration documentation: [plugin overview](https://kubb.dev/plugins/plugin-ts), [plugin options](https://kubb.dev/plugins/plugin-ts/reference/options), [configuration](https://kubb.dev/docs/5.x/reference/configuration).
- Modelina stable tag [`v5.10.1`](https://github.com/asyncapi/modelina/tree/e208302f94667f8b187d028aad8054baff5ee523) and next tag [`v6.0.0-next.17`](https://github.com/asyncapi/modelina/tree/dd3b8b69e81f876cb86c0b5a097d1c4d7146a92d).

Kubb v5 is a moving beta. The documentation, untagged main branches, and published beta can disagree. For example, the options page documents `comments`, while the inspected plugin option type and setup do not expose it. The source default is `{ path: 'types', barrel: { type: 'named' } }`, but output-mode defaults have changed between releases: [current plugin defaults](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/plugin.ts#L37-L60), [current option type](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/types.ts#L210-L245).

Therefore this document treats Kubb as a behavioral reference, not as a versioned compatibility target. Opalesce should expose explicit behavior rather than infer a mode from a path extension or copy options whose shipped semantics are not stable.

## What Kubb generates and why

`@kubb/plugin-ts` generates the shared compile-time contract consumed by Kubb's clients, query hooks, mocks, and validators. Its source describes the TypeScript plugin as the foundation for those other generators: [plugin purpose](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/plugin.ts#L7-L17).

Its public roots are OpenAPI component schemas and HTTP operations. Operation output includes grouped path, query, and header parameters, request bodies, status-specific responses, aggregate response unions, response maps, and options bags. These are useful examples of deriving types from interaction boundaries, but their exact shape is not appropriate for AsyncAPI.

### Plugin API and options

Kubb currently exposes these main controls:

| Concern         | Kubb behavior                                              | Opalesce first-delivery decision                                |
| --------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Output          | File or directory mode, path, barrel, banner, footer       | Directory only, `outputPath`, fixed named barrel                |
| Grouping        | By OpenAPI tag or path in directory mode                   | Do not copy; no equivalent stable AsyncAPI policy is needed yet |
| Declarations    | `syntaxType: 'type' \| 'interface'`, default `type`        | Type aliases only                                               |
| Optional fields | Question token, `undefined`, or both                       | Question token only                                             |
| Arrays          | `T[]` or `Array<T>`                                        | `T[]` only                                                      |
| Enums           | `asConst`, `enum`, `constEnum`, `literal`, `inlineLiteral` | Literal unions only                                             |
| Selection       | Include, exclude, first-match override                     | Generate the complete interaction contract, no filters          |
| Naming          | Resolver hooks for symbols and files                       | Fixed deterministic naming with collision errors                |
| AST extension   | Macros and replaceable printer nodes                       | No extension hooks in the first delivery                        |
| Formatting      | Optional pipeline formatter and linter                     | Canonical native printer output only                            |

The current defaults are visible in the plugin setup, including `asConst`, question-token optional fields, array shorthand, and type aliases: [plugin setup](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/plugin.ts#L37-L83). The full options and resolver surface are in the first-party package: [plugin types](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/types.ts).

### File, directory, and barrel behavior

Kubb supports one consolidated file or one file per schema and operation. Directory mode can add named or star-export barrels and nested barrels. Its barrel lifecycle has an explicit directory-mode branch, and a plugin-local barrel is not created for file mode: [barrel lifecycle](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/plugin-barrel/src/plugin.ts#L77-L90), [directory branch](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/plugin-barrel/src/plugin.ts#L122-L176).

Barrel files are TypeScript-specific `index.ts` artifacts. The implementation sorts the file tree and named exports before printing: [barrel extensions and filename](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/plugin-barrel/src/utils.ts#L7-L8), [tree sorting](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/plugin-barrel/src/utils.ts#L47-L98), [named export sorting](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/plugin-barrel/src/utils.ts#L139-L177).

Opalesce should start with directory output because the requested AsyncAPI contract has several independently reusable root kinds. A consolidated mode would add merge ordering and duplicate-symbol policy without helping the first use case. It can be added later as an explicit option, not inferred from the extension of `outputPath`.

### Naming and wire keys

Kubb derives valid PascalCase symbols and files and exposes resolver hooks for every generated category. It preserves exact OpenAPI parameter property names even when they require quoted TypeScript keys. Reference imports use the same resolver as declarations, so renamed targets and relocated files stay aligned: [TypeScript resolver](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/resolvers/resolverTs.ts#L6-L43), [operation-specific resolver API](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/types.ts#L9-L101).

Opalesce should keep exact wire property, header, and parameter keys. Only generated symbol and file names are normalized. The logical identity must remain the AsyncAPI source pointer plus root kind. Case-insensitive, Unicode-normalized, and reserved-file-name collisions must fail with both source pointers. The generator must not silently overwrite or add unstable numeric suffixes.

### Type aliases and interfaces

Kubb's `syntaxType: 'interface'` is a preference for object schemas, not a guarantee that every declaration becomes an interface. Union, intersection, primitive, and transformed object shapes still require type aliases. The source exposes `type` as the safer default and `interface` for declaration-merging consumers: [syntax option](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/types.ts#L230-L237).

The first Opalesce release should always emit type aliases. This produces one uniform declaration model, represents unions and intersections directly, and avoids implying that declaration merging is part of the generated API. An interface option can be added only with concrete consumer demand and golden tests for every fallback to aliases.

### Enum strategies

Kubb supports:

- `asConst`: a runtime const object and a companion `typeof` value union.
- `enum`: a runtime TypeScript enum.
- `constEnum`: a compile-time enum with toolchain constraints, including incompatibility with isolated module compilation.
- `literal`: a named literal union.
- `inlineLiteral`: a literal union at use sites.

The option variants and their applicable casing controls are defined in the package source: [enum option type](https://github.com/kubb-labs/plugins/blob/7cea5b1d01febacc618216e43655c1ffa36da5e6/packages/plugin-ts/src/types.ts#L104-L208).

Opalesce should emit named literal unions only. It is the only strategy that has no generated runtime value, does not invent member identifiers, and preserves string, number, boolean, and null values without a second naming policy. Runtime enum maps and inline expansion can be separate future features.

### Optional, nullable, read-only, and write-only properties

Kubb distinguishes optional property syntax from nullability. Requiredness determines whether the property has a question token, while a nullable schema adds `null` to the value type. Its OpenAPI adapter also uses HTTP direction: request bodies omit read-only properties and responses omit write-only properties.

Opalesce should not copy the HTTP omission rule. AsyncAPI `send` and `receive` are relative to the application, and the same message may appear in several operation contexts. First-release policy should be:

- `required` controls the question token.
- `nullable: true` or a native null branch adds `null`.
- `readOnly: true` emits a `readonly` property.
- `writeOnly: true` keeps the property and emits an `@writeOnly` annotation.
- No property is removed based on operation action.

This is a compile-time projection. It does not enforce runtime omission or validation.

### References, imports, and recursion

Kubb preserves symbolic `$ref` nodes, computes transitive schema dependencies, emits type-only imports, deduplicates imports, and avoids self-imports when output is consolidated. Its schema graph separates direct imported names, transitive dependencies, and cycles: [schema dependency closure](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/ast/src/utils/schemaGraph.ts#L48-L130), [cycle analysis](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/ast/src/utils/schemaGraph.ts#L133-L198), [reference import resolution](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/core/src/Resolver.ts#L381-L402).

Opalesce needs equivalent identity preservation, but it should not run a second parser or resolver inside the output plugin. Core must expose an immutable, Opalesce-owned normalized view with source pointers and resolved target identities. Self-recursive and mutually recursive aliases then remain ordinary TypeScript references with type-only imports between files.

External references are out of scope until Core exposes the resolved resource registry and retrieval URI under the same resolver policy used during parsing. Re-resolving inside the plugin risks using different credentials, schemes, base URIs, or security policy.

### `oneOf`, `anyOf`, `allOf`, and discriminators

Kubb maps `oneOf` and `anyOf` to TypeScript unions and `allOf` to intersections. Its OpenAPI adapter can preserve a discriminator or propagate literal discriminator fields to child variants. That propagation is OpenAPI policy, not TypeScript printer behavior: [adapter discriminator option](https://kubb.dev/adapters/adapter-oas/reference/options).

Opalesce should use:

- `oneOf` and `anyOf` as unions.
- `allOf` as an intersection.
- Shared outer object properties as an intersection with the union when required by the source shape.
- No synthesized discriminator values.

TypeScript cannot enforce the exclusivity promised by JSON Schema `oneOf`; the generated union is an assignability approximation. AsyncAPI's schema discriminator is not the same object and mapping model as OpenAPI's discriminator. A union narrows naturally only when its branch schemas already contain literal discriminants. Otherwise the plugin should preserve discriminator metadata in JSDoc and may emit a diagnostic, but must not mutate child contracts.

### `additionalProperties`

Kubb represents additional properties with index-signature-like types. When fixed properties coexist with a typed additional-property schema, a narrow string index can conflict with those fixed properties, so Kubb widens the index in that case. The output remains an approximation of JSON Schema object validation.

Opalesce first-release policy should be:

- `additionalProperties: true` becomes `[key: string]: unknown`.
- A typed `additionalProperties` schema becomes its value type only when no incompatible fixed properties exist.
- Fixed properties plus typed additional properties use `[key: string]: unknown` and retain the fixed property types.
- `additionalProperties: false` emits no index signature.

TypeScript structural typing does not create an exact closed object. The plugin must document that `additionalProperties: false`, regular expressions in `patternProperties`, and exact `oneOf` validation require a runtime validator.

### JSDoc, defaults, examples, and deprecated declarations

Kubb builds declaration and property comments from descriptions and schema annotations, including deprecated, default, examples, formats, and constraints. This metadata remains documentation and does not initialize or validate values.

Opalesce should emit:

- The source description as prose.
- `@deprecated` when present.
- `@default` with deterministic JSON serialization.
- One `@example` per example with deterministic JSON serialization.
- `@readOnly` and `@writeOnly` when relevant.
- `@discriminator` when relevant and not expressible as generated literals.

All comment terminators must be escaped. Runtime defaults, example values, validators, and serializers are separate concerns. There should be no `comments` option in the first release because Kubb's current documentation and source disagree on that option and because comments carry useful contract metadata.

### Determinism and formatting

Kubb's TypeScript parser uses the TypeScript printer, normalizes line endings, and emits source nodes, imports, and exports through a separate parser stage. Barrel names and tree traversal are sorted, while other declaration order can still follow adapter input order. Pipeline formatting is disabled by default and can be delegated to Prettier, Biome, or oxfmt: [TypeScript printer utilities](https://github.com/kubb-labs/kubb/blob/52558cd52ce46edbd809c85bd4c80c68c36f6435/packages/parser-ts/src/utils.ts#L134-L165), [pipeline formatting](https://kubb.dev/docs/5.x/reference/configuration).

Opalesce should own a smaller byte-level contract:

- Sort roots by root kind and stable logical ID.
- Sort imports and barrel exports by emitted module path and symbol.
- Preserve authored object-property order unless transformation requires a deterministic synthetic order.
- Print LF line endings and exactly one trailing newline.
- Use type-only imports and exports.
- Never read a consumer formatter configuration during generation.
- Require two identical runs over the same parsed input to produce byte-identical artifact arrays.

## Kubb architecture to reuse conceptually

Kubb separates:

1. An adapter that understands the input specification.
2. A universal semantic AST with schemas and operations.
3. A target plugin that chooses public roots and declarations.
4. File management that combines artifacts and detects ownership.
5. A parser or printer that turns target AST nodes into source text.
6. A barrel plugin that aggregates code modules.

This separation is documented in Kubb's [adapter](https://kubb.dev/docs/5.x/guide/concepts/adapters), [AST](https://kubb.dev/docs/5.x/guide/concepts/ast), and [plugin](https://kubb.dev/docs/5.x/guide/concepts/plugins) concepts.

Opalesce should reuse the separation, not the HTTP-shaped Kubb AST. The existing JSON Schema plugin research already identifies the need for stable raw reference identity. TypeScript adds the need for application interaction roots. A shared Core registry should prevent future TypeScript, Zod, validator, mock, and client plugins from independently inventing incompatible names for the same schema, message, and operation.

## Required AsyncAPI root registry

The registry must model the artifacts required for interaction with external systems:

| AsyncAPI source                                                             | Root role                   | TypeScript projection                                                              |
| --------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| `components.schemas.*`                                                      | Named reusable schema       | One named schema alias                                                             |
| `components.messages.*`                                                     | Named reusable message      | Payload alias, application-header alias, and message contract                      |
| `channels.*.messages.*`                                                     | Runtime message             | The same projections, scoped by the channel when no component identity exists      |
| `channels.*.parameters`                                                     | Channel address input       | One parameter object alias                                                         |
| `operations.*.messages`                                                     | Selected operation messages | A named union of selected message contracts                                        |
| `operations.*.reply.messages`                                               | Selected reply messages     | A named union of selected reply message contracts                                  |
| Nested schemas and referenced components                                    | Dependency                  | Embedded declaration or imported named schema, never an independent anonymous root |
| Servers, bindings, security, correlation IDs, examples, tags, documentation | Metadata                    | No standalone generic data type                                                    |

AsyncAPI 3.1 gives these objects distinct ownership: messages own payload and application headers, channels own messages and address parameters, and operations select messages from a channel and optionally from a reply channel: [Message Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#messageObject), [Channel Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#channelObject), [Operation Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#operationObject).

The registry needs at least:

- Root kind and immutable logical ID.
- Source pointer and authored name, if any.
- AsyncAPI version and effective schema format.
- Stable resolved-target identity for every reference.
- Message payload and application-header schemas as separate roles.
- Channel parameter names and their exact address keys.
- Effective operation and reply message selection after parser trait and reference processing.
- Dependency edges and diagnostics associated with their source pointers.

For AsyncAPI 2.6, the adapter should normalize channel operation messages and message `oneOf` into the same roles. Replies do not exist there. Support must be fixture-backed rather than inferred from parser acceptance.

## Proposed package and consumer API

Keep configuration and output generation as explicit package boundaries:

```ts
import { defineConfig } from "opalesce";
import typescript from "@opalesce/plugin-typescript";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
  plugins: [typescript({ outputPath: "types" })],
});
```

The facade intentionally does not re-export the plugin, so projects opt into each independently versioned plugin package they use.

First-release options should contain only:

```ts
export type TypeScriptPluginOptions = {
  outputPath?: string;
};
```

The default is `types`. The factory returns the repository's existing `OrchestrationPlugin<'typescript'>`, and generation returns ordinary `GeneratedArtifact[]`. Core remains responsible for final path containment, cross-plugin artifact collision detection, and persistence.

### Proposed output layout

```text
types/
  schemas/Order.ts
  messages/OrderCreated.ts
  channels/OrdersParameters.ts
  operations/PublishOrder.ts
  index.ts
```

Illustrative declarations:

```ts
export type OrderCreatedPayload = Order;

export type OrderCreatedHeaders = {
  readonly traceId: string;
};

export type OrderCreatedMessage = {
  payload: OrderCreatedPayload;
  headers: OrderCreatedHeaders;
};

export type PublishOrderMessage = OrderCreatedMessage | OrderRejectedMessage;
export type PublishOrderReplyMessage = OrderAcceptedMessage;
```

The wrapper is an application contract that keeps payload and headers related. It is not a claim that the broker serializes a JSON object with literal `payload` and `headers` fields. The design specification must define absent payload and absent headers before implementation. Recommended initial rule:

- Always expose `payload`, using `unknown` only when the AsyncAPI message has no payload schema.
- Expose `headers` only when an application-header schema is declared.
- Do not include protocol headers or binding fields in this wrapper.

Channel parameters preserve exact parameter keys and represent unconstrained parameters as `string`. When the AsyncAPI parameter has an enum, use the corresponding literal union. Operation and reply aliases are emitted even for one selected message so consumers have a stable operation-level symbol.

### Naming policy

- Public symbols use PascalCase plus a role suffix: `Payload`, `Headers`, `Message`, `Parameters`, or `ReplyMessage`.
- Component names own their namespace. Inline channel messages use channel plus message identity. Operation roots use operation ID.
- File paths are grouped by root kind so a schema and message with the same authored name do not collide.
- Property, header, and channel parameter keys remain byte-for-byte wire names and are quoted when they are not valid identifiers.
- Missing stable operation or message names are derived from the exact source pointer by one documented algorithm.
- Any emitted-symbol or case-folded-file collision is an error that reports all source pointers.
- No custom resolver, casing option, or numeric collision suffix is part of the first delivery.

## Kubb versus Modelina

| Criterion                  | Kubb                                                    | Modelina 5.10.1                                          | Modelina 6.0.0 next.17                                                      | Recommendation                                       |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Native focus               | OpenAPI adapter and HTTP operation types                | Multi-input model generator including AsyncAPI           | Same, with expanded AsyncAPI processor                                      | Keep Opalesce's AsyncAPI adapter                     |
| AsyncAPI 3.1               | Not the input adapter being evaluated                   | Not supported                                            | Supported                                                                   | Do not use stable Modelina for 3.1                   |
| Payloads                   | OpenAPI schemas and bodies                              | Generated from reachable AsyncAPI message payloads       | Generated from reachable payloads                                           | Insufficient root coverage                           |
| Application headers        | OpenAPI parameter headers, not AsyncAPI message headers | Not emitted                                              | Optional schema models via `includeMessageHeaders`                          | Still lacks message contract linkage                 |
| Channel parameters         | No AsyncAPI concept                                     | Not emitted                                              | Not emitted                                                                 | Opalesce must own this root                          |
| Operation message unions   | HTTP response and options roots                         | Multiple messages combined under a channel ID            | Payload and header unions combined under a channel ID                       | Need operation-specific identities and replies       |
| `components.schemas` roots | Yes for OpenAPI                                         | Dependencies reached through payload processing          | Has name mapping, but public processing remains message-reachability driven | Opalesce requires all named schema roots             |
| Output integration         | Kubb file manager and barrel                            | Returns generated models, optional direct file generator | Returns generated models, optional direct file generator                    | Adapt to `GeneratedArtifact[]`, never write directly |
| Stability                  | v5 beta with documented drift                           | Stable release                                           | Prerelease                                                                  | Prefer a narrow owned emitter first                  |

Stable Modelina explicitly lists AsyncAPI 2.0 through 2.6 and 3.0, not 3.1: [stable supported versions](https://github.com/asyncapi/modelina/blob/e208302f94667f8b187d028aad8054baff5ee523/src/processors/AsyncAPIInputProcessor.ts#L30-L40). Its processor walks operations and replies but adds payload schemas only, combining multiple messages with a channel ID: [stable payload traversal](https://github.com/asyncapi/modelina/blob/e208302f94667f8b187d028aad8054baff5ee523/src/processors/AsyncAPIInputProcessor.ts#L105-L183).

The next processor adds 3.1 to the supported list: [next supported versions](https://github.com/asyncapi/modelina/blob/dd3b8b69e81f876cb86c0b5a097d1c4d7146a92d/src/processors/AsyncAPIInputProcessor.ts#L60-L71). It can add application headers only when `includeMessageHeaders` is true, and its multi-message aggregate is still keyed by the channel rather than by each operation selection: [next message traversal](https://github.com/asyncapi/modelina/blob/dd3b8b69e81f876cb86c0b5a097d1c4d7146a92d/src/processors/AsyncAPIInputProcessor.ts#L306-L456).

Modelina can be reconsidered after the registry exists by passing one normalized schema root at a time to its TypeScript generator and consuming returned source models rather than its filesystem writer. That spike must prove exact naming, recursive references, nullable and optional semantics, JSDoc preservation, deterministic output, and compatibility with Opalesce's fixed literal-union policy. Until then, an abstraction around a hypothetical renderer would be speculative.

## First delivery boundary

The minimal useful delivery is not `components.schemas` alone. It is a complete compile-time data contract for an AsyncAPI interaction.

### In scope

- A shared Opalesce interaction root registry with stable identities and source pointers.
- AsyncAPI 2.6, 3.0, and 3.1 only when each version has fixtures for the same supported semantics.
- Native AsyncAPI Schema Objects and explicit JSON Schema Draft 07 schemas.
- Named component schemas, reusable and channel messages, payloads, application headers, channel parameters, operation message unions, reply message unions, and nested dependencies.
- Type aliases for primitives, literals, objects, tuples, arrays, unions, intersections, refs, and recursive refs.
- Required, optional, nullable, read-only, write-only, enum, composition, discriminator annotation, and additional-properties policies described above.
- Descriptions, deprecated, defaults, and examples as JSDoc.
- Directory artifacts and a named type-only barrel.
- Configuration from `opalesce` plus TypeScript generation from `@opalesce/plugin-typescript`.

### Non-goals

- Runtime validation, parsing, serialization, default application, codecs, or example generation.
- Broker clients, producers, consumers, routers, handlers, transport envelopes, or protocol binding code.
- Runtime enum objects, TypeScript enums, classes, interfaces, decorators, namespaces, or declaration merging.
- Kubb-compatible options, naming, output layout, or generated HTTP artifacts.
- File mode, nested barrels, tags or paths grouping, include or exclude filters, overrides, macros, custom resolvers, custom printers, banners, and formatters.
- Independent data types for servers, bindings, security, correlation IDs, examples, tags, or documentation.
- Exact enforcement of `oneOf`, closed objects, regex property constraints, numeric ranges, string formats, or other runtime JSON Schema validation semantics.
- Foreign schema formats until a parser converter and semantic fixture set are explicitly added.
- External reference output until Core exposes the resolved resource registry under one documented resolver and security policy.

## Acceptance and validation strategy

Required corpus cases:

- AsyncAPI 2.6, 3.0, and 3.1 versions of equivalent message interactions.
- Named and unused component schemas.
- Component messages, inline channel messages, payload-only, headers-only, payload plus headers, and messages with neither.
- Exact operation selection, omitted selection fallback, multiple selected messages, one selected message, replies, and omitted reply selection fallback.
- Channel parameters with invalid TypeScript identifier characters and constrained values.
- Internal refs, repeated refs, self recursion, mutual recursion, and dependency chains across root kinds.
- `oneOf`, `anyOf`, `allOf`, discriminator with literal branches, discriminator without literal branches, and shared outer properties.
- Required, optional, nullable, read-only, write-only, arrays, tuples, literal enums, and empty enums.
- `additionalProperties` true, false, typed, and typed with fixed properties.
- Descriptions containing comment terminators, deprecated, default, scalar and object examples.
- Invalid symbol names, path traversal, Windows-reserved files, case-only collisions, Unicode-normalization collisions, and cross-kind names.
- Unsupported schema formats, missing references, and unsupported external references with source-pointer diagnostics.

Validation must include:

- Golden artifact fixtures for path, content, import order, and barrel order.
- `tsc --noEmit` over every fixture with `strict`, `isolatedModules`, and `exactOptionalPropertyTypes` enabled.
- Type-level positive and negative assignments for generated contracts.
- Consumer import tests composing `opalesce` with `@opalesce/plugin-typescript`.
- Two generation runs with byte-for-byte equality of sorted `GeneratedArtifact[]`.
- Targeted package tests first, then the repository's native affected lint, typecheck, and test targets.

## Main risks and follow-ups

- Core now owns the target-neutral interaction contract and exposes it lazily as `PluginContext.interaction`. TypeScript consumes that contract directly; future Zod, validator, mock, and client plugins should reuse it rather than normalize the parser document independently.
- Message wrappers are an application-facing modeling choice, not a standardized wire envelope. The absent payload and header rules must be accepted in the design artifact before implementation.
- AsyncAPI 2.6 and 3.x place messages and schema formats differently. Version normalization must be tested at the adapter boundary rather than leaking version checks into the TypeScript printer.
- TypeScript is less expressive than JSON Schema. The generated types help compile-time use but do not replace runtime validation.
- Kubb v5 beta behavior is not a stable compatibility contract. Pin every copied observation to source and keep Opalesce options independent.
- Modelina 6.x improves AsyncAPI coverage but is prerelease and still misses required root semantics. Re-evaluate it only behind a fixture-backed renderer spike.
- Artifact naming becomes a public API. Collision rejection is safer than silent renaming, but the exact anonymous-root derivation algorithm must be frozen before publication.
- Keeping the factory out of `opalesce` prevents a package graph edge and lets consumers opt into output plugins independently. Verify that `@opalesce/plugin-typescript` depends only on the Core contract rather than the facade.
