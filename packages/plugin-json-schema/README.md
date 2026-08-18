# @opalesce/plugin-json-schema

`@opalesce/plugin-json-schema` exports each named AsyncAPI component schema as an independently usable JSON Schema Draft 07 file. It also emits an index for consumers that need to discover or validate components by their AsyncAPI names.

## Installation

```sh
pnpm add -D @opalesce/plugin-json-schema
```

Workspace packages can use `workspace:*` while developing Opalesce locally.

## Configuration

```ts
import jsonSchema from "@opalesce/plugin-json-schema";
import { defineConfig } from "opalesce";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
  },
  plugins: [
    jsonSchema({
      outputPath: "contracts/schemas",
    }),
  ],
});
```

The output option is optional:

| Option       | Default   | Purpose                                                     |
| ------------ | --------- | ----------------------------------------------------------- |
| `outputPath` | `schemas` | Relative artifact directory passed to Core path validation. |

The plugin name reported by Core is `json-schema`.

## Output

For components named `Article` and `User`, the plugin returns this artifact tree:

```text
schemas/
├── index.schema.json
├── Article.schema.json
└── User.schema.json
```

Each component file is a standalone schema root. Object roots receive Draft 07 `$schema` when it was not authored already. Boolean roots remain exactly `true` or `false`.

The index maps exact AsyncAPI component names to sibling resources:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Article": { "$ref": "./Article.schema.json" },
    "User": { "$ref": "./User.schema.json" }
  }
}
```

When the source has no component schemas, the plugin still returns `index.schema.json` with an empty `definitions` object.

Only `components.schemas.*` entries become artifacts. Used and unused components are included. Message payloads, headers, channel parameters, operations, replies, and anonymous nested schemas are not separate roots in this version.

Artifact order is deterministic: the index comes first, followed by component files in lexicographic component-name order. JSON object keys are sorted lexicographically, arrays retain authored order, indentation is two spaces, and every file has exactly one trailing newline.

## Component filenames

A component key becomes `<component>.schema.json` without silent renaming. Generation fails if that exact mapping is not portable or unambiguous:

- Empty names, path separators, control characters, and characters invalid on common filesystems are rejected.
- Names ending in a dot or space and Windows device names such as `CON` or `NUL` are rejected.
- `index` is reserved for the generated index.
- Case-insensitive or Unicode-normalized filename collisions are rejected.

This keeps the AsyncAPI name, index key, artifact name, and diagnostics aligned.

## Supported input

- AsyncAPI 2.6, 3.0, and 3.1 documents.
- AsyncAPI-native Schema Objects.
- Multi Format Schema Objects whose `schemaFormat` is `application/schema+json;version=draft-07`.
- Object and boolean schemas, including a wrapper whose `schema` is `false`.
- Draft 07 validation keywords, standard `ajv-formats`, supported AsyncAPI annotations and formats, and custom `x-*` extensions.

Absolute authored `$id`, root Draft 07 `$schema`, descriptions, examples, annotations, and non-parser extensions are preserved. Relative `$id` values require an absolute authored ancestor. Only `x-parser-*` fields are removed. Component names are never synthesized into `$id` values.

Draft 07 permits `$schema` only at a schema resource root. A conflicting root declaration or any nested `$schema` therefore fails generation.

Avro, OpenAPI, Protobuf, RAML, custom schema formats, and newer JSON Schema dialects are not converted implicitly.

## Reference policy

References remain references, so repeated, self-recursive, and mutually recursive graphs stay serializable.

- `#/components/schemas/User` becomes `./User.schema.json`.
- Pointer suffixes are retained, so `#/components/schemas/User/properties/id` becomes `./User.schema.json#/properties/id`.
- A component reference under an authored `$id` is rejected because a relative file rewrite would change its resolution scope.
- URI references to authored `$id` resources in the generated component set are allowed.
- Missing components, references outside `components.schemas`, and unresolved file, HTTP, or other URI references fail generation.
- The plugin performs no network or filesystem reads while resolving schema references.

## Validation

Before returning artifacts, the plugin validates every resource against the Draft 07 meta-schema, registers the complete in-memory resource set under synthetic sibling retrieval URIs, and compiles every component both directly and through the index. Invalid keyword values, unknown strict keywords, or references that do not close over the generated set prevent artifact return.

## Errors

Generation fails before returning artifacts when the source, format, dialect, component names, references, identifiers, or completed Draft 07 resource set are invalid. Error messages identify the failure and its source JSON Pointer where available. Core wraps the original failure in `PluginExecutionError` and attributes it to the `json-schema` plugin.

## Source requirement

The plugin reads `PluginContext.source`, the immutable unresolved source captured by Core before parser reference resolution. The CLI supplies the absolute input file URL as its source URI unless `parser.parse.source` is explicitly configured.

Calling Core with an existing `AsyncAPIDocumentInterface` does not provide this snapshot because reconstructing it from the resolved model would lose authored reference semantics. In that case generation fails before returning artifacts.
