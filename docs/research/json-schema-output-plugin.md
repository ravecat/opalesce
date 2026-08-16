# JSON Schema output plugin research

Date: 2026-08-06

Last reviewed: 2026-08-11

## Decision summary

The implemented shape is reasonable as a deliberately narrow component-schema catalog, but it is not an AsyncAPI-standard export format and was not copied from Kubb. AsyncAPI standardizes the source schema locations, dialect rules, and references. Opalesce chooses the output roots, the one-file layout, and the pointer rewrite.

Keep the existing division of responsibility:

- `@asyncapi/parser` parses and validates the AsyncAPI document.
- Opalesce performs the policy-specific extraction and changes `#/components/schemas/*` into the output namespace.
- Ajv checks the generated Draft 07 artifact and compiles every exported root.

No maintained library found replaces those three responsibilities end to end. A JSON Schema bundler becomes useful when external schema resources are added, but it still cannot decide which AsyncAPI objects are public roots or define Opalesce's output layout.

Before publication, resolve one standards mismatch: Draft 07 says `$schema` must not appear in a subschema, while every value under the catalog's `definitions` is a subschema. The one-file option should therefore reject conflicting dialects and omit redundant component-level Draft 07 `$schema` values. Emitting every component as a separate root document is the alternative if exact preservation of component-level `$schema` is required: [JSON Schema Draft 07 `$schema`](https://json-schema.org/draft-07/json-schema-core#rfc.section.7).

## Post-implementation audit: standard versus project policy

The version contracts are narrower than the general phrase "AsyncAPI schemas":

- AsyncAPI 2.6 places `schemaFormat` on a Message Object and allows `components.schemas` to contain only native Schema Objects or Reference Objects: [AsyncAPI 2.6 Message and Components Objects](https://github.com/asyncapi/spec/blob/v2.6.0/spec/asyncapi.md#componentsObject).
- AsyncAPI 3.0 and 3.1 allow a native Schema Object, Multi Format Schema Object, or Reference Object in `components.schemas`. Implementations must support the native AsyncAPI schema format and explicit JSON Schema Draft 07: [AsyncAPI 3.0 Components and schema formats](https://www.asyncapi.com/docs/reference/specification/v3.0.0#componentsObject), [AsyncAPI 3.1 Components and schema formats](https://www.asyncapi.com/docs/reference/specification/v3.1.0#componentsObject).
- In all three supported versions, the native Schema Object is a Draft 07 superset. Its `$ref` follows the AsyncAPI Reference Object's JSON Reference behavior, not newer JSON Schema reference semantics: [AsyncAPI 2.6 Schema Object](https://github.com/asyncapi/spec/blob/v2.6.0/spec/asyncapi.md#schemaObject), [AsyncAPI 3.1 Schema Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#schemaObject).

The output shape is partly standard and partly Opalesce policy:

- Draft 07 defines `definitions` as the standardized place for inline reusable schemas, so `definitions` rather than `$defs` is correct for this dialect. The keyword does not affect validation by itself: [JSON Schema Draft 07 `definitions`](https://json-schema.org/draft-07/json-schema-validation#rfc.section.9).
- Consequently, `schemas.json` with only `$schema` and `definitions` accepts every JSON instance at its root. A consumer must compile a fragment such as `schemas.json#/definitions/Event`. The artifact is a catalog of roots, not a schema for an event union.
- AsyncAPI does not prescribe moving `components.schemas` into `definitions`. The rewrite is necessary only because Opalesce relocates schemas from the AsyncAPI document into a standalone JSON Schema document.
- The official JSON Schema bundling algorithm was documented in 2020-12. It embeds independently identified schema resources without changing their references. That algorithm cannot be applied directly to ordinary AsyncAPI components because they often have no absolute `$id`, and their references are pointers into the AsyncAPI document: [JSON Schema 2020-12 bundling](https://json-schema.org/draft/2020-12/json-schema-core#section-9.3.1).

Kubb influenced only the architectural principle of separating input adaptation, semantic roots, and target emitters. Its shipped adapter is for OpenAPI, and its official plugins generate TypeScript, Zod, clients, mocks, and documentation rather than an AsyncAPI-to-JSON-Schema catalog: [Kubb adapters](https://kubb.dev/docs/5.x/guide/concepts/adapters), [Kubb plugins](https://kubb.dev/docs/5.x/guide/concepts/plugins). No Kubb implementation was reused for the current bundle shape.

## What the repository already provides

- [`PluginContext`](../../packages/core/src/orchestrator/types.ts) currently exposes only the parsed `document` and diagnostics. A plugin returns final text artifacts and Core handles path validation and collisions.
- [`parseAsyncAPI`](../../packages/core/src/parseAsyncAPI.ts) uses `@asyncapi/parser` 3.6.0 but discards `ParseOutput.extras`. In this parser version, `extras.document.data` retains the unresolved parsed document while `document.json()` is built from the resolved graph. This is the cleanest available source for reference-preserving export, but Core should copy it into an Opalesce-owned public value rather than expose a Spectral `Document` directly. The source URI is also needed for relative references.
- Core already forwards parser constructor options, including custom schema parsers and resolver configuration. The output plugin runs after parsing, so it cannot retroactively register a converter.
- Core and CLI unit tests prove the generic output-plugin shape, but no reusable output-plugin package existed before this change. Reusable plugins should own their consumer config and expected artifact fixtures instead of extending a repository-global smoke config.
- Opalesce tests AsyncAPI 3.0 and 3.1. The installed AsyncAPI schema package also contains 2.0 through 2.6, but 2.x must not be promised by the new plugin until plugin fixtures cover it.

The current architecture explicitly expects each plugin to derive its own generator model. A shared normalized schema model is not needed for this first concrete plugin.

## AsyncAPI version and dialect behavior

AsyncAPI 2.x keeps `schemaFormat` on the Message Object and applies it to `payload`. AsyncAPI 3.x moves `schemaFormat` beside `schema` in a Multi Format Schema Object. The official migration guide illustrates this structural difference directly: [Migrating to AsyncAPI v3](https://www.asyncapi.com/docs/migration/migrating-to-v3#schema-format-and-schemas).

AsyncAPI 3.1 requires implementations to support its native Schema Object and JSON Schema Draft 07. Avro, OpenAPI, RAML, and Protobuf are recommended or custom formats rather than interchangeable JSON Schemas. Referenced resources must use the same `schemaFormat` as the referring schema: [AsyncAPI 3.1 Multi Format Schema Object and format table](https://www.asyncapi.com/docs/reference/specification/v3.1.0#multiFormatSchemaObject).

The native AsyncAPI Schema Object is a superset of JSON Schema Draft 07, supports object and boolean schemas, and adds AsyncAPI semantics and annotations. Its `$ref` follows AsyncAPI Reference Object behavior rather than newer JSON Schema `$ref` behavior: [AsyncAPI 3.1 Schema Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#schemaObject). The corresponding 2.x contract is recorded in the [AsyncAPI 2.6 specification](https://github.com/asyncapi/spec/blob/v2.6.0/spec/asyncapi.md).

Consequences:

- Draft 07 is the only safe default output dialect.
- Do not automatically migrate to 2019-09 or 2020-12. Array keywords, reference behavior, dependency keywords, and vocabulary processing differ.
- An authored `$schema` that conflicts with `schemaFormat` must be a generation error, not silently overwritten.
- A boolean schema is a complete valid artifact and must not be rejected as a non-object.

## Confirmed parser behavior

The following was verified against the installed 3.6.0 package and its tagged source.

- `document.components().schemas()` discovers named reusable schemas. `document.schemas()` and `document.allSchemas()` traverse nested schemas too, so they include property schemas and anonymous schemas and are unsuitable as a one-file-per-entry list without a separate naming policy. See [`schemasFromDocument`](https://github.com/asyncapi/parser-js/blob/9a57fa2f8b76113c4f80f341542f79f625cf2569/packages/parser/src/models/utils.ts#L20-L38).
- `schema.id()` is not equivalent to JSON Schema `$id`. It can return an explicit `$id`, a component identifier, or a parser-generated anonymous identifier. Only `schema.$id()` represents the authored JSON Schema identifier.
- In AsyncAPI 2.x, `message.payload().json()` is the payload schema. In AsyncAPI 3.x, an explicit Multi Format payload keeps the outer `{ schemaFormat, schema }` in `.json()`, while schema accessors operate on the inner `schema`: [v3 Schema model](https://github.com/asyncapi/parser-js/blob/9a57fa2f8b76113c4f80f341542f79f625cf2569/packages/parser/src/models/v3/schema.ts#L18-L32).
- The parser validates, resolves, copies, and models the resolved document. Repeated and recursive references become shared object identities: [parser parse flow](https://github.com/asyncapi/parser-js/blob/9a57fa2f8b76113c4f80f341542f79f625cf2569/packages/parser/src/parse.ts#L20-L73). A self-referencing payload therefore makes `JSON.stringify(payload.json())` throw `TypeError: Converting circular structure to JSON`.
- Parser `stringify()` is an internal graph serialization format and emits strings such as `$ref:$.path`; these are not standard JSON Schema `$ref` values and must not be published as artifacts.
- Custom schema parsers replace a foreign-format payload with their converted AsyncAPI Schema representation and retain the original under parser metadata. The current flow is visible in [`parse-schema.ts`](https://github.com/asyncapi/parser-js/blob/9a57fa2f8b76113c4f80f341542f79f625cf2569/packages/parser/src/custom-operations/parse-schema.ts#L39-L119).

One pinned-version edge case needs a regression test: the v3 Schema model recognizes a Multi Format wrapper only when `typeof wrapper.schema === "object"`. A wrapper containing `schema: false` is misclassified. If reproduced through the supported parse path, report it upstream and either reject that case with a clear diagnostic or work from the unresolved document instead of the model.

## References, identifiers, and artifact names

Extracting a component verbatim breaks references such as `#/components/schemas/Address`, because the generated schema has a different root. Fully dereferencing is not a solution: it creates cycles, duplicates content, and can change reference semantics. JSON Schema explicitly warns that removing references is not always behavior-preserving: [JSON Schema 2020-12, reference removal](https://json-schema.org/draft/2020-12/json-schema-core#section-b.2).

Bundling is the appropriate transport shape. JSON Schema defines a compound document as embedded schema resources that preserve reference resolution, and recommends keeping embedded resources under a definitions location appropriate to the dialect: [JSON Schema 2020-12 bundling](https://json-schema.org/draft/2020-12/json-schema-core#section-9.3.1). For the recommended Draft 07 output, use `definitions`, not `$defs`.

The plugin should:

- Preserve every authored `$id`; do not equate it with a component key or file name.
- Do not add a configurable bundle `$id` in the first delivery. Reject relative identifiers without an absolute authored ancestor and component references whose authored `$id` scope prevents safe bundle-local rewriting.
- Fail on duplicate `$id` values.
- Use component keys as logical artifact labels only.
- Sanitize file names, reject path traversal and Windows-reserved names, and detect case-insensitive collisions before returning artifacts.
- Strip keys reserved by the parser, not all `x-*` extensions.
- Default external HTTP and file resolution to disabled unless the user opts into a documented policy. This avoids unintended network access, SSRF, and arbitrary local file reads.

## Available libraries

No first-party ready-made AsyncAPI-to-JSON-Schema artifact exporter was found. Concrete keep or replace decisions:

| Responsibility                                                                                                                                    | Library                                                                                                        | Decision                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AsyncAPI syntax, version validation, model discovery, and schema-format dispatch                                                                  | [`@asyncapi/parser`](https://github.com/asyncapi/parser-js)                                                    | Keep. It already owns these concerns. Its custom schema parsers convert foreign payload formats into the AsyncAPI Schema Format, but the parser does not define a standalone JSON Schema artifact layout.                                                                                                                                      |
| Select `components.schemas`, unwrap the AsyncAPI 3 wrapper, strip parser metadata, and map the AsyncAPI pointer namespace to the output namespace | None                                                                                                           | Keep a small Opalesce adapter. These are product policy decisions, not generic parsing or JSON Schema bundling.                                                                                                                                                                                                                                |
| Draft 07 meta-validation and reference closure                                                                                                    | [`ajv`](https://ajv.js.org/json-schema.html) and [`ajv-formats`](https://github.com/ajv-validator/ajv-formats) | Keep. `validateSchema()` and per-definition compilation test the transformed output, which the earlier AsyncAPI validation cannot guarantee: [Ajv API](https://ajv.js.org/api.html).                                                                                                                                                           |
| Bundle external JSON Schema resources while preserving canonical identifiers                                                                      | [`@hyperjump/json-schema`](https://github.com/hyperjump-io/json-schema)                                        | Best candidate for a future external-resource feature. It supports Draft 07 and implements the official compound-document bundling process, but it expects JSON Schema resources with retrieval URIs or `$id` and does not extract AsyncAPI components.                                                                                        |
| Generic parse, resolve, bundle, or dereference of `$ref`                                                                                          | [`@apidevtools/json-schema-ref-parser`](https://apidevtools.com/json-schema-ref-parser/docs/ref-parser.html)   | Do not add for the current internal-only rewrite. `bundle()` can help with external files, but it chooses its own internal locations; `dereference()` can create cyclic object graphs. File and HTTP resolvers also require an explicit security policy: [resolver options](https://apidevtools.com/json-schema-ref-parser/docs/options.html). |
| Whole-document external reference bundling                                                                                                        | [`api-ref-bundler`](https://github.com/udamir/api-ref-bundler)                                                 | Optional future spike, not a replacement for extraction or dialect handling. Kubb adopted it because preserving named component identity mattered for code generation after `$RefParser.bundle()` relocated schemas to first-occurrence paths: [Kubb changelog](https://kubb.dev/docs/5.x/changelog).                                          |
| AsyncAPI version migration                                                                                                                        | [`@asyncapi/converter`](https://github.com/asyncapi/converter-js)                                              | Do not use here. It migrates complete AsyncAPI versions and explicitly leaves external references unresolved; it does not export component JSON Schemas.                                                                                                                                                                                       |
| General generation framework                                                                                                                      | [`@asyncapi/generator`](https://github.com/asyncapi/generator)                                                 | Do not embed. A custom template could reproduce the plugin, but would duplicate Opalesce's orchestration boundary rather than remove transformation policy.                                                                                                                                                                                    |
| Programming-language model generation                                                                                                             | [`@asyncapi/modelina`](https://github.com/asyncapi/modelina)                                                   | Do not use. It generates typed source models from AsyncAPI, OpenAPI, or JSON Schema inputs rather than emitting source JSON Schemas.                                                                                                                                                                                                           |

The official parser lists Avro, OpenAPI 3.0, and RAML custom schema parsers. They must be registered before parsing and convert into the AsyncAPI Schema Format: [`@asyncapi/parser` custom schema parsers](https://github.com/asyncapi/parser-js#custom-schema-parsers). They should remain opt-in input adapters. The current plugin intentionally reads the unresolved authored snapshot, so supporting their converted output would require a new Core contract rather than a hidden dependency in `buildBundle`.

## Generation root selection and the Kubb reference

Kubb does not generate from every nested OpenAPI Schema Object and it does not treat `components.schemas` as the only useful source. Its current architecture separates three levels:

- Public generation roots are the top-level `schemas` and `operations` arrays in its intermediate `InputNode`.
- Operation-local contracts, including parameters, request bodies, and responses, remain children of an operation and are handled by operation generators.
- Referenced schemas remain dependencies. Kubb computes the transitive dependency closure instead of promoting every nested schema to a standalone artifact.

For OpenAPI, Kubb builds top-level schema roots from `components.schemas` and selected inline schemas under reusable `components.requestBodies` and `components.responses`. Operation-local request and response schemas remain attached to their operations. See [Kubb's OAS component root selection](https://github.com/kubb-labs/kubb/blob/78226e2c9ed6055ef4cce4ff6ed4488568bd619e/packages/adapter-oas/src/model/components.ts#L151-L220), [its universal AST shape](https://kubb.dev/docs/5.x/guide/concepts/ast), and [schema dependency selection](https://github.com/kubb-labs/kubb/blob/78226e2c9ed6055ef4cce4ff6ed4488568bd619e/packages/ast/src/utils/schemaGraph.ts#L81-L130).

The reusable principle is semantic ownership, not a hard-coded source pointer:

1. An explicitly named reusable contract is a public root.
2. A contract at an application interaction boundary is an operation-local root.
3. A nested schema is emitted through its owner unless it has its own stable public identity.
4. Referenced contracts are included through dependency closure and are not regenerated at each use site.
5. Metadata remains available to specialized generators but is not automatically converted into a data schema.

The AsyncAPI equivalent should preserve more first-class entities than Kubb's HTTP-shaped operation model:

| AsyncAPI source                                                                 | Generation role             | Data artifacts                                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `components.schemas.*`                                                          | Named reusable schema root  | JSON Schema, TypeScript type, Zod schema, or another schema projection                                               |
| `components.messages.*`                                                         | Named reusable message root | Separate payload and application-header contracts, plus an optional target-specific message wrapper                  |
| `channels.*.messages.*`                                                         | Runtime message root        | Payload and application-header contracts, with a stable name scoped by the channel when no component identity exists |
| `operations.*.messages`                                                         | Operation selection         | References or unions of the selected channel messages; when omitted, the operation includes all channel messages     |
| `operations.*.reply.messages`                                                   | Reply selection             | References or unions of reply messages                                                                               |
| `channels.*.parameters`                                                         | Operation or channel input  | A derived channel-parameter contract for generators that model channel invocation                                    |
| Nested payload/header schemas                                                   | Dependency                  | Embedded or referenced from the owning root, not emitted independently                                               |
| Servers, bindings, security, correlation IDs, examples, tags, and documentation | Generator metadata          | No generic data-schema root                                                                                          |

AsyncAPI 3.1 makes the distinction explicit: a Message Object owns `payload` and application `headers`, a Channel Object owns messages and address parameters, and an Operation Object selects a channel and a subset of its messages. Operation replies select response messages separately. See the [Message Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#messageObject), [Channel Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#channelObject), and [Operation Object](https://www.asyncapi.com/docs/reference/specification/v3.1.0#operationObject).

A reusable Opalesce generation model should therefore distinguish at least schemas, messages, channels, and operations. Output plugins may project only the parts they understand, but they should share identities, source pointers, reference relationships, schema formats, and effective trait-merged semantics. A JSON Schema emitter also needs the raw ref-preserving source because a normalized code-generation AST can lose JSON Schema keywords or reference details.

The `components.schemas`-only boundary remains valid for the first JSON Schema bundle as a deliberately narrow plugin policy. It must not become a Core-wide definition of which AsyncAPI contracts are generatable. If TypeScript, Zod, or client generators are part of the near-term roadmap, a separate generation-model change should define the shared root registry before those plugins independently invent incompatible discovery and naming rules.

## Proposed issue boundary

Suggested title: `Export AsyncAPI component schemas as a Draft 07 JSON Schema bundle`

Success criteria:

- Core exposes an immutable, unresolved parsed AsyncAPI value and source URI to plugins without leaking Spectral types.
- A reusable plugin emits deterministic UTF-8 JSON with a trailing newline.
- AsyncAPI 2.6 and 3.1 named component schemas produce the same documented Draft 07 bundle shape.
- Native and explicit Draft 07 schemas are supported, including `true` and `false`.
- Internal, repeated, self-recursive, and mutually recursive references remain valid after bundling.
- Absolute authored `$id`, `$schema`, descriptions, examples, and non-parser extensions survive.
- `x-parser-*` fields never appear in output.
- Unknown or out-of-scope `schemaFormat` values fail with the format and source pointer in the error.
- The generated bundle passes Ajv meta-schema validation and compilation, and positive and negative sample instances demonstrate preserved validation behavior.
- Repeated runs are byte-identical, and invalid or colliding artifact names fail before persistence.

Required fixtures should cover AsyncAPI 2.6 and 3.1, plain and wrapped schemas, boolean schemas, unused components, internal and explicitly allowed external refs, missing refs, recursion, absolute, relative, and duplicate `$id`, conflicting dialect declarations, unsupported formats, malicious names, case-only collisions, and deterministic ordering. Inline message payloads should have an explicit test showing they are excluded from this first scope.

## Main risks and follow-ups

- Exposing only the resolved model forces unreliable reconstruction of lost references. Treat the unresolved document boundary as a prerequisite.
- External resolution must reuse or deliberately replace the parser's resolver policy. A second resolver with different credentials, schemes, or base URI can validate one graph and emit another.
- Foreign-format conversion is lossy and format-specific. Add each converter only with semantic fixtures and documented limitations.
- Per-schema files require stable cross-file URI and naming rules. Implement them after the single-bundle format proves reference correctness.
- Inline payload and header export needs an identity and collision policy across AsyncAPI 2.x and 3.x. Do not use parser-generated anonymous IDs as a public file contract.
