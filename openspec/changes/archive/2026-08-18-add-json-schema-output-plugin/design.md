## Context

`@asyncapi/parser` exposes a resolved model that is useful for semantic discovery but unsafe for faithful schema serialization: it loses the authored `$ref` graph, adds parser metadata, and restores recursion as shared JavaScript identities. Core therefore preserves an immutable copy of `extras.document.data` and its source URI as an optional Opalesce-owned plugin input.

The first JSON Schema implementation exported named component schemas inside one Draft 07 `definitions` bundle. Pre-publication review found two mismatches. Consumers expect Kubb-like independently usable artifacts, and Draft 07 requires `$schema` at a root schema rather than in a subschema. The package is unpublished, so this change replaces the bundle contract instead of preserving it.

The corrected delivery exports one standalone resource per named `components.schemas` entry and one small index schema. This remains narrower than a shared AsyncAPI generation model: message roots, operations, and cross-target naming belong to a later change.

## Goals / Non-Goals

**Goals:**

- Preserve unresolved validated source data and source identity in a parser-independent Core contract.
- Export every named component schema from AsyncAPI 2.6, 3.0, and 3.1 as a standalone Draft 07 artifact.
- Provide a deterministic index that maps exact component keys to generated files.
- Define portable filenames and reject ambiguous names instead of silently renaming public contracts.
- Preserve supported semantics, authored metadata, local reference sharing, and recursion across files.
- Fail before returning any artifacts when formats, dialects, names, identifiers, references, or schemas are unsafe.
- Validate the complete in-memory resource set with Ajv without filesystem or network reads.
- Keep package-owned conformance and CLI integration fixtures aligned with consumer usage.

**Non-Goals:**

- Support both directory and single-file modes before a consumer requires the bundle.
- Export message payloads, headers, channel parameters, operations, replies, or anonymous nested schemas as public roots.
- Define a shared schemas/messages/channels/operations model for TypeScript, Zod, SDK, or documentation plugins.
- Add configurable casing or filename resolvers.
- Convert foreign formats or resolve external resources.
- Migrate to newer JSON Schema dialects.
- Change Core artifact persistence, CLI cleanup, plugin ordering, or package release behavior.

## Decisions

### Core exposes an optional Opalesce-owned source snapshot

`ParsedAsyncAPI`, `PluginContext`, and `PipelineResult` expose `source?: AsyncAPISource`, containing recursively frozen readonly JSON data plus an optional URI. Raw inputs receive a copied snapshot from parser extras. Existing parsed-document inputs keep `source` absent because reconstructing authored input from the resolved model would be incorrect. The CLI supplies the input file URL unless configuration provides an explicit parser source.

### The package owns JSON Schema interpretation

`packages/plugin-json-schema` depends on Core contracts, Ajv, and `ajv-formats`. Core remains unaware of schema extraction, filenames, or target-specific validation. The package keeps generation errors internal and exports only the default factory.

`outputPath` names an artifact directory and defaults to `schemas`. The plugin joins it with generated filenames and returns artifacts; Core still validates final canonical paths and cross-plugin collisions. Supporting an explicit bundle mode now would retain two reference models before there is evidence both are needed.

### Every named component becomes a standalone resource

For a component key `User`, the plugin emits `schemas/User.schema.json`. Object schemas gain the Draft 07 `$schema` declaration when absent and preserve a matching authored root declaration. Boolean schemas remain exact `true` or `false`, because a boolean root cannot carry metadata.

Nested schemas remain inside their owning component. Inline message payloads and other schema-bearing AsyncAPI locations remain excluded. An empty component set still emits the index so plugin execution has a stable observable result.

### Exact component keys become filenames only when portable

The filename stem is the exact component key. Silent casing or sanitization was rejected because it can create unstable public paths and concealed collisions. A key fails when it contains path separators, control characters, Windows-invalid characters, trailing dots or spaces, or a reserved device basename. `index` is reserved for the catalog.

The plugin normalizes prospective filenames to NFC and lowercase for collision detection. This intentionally targets case-insensitive filesystems and common Unicode aliases before Core sees the final artifact paths. A future shared naming resolver can broaden accepted inputs only when another generator proves the required policy.

### The index is a JSON Schema barrel

`index.schema.json` declares Draft 07 and contains only `definitions` entries that `$ref` the sibling component files. Exact component keys remain lookup keys. The index neither duplicates component contents nor creates a validation union at its root.

This gives consumers one catalog entry point, gives boolean roots an enclosing declared dialect when reached through the index, and lets conformance tests validate each named contract through the same interface.

### Component references become relative generated-file references

The plugin structurally copies schemas and rewrites `#/components/schemas/<token>` to `./<filename>`. A remaining JSON Pointer suffix is appended as the generated reference fragment. The transformation never dereferences schemas, so repeated, self-recursive, and mutually recursive graphs remain references.

Filenames are URI-encoded in `$ref` values while artifact paths retain their exact safe names. Missing component targets and pointers outside the exported root set fail. File, HTTP, and other external resources are never loaded. Absolute URI references may resolve only to authored `$id` resources already registered in the generated set.

A document-local component reference inside an authored `$id` scope still fails. Rewriting it to a relative file URI would resolve against the authored identifier rather than the generated retrieval URI and could silently change its target.

### Draft 07 declarations are root-only

Each object component artifact is a root schema and may carry `$schema`. A matching authored Draft 07 declaration is preserved; an absent declaration is added. A conflicting root declaration or any nested `$schema` fails with `DIALECT_CONFLICT`. This follows Draft 07 instead of relying on Ajv accepting a keyword position prohibited by the specification.

### Authored identifiers are preserved, never inferred

Absolute authored `$id` values are preserved. Relative identifiers resolve only beneath an authored absolute ancestor; a relative root identifier still fails because changing its base from the AsyncAPI source to a generated file would alter semantics. Duplicate resolved identifiers fail with both source pointers. Component keys and output paths never become `$id` values.

### Ajv validates the in-memory artifact set

The plugin assigns every generated artifact a synthetic hierarchical retrieval URI under an internal HTTPS origin and registers the documents with one strict Draft 07 Ajv instance. Relative generated references therefore resolve exactly as they would from sibling files without enabling `loadSchema`, file reads, or network access.

Validation performs three checks before return:

1. Validate each generated document against the Draft 07 meta-schema.
2. Compile every component retrieval URI.
3. Compile every index definition reference.

Supported AsyncAPI annotations, formats, and observed custom `x-*` keys are registered explicitly. Any failure rejects the entire generation; no partial artifact set is returned.

### Serialization and artifact order are public behavior

The serializer recursively sorts object keys, preserves arrays, uses two-space indentation, and appends exactly one newline. The index artifact is first, followed by component artifacts in lexicographic path order. Repeated runs must match by path, order, and bytes.

### The conformance corpus remains case-local and pipeline-first

Every successful case stores the complete expected directory tree and runs raw input through the public Core pipeline twice. Instance metadata continues to name exact component keys; tests register the generated resource set and validate instances through index definitions. Failure cases exercise internal error code and source pointer behavior, including filename safety.

The package-owned config fixture persists the full artifact set through the CLI and compares every file. No repository-global smoke fixture or generated output is retained.

## Risks / Trade-offs

- [Relative references depend on retrieval URIs] -> Validate with synthetic sibling HTTPS URIs and document that consumers must load the generated set from one directory or register every resource.
- [Portable filename rules reject valid AsyncAPI keys] -> Fail explicitly rather than silently rename; add a shared resolver only with a concrete second generator requirement.
- [Authored `$id` changes relative-reference scope] -> Preserve identifiers and reject unsafe component-pointer rewrites inside authored identifier scopes.
- [Boolean schemas cannot declare `$schema`] -> Preserve the exact boolean root and expose its dialect through the package contract and index.
- [An index adds one extra artifact] -> Keep it content-light and deterministic; it replaces ad hoc consumer discovery and acts as the validation catalog.
- [The parser removes or changes source extras] -> Isolate access in Core and retain pin-sensitive tests.
- [Strict Ajv rejects valid AsyncAPI annotations] -> Maintain explicit keyword and format registrations rather than disabling strict mode.

## Migration Plan

1. Retain the completed Core source snapshot and CLI source identity work.
2. Replace the bundle specification with the per-component artifact, filename, index, and relative-reference contract.
3. Update focused tests to describe the new output before changing implementation.
4. Replace bundle assembly with component resource assembly and deterministic filename planning.
5. Register and validate the complete in-memory resource set with Ajv.
6. Replace every successful expected bundle with an index and component files, then update instance validation and CLI integration.
7. Update package documentation and run focused plus full validation.

Rollback reverts the unpublished plugin to its previous one-bundle implementation. Core source propagation is independently useful and remains additive. No persisted data or published compatibility adapter is required.

## Open Questions

None. Bundle mode, external resolution, message roots, and cross-generator naming require separate specifications.
