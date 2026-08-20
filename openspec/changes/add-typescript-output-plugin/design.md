## Context

Core parses each document once with the official `@asyncapi/parser`, passes its semantic model and diagnostics to plugins, and optionally retains the unresolved source snapshot. The JSON Schema plugin intentionally exports only `components.schemas`. TypeScript and the planned Zod output instead need the complete data boundary: named schemas, payloads, application headers, channel parameters, effective operation messages, and replies.

Kubb is an architectural reference rather than an AsyncAPI implementation. Its separation between input adaptation, schema projection, naming, file planning, and TypeScript printing transfers to this plugin, while its HTTP-specific artifacts do not. The source review and Modelina comparison are recorded in [TypeScript output plugin research](../../../docs/research/typescript-output-plugin.md).

The current `PluginContext` contains `document`, `diagnostics`, and optional `source`. If TypeScript and Zod each derive their own interaction roots, they can disagree about AsyncAPI version shapes, inline ownership, effective messages, and references. The shared semantic boundary therefore belongs to Core, while every target representation remains plugin-owned.

## Goals / Non-Goals

**Goals:**

- Add one target-neutral `InteractionContract` to plugin execution context.
- Normalize AsyncAPI 2.6, 3.0, and 3.1 interaction roots and relationships once per pipeline context.
- Preserve exact version, stable identities, source pointers, schema formats, dependencies, wire keys, recursion, traits, and effective message selections.
- Generate deterministic static TypeScript contracts for external-system data exchange.
- Keep `opalesce` as the primary entry point for configuration, plugin authoring, and contract types while official output plugins are independent `@opalesce/plugin-*` packages.

**Non-Goals:**

- Replace the complete parser document or expose servers, bindings, security, and extensions through the interaction contract.
- Generate clients, servers, transports, validators, serializers, mocks, Zod schemas, runtime enums, or runtime message envelopes.
- Parse again, fetch references during normalization, or introduce a second resolver policy.
- Convert Avro, OpenAPI, RAML, Protobuf, or unknown schema formats.
- Express validation semantics TypeScript cannot enforce, including exact `oneOf`, patterns, ranges, unique items, conditionals, and exact closed objects.
- Add Kubb-compatible file modes, filters, naming hooks, formatter orchestration, interfaces, classes, or configurable syntax strategies.
- Publish packages or change artifact persistence and CLI output ownership.

## Decisions

### Core owns the interaction contract

Add `packages/core/src/interaction` with public readonly contracts and an internal builder. `PluginContext` becomes:

```ts
interface PluginContext {
  readonly document: AsyncAPIDocumentInterface;
  readonly interaction: InteractionContract;
  readonly diagnostics: readonly Diagnostic[];
  readonly source?: AsyncAPISource;
}
```

Core creates a frozen context with an enumerable `interaction` getter. The getter builds the contract on first access, caches either the value or thrown error in the pipeline closure, and returns the same value to later plugins. Plugins that never access the property do not trigger normalization. A construction error occurs while the consuming plugin executes and is therefore wrapped by the existing `PluginExecutionError` with that plugin's name.

The property is always present in the public type and at runtime. It is not optional because output plugins must not branch on whether shared semantics happen to be available. Lazy construction preserves the behavior of plugins that only need `document`, including parsed versions outside this contract's explicit support.

Core exports `InteractionContract` and its root contracts. The `opalesce` facade re-exports those types. There is no `createInteractionModel` public helper, no separate interaction package, and no interaction entry in the user's plugin list.

### Contract and parser document have different purposes

`document` remains the complete official parser model for plugins that need bindings, servers, security, extensions, or other AsyncAPI metadata. `source` remains the optional authored unresolved snapshot. `interaction` contains only the normalized data-exchange graph shared by target generators.

The contract contains sorted schema, message, channel, and operation roots. Operation roots contain their optional reply contract. Every root has a kind-qualified identity, source pointer, exact source version, and authored or owner-derived name. Schema-bearing roles retain the official readonly `SchemaInterface`, effective schema format, and dependency identities.

Contract-owned arrays and metadata objects are recursively frozen. Parser-owned `SchemaInterface` instances are retained by reference and are never frozen or mutated. The public type exposes them as readonly semantic handles even though their runtime class is owned by `@asyncapi/parser`.

### Parser models remain authoritative

The builder consumes only `PluginContext.document`. It uses parser models and `ModelMetadata.pointer` for resolved identities, applied traits, operation channels, effective message selections, and replies. It does not traverse unresolved source to reconstruct relationships already provided by the parser.

AsyncAPI 3.0 and 3.1 use channel, message, and operation map identities. AsyncAPI 2.6 uses component names and `operationId` where present; otherwise exact channel identity plus publish or subscribe provides a deterministic operation identity. Publish normalizes to `send`, and subscribe normalizes to `receive`.

The contract records foreign schema formats without converting them. A target plugin chooses whether to support a format. A resolved external model is usable only if parser metadata provides a stable identity; otherwise construction fails rather than resolving again.

### Focused dependency direction prevents cycles

Add `packages/plugin-typescript` as one independently publishable output plugin. The production graph is:

```text
opalesce -> @opalesce/core -> @asyncapi/parser
@opalesce/plugin-typescript -> @opalesce/core
```

The plugin does not depend on the facade. Core and the facade do not depend on the TypeScript plugin or compiler. Consumer tests prove the two public imports compose without introducing reverse project references or a transitive plugin dependency.

The `@opalesce/plugin-typescript` package default-exports `typescript` and exports `TypeScriptPluginOptions`. The `opalesce` facade does not re-export either. The first option is intentionally narrow:

```ts
interface TypeScriptPluginOptions {
  readonly outputPath?: string;
}
```

`outputPath` defaults to `types`.

### Modelina is not a first-delivery dependency

Stable `@asyncapi/modelina` 5.10.1 accepts AsyncAPI only through 3.0 and its document processor selects payload models without all required headers, channel parameters, wrappers, or operation-specific identities. The 6.x line adds 3.1 and optional headers but remains prerelease and still does not own the required contract graph.

Using only Modelina rendering would still require Opalesce to implement normalization, schema projection, naming, references, file assembly, and the fixed output policy. Its JSON Schema processor can also dereference independently, which violates the single resolver boundary. The first delivery uses the official TypeScript compiler factory and printer. Modelina can be reconsidered behind conformance fixtures after the Core contract is stable.

### The plugin owns a narrow target AST

The TypeScript plugin converts schema roles into a target AST for unknown, never, primitives, literals, arrays, tuples, objects, references, unions, intersections, property requiredness, nullability, read-only metadata, index signatures, and JSDoc.

Reference nodes retain interaction dependency identity instead of expanding graphs. The planner maps those identities through the completed naming table, removes same-file imports, and terminates for recursive graphs. The TypeScript compiler factory produces declarations and type-only imports and exports. The printer emits LF output. Generated strings are not reparsed for formatting and consumer formatter configuration is ignored.

### Public roots cover the data interaction boundary

The plugin emits:

- every named component schema, including unused schemas;
- every reusable component message and effective channel message;
- a payload alias, optional headers alias, and wrapper for each message;
- a channel-parameter object for each parameterized channel;
- an effective message alias for every operation;
- a reply-message alias for every operation with replies.

A message always exposes `payload`. When no payload schema exists, the payload alias is `unknown`. The wrapper exposes `headers` only for application headers. Binding and protocol header metadata do not become data properties.

```ts
export type UserCreatedPayload = User;

export type UserCreatedHeaders = {
  readonly traceId: string;
};

export type UserCreatedMessage = {
  payload: UserCreatedPayload;
  headers: UserCreatedHeaders;
};
```

A referenced payload still receives a message-owned payload alias. Parameter keys retain their exact wire form, and a parameter without a schema becomes `string`. Operation and reply aliases are emitted even for one selected message so imports remain operation-oriented and stable.

### Schema projection uses fixed wire-value mappings

The first delivery maps:

- JSON string, number, integer, boolean, and null to TypeScript `string`, `number`, `number`, `boolean`, and `null`;
- supported string formats to `string` and boolean schemas to `unknown` or `never`;
- const and enums to literal types and unions without runtime values;
- required properties to required members and other properties to `?`;
- nullable values to unions with `null`;
- read-only properties to `readonly` and write-only properties to retained members with `@writeOnly`;
- homogeneous arrays and tuples to array and tuple syntax;
- `allOf` to intersections and `anyOf` and `oneOf` to unions;
- `additionalProperties: true` to `[key: string]: unknown`;
- compatible typed additional properties to their value type, otherwise to `unknown`;
- `additionalProperties: false` to no index signature;
- descriptions, deprecation, defaults, examples, formats, constraints, access metadata, and discriminators to deterministic JSDoc where relevant.

The plugin does not synthesize discriminator fields. Unions narrow only when source branches already contain literal discriminants. Validation-only semantics remain documented approximations.

### Naming and files are deterministic

Public symbols use role-aware PascalCase names:

- `<Schema>`;
- `<Message>Payload`, `<Message>Headers`, `<Message>Message`;
- `<Channel>Parameters`;
- `<Operation>Message`, `<Operation>ReplyMessage`.

Component identities own their namespace, inline messages include channel ownership, and nested declarations include root ownership. Wire property names are never recased. The planner rejects public symbol collisions and per-directory filename collisions after NFC and lowercase normalization, including portable reserved filenames. It never appends counters.

The output topology is fixed:

```text
types/
  schemas/<Schema>.ts
  messages/<Message>.ts
  channels/<Channel>Parameters.ts
  operations/<Operation>.ts
  index.ts
```

Cross-file references use sorted `import type` declarations and relative `.js` specifiers. The barrel has explicit sorted `export type` declarations for public symbols only. The plugin returns the barrel first and remaining artifacts in lexicographic path order. Files use LF, two spaces, no byte-order mark, and one trailing newline.

### Errors are atomic and source-attributed

Contract normalization, schema projection, naming, planning, rendering, and syntax validation complete before an artifact array is returned. Contract and plugin errors have stable codes plus relevant source pointer and identity, format, reference, or naming detail. Core wraps failures with the consuming plugin name.

The TypeScript plugin accepts native AsyncAPI schemas and explicit JSON Schema Draft 07 roles for AsyncAPI 2.6, 3.0, and 3.1. Foreign formats fail in the plugin, not the target-neutral Core contract. Neither Core normalization nor the plugin performs filesystem or network access.

### Conformance covers Core and consumer behavior

Core owns fixtures that assert contract roots, identities, pointers, selections, replies, traits, dependencies, immutability, laziness, memoization, and parser preservation. The plugin owns self-contained corpus cases with complete expected trees.

Successful plugin cases run twice through Core, compare paths and bytes, compile with strict NodeNext settings, and include positive plus `@ts-expect-error` assignments. The corpus covers supported versions, reusable and inline messages, payloads and headers, parameters, operations, replies, traits, used and unused schemas, recursion, composition, nullability, access annotations, enums, additional properties, unsafe names, collisions, formats, empty interactions, and ordering.

A facade-owned integration fixture imports configuration helpers from `opalesce` and the generator from `@opalesce/plugin-typescript`, persists output through the CLI, imports the generated barrel, and compiles a consumer.

## Risks / Trade-offs

- [Core contract becomes target-specific] -> Keep language names, target AST, validation approximations, and file planning inside output plugins.
- [Contract construction changes unrelated plugins] -> Use a memoized lazy context getter and test that unused access performs no work.
- [Contract duplicates parser models] -> Store stable registry metadata and normalized relationships while retaining official schema handles.
- [Parser-owned models appear immutable but are not frozen] -> Expose readonly types, freeze only contract-owned values, and test that normalization never mutates parser instances.
- [TypeScript approximates validation] -> Document limitations and never claim runtime validation equivalence.
- [Recursive graphs expand indefinitely] -> Track parser object identity and emit symbolic dependency identities.
- [External identities are unstable] -> Fail without another resolution path.
- [Compiler printer output changes] -> Pin TypeScript through the lockfile and review exact golden changes on upgrades.

## Implementation Review Follow-ups

The first implementation review found four acceptance defects that remain part of this delivery rather than optional post-delivery enhancements:

- [#14](https://github.com/ravecat/opalesce/issues/14) - derive AsyncAPI 2.6 operation identities from the exact channel identity and publish or subscribe role when `operationId` is absent. Parser fallback IDs such as `publish` and `subscribe` are not authored identities and cannot distinguish same-role operations on different channels.
- [#15](https://github.com/ravecat/opalesce/issues/15) - make the target-AST assignability check structural enough to widen incompatible schema-valued `additionalProperties` to `unknown` before rendering. Successful generation must not return TypeScript that fails strict semantic compilation.
- [#16](https://github.com/ravecat/opalesce/issues/16) - assign owner-scoped private identities and declarations to recursive anonymous schemas. These declarations remain in the owning file and never enter the public barrel.
- [#17](https://github.com/ravecat/opalesce/issues/17) - distinguish ordinary anonymous inline schemas from parser-resolved reference targets and reject a resolved target that has no stable representable interaction identity without invoking another resolver.

Each correction requires a focused Core or plugin regression plus coverage in the complete strict-compilation corpus. Feature #13 remains incomplete until all four behaviors satisfy the capability specifications.

## Migration Plan

1. Update Core public contracts, add the lazy interaction getter, and verify existing plugins without accessing it.
2. Implement version normalization, identity registry, dependency graph, errors, and Core contract fixtures.
3. Scaffold `@opalesce/plugin-typescript`, then implement projection, naming, planning, printing, and conformance.
4. Keep the `opalesce` facade limited to Core, configuration, and orchestration exports.
5. Add CLI and consumer compilation coverage using the facade and independent plugin package together, then run focused plus aggregate validation.
6. Document the context field, package boundary, plugin import, output surface, and validation limitations.

Rollback removes the additive context getter, Core contract modules and exports, facade type exports, and the TypeScript plugin package. Existing persisted artifacts require no migration.

## Open Questions

None. Zod output, Modelina integration, configurable syntax, runtime constants, and broader schema formats require separate changes while consuming the same Core interaction contract.
