# @opalesce/plugin-json-schema

`@opalesce/plugin-json-schema` exposes one default factory, which exports named AsyncAPI component schemas as one deterministic, self-contained JSON Schema Draft 07 bundle. Use it when validators, tests, or downstream generators need JSON Schema artifacts without dereferencing recursive contracts.

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
      outputPath: "schemas/events.json",
    }),
  ],
});
```

The output option is optional:

| Option       | Default        | Purpose                                                |
| ------------ | -------------- | ------------------------------------------------------ |
| `outputPath` | `schemas.json` | Relative artifact path passed to Core path validation. |

The plugin name reported by Core is `json-schema`.

## Output

The plugin always returns one artifact, including when the source has no component schemas:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Event": {
      "type": "object"
    }
  }
}
```

Only `components.schemas.*` entries become definitions. Exact component keys are preserved. Used and unused components are included, while nested schemas remain inside their owner.

Output object keys are sorted lexicographically, arrays retain authored order, indentation is two spaces, and the file has exactly one trailing newline. Repeated runs with the same source and options are byte-identical.

## Supported input

- AsyncAPI 2.6, 3.0, and 3.1 documents.
- AsyncAPI-native Schema Objects.
- Multi Format Schema Objects whose `schemaFormat` is `application/schema+json;version=draft-07`.
- Object and boolean schemas, including a wrapper whose `schema` is `false`.
- Draft 07 validation keywords, standard `ajv-formats`, supported AsyncAPI annotations and formats, and custom `x-*` extensions.

Absolute authored `$id`, Draft 07 `$schema`, descriptions, examples, annotations, and non-parser extensions are preserved. Relative `$id` values require an absolute authored ancestor. Only `x-parser-*` fields are removed. Component names are never synthesized into `$id` values, and the bundle has no configured root `$id`.

Avro, OpenAPI, Protobuf, RAML, custom schema formats, and newer JSON Schema dialects are not converted implicitly.

## Reference policy

References remain references. The plugin never dereferences schemas, so repeated, self-recursive, and mutually recursive graphs stay serializable.

- `#/components/schemas/...` is rewritten to the corresponding bundle definition.
- A component-local reference under an authored `$id` is rejected because rewriting it to a bundle fragment would change its resolution scope.
- URI references to authored `$id` resources already embedded in the bundle are allowed.
- Missing components, references outside `components.schemas`, and unresolved file, HTTP, or other URI references fail generation.
- The plugin performs no network or filesystem reads.

Message payloads, message headers, channel parameters, operations, replies, and anonymous schemas are not public roots in this version.

## Validation

Before returning the artifact, the plugin validates the complete bundle against the Draft 07 meta-schema and compiles every definition root with direct `ajv` and `ajv-formats` dependencies. Invalid keyword values, unknown strict keywords, or references that do not close over the bundle prevent artifact return.

## Errors

Generation fails before returning an artifact when the source, format, dialect, references, identifiers, or completed Draft 07 bundle are invalid. Error messages identify the failure and its source JSON Pointer where available. Core wraps the original failure in `PluginExecutionError` and attributes it to the `json-schema` plugin.

## Source requirement

The plugin reads `PluginContext.source`, the immutable unresolved source captured by Core before parser reference resolution. The CLI supplies the absolute input file URL as its source URI unless `parser.parse.source` is explicitly configured.

Calling Core with an existing `AsyncAPIDocumentInterface` does not provide this snapshot because reconstructing it from the resolved model would lose authored reference semantics. In that case generation fails before returning an artifact.
