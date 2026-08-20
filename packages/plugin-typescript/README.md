# @opalesce/plugin-typescript

Generate deterministic compile-time TypeScript contracts for the AsyncAPI entities an application exchanges with external systems. This plugin is published independently in the `@opalesce` npm scope.

```ts
import { defineConfig } from "opalesce";
import typescript from "@opalesce/plugin-typescript";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
  plugins: [typescript()],
});
```

The `opalesce` facade intentionally does not re-export output plugins. Install each required `@opalesce/plugin-*` package directly so its version and dependencies remain independent.

## Output

The default artifact tree is:

```text
types/
  schemas/<Schema>.ts
  messages/<Message>.ts
  channels/<Channel>Parameters.ts
  operations/<Operation>.ts
  index.ts
```

Use `typescript({ outputPath: "generated/contracts" })` to change the root directory.

The plugin emits:

- named component schemas;
- message payloads, application headers, and wrappers;
- channel address parameters;
- operation message selections and replies;
- symbolic type-only imports and one named barrel.

It reads the Core-owned `PluginContext.interaction` contract. It does not parse AsyncAPI, resolve references, read files, access the network, or inspect another plugin's artifacts.

## Type Semantics

Generated source describes JSON wire values and contains no runtime code. JSON Schema constraints that TypeScript cannot enforce remain approximations. In particular, generated types are not validators and do not enforce exact `oneOf`, patterns, numeric ranges, unique items, or exact closed objects.

Native AsyncAPI Schema Objects and explicit JSON Schema Draft 07 are supported for AsyncAPI 2.6, 3.0, and 3.1. Foreign schema formats fail with a source-attributed `TypeScriptGenerationError` after Core parsing succeeds.

Modelina is not a runtime dependency. Core's official AsyncAPI parser remains the only parse and resolution boundary, while the TypeScript compiler factory and printer render source.
