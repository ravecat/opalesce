# opalesce

`opalesce` is the consumer-facing package for the Opalesce generation pipeline. It provides project configuration, plugin definition, shared interaction contract types, Core orchestration glue, and the `opalesce` executable. Output plugins are separate `@opalesce/plugin-*` packages with independent releases.

The package is published to the public npm registry as the recommended entry point for consumers.

## Quick Start

Install the facade and each plugin required by the project:

```sh
pnpm add -D opalesce @opalesce/plugin-typescript
```

Inside this workspace, use `workspace:*`:

```json
{
  "devDependencies": {
    "@opalesce/plugin-typescript": "workspace:*",
    "opalesce": "workspace:*"
  },
  "scripts": {
    "generate": "opalesce generate"
  }
}
```

Create `opalesce.config.ts`:

```ts
import { defineConfig } from "opalesce";
import typescript from "@opalesce/plugin-typescript";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
    clean: true,
  },
  plugins: [typescript()],
});
```

Run generation:

```sh
opalesce generate
```

Projects do not need direct dependencies on `@opalesce/cli`, `@opalesce/config`, or `@opalesce/core`. They add only the independently published output-plugin packages they use.

## Public Entry Points

### `opalesce`

Use the root for project config files and plugin definition:

```ts
import { defineConfig, definePlugin } from "opalesce";
```

- `defineConfig` authors a path-based `opalesce.config.*` file.
- `definePlugin` authors an orchestration plugin.

Plugin authors receive the complete parser document and one shared interaction contract:

```ts
const report = definePlugin(() => ({
  name: "interaction-report",
  generate({ document, interaction }) {
    return [
      {
        path: "interaction.txt",
        contents: `${document.version()}:${interaction.operations.length}\n`,
      },
    ];
  },
}));
```

The consumer facade does not expose the internal pipeline runner, parser, errors, or their types.

### `@opalesce/plugin-typescript`

Use the independently published TypeScript plugin with the `opalesce` configuration API:

```ts
import { defineConfig } from "opalesce";
import typescript from "@opalesce/plugin-typescript";
```

The plugin generates deterministic ESM type contracts under `types/` by default. It is not a runtime or transitive dependency of `opalesce`.

### `opalesce/config`

Use the config-only entry when a config file needs only the config helper:

```ts
import { defineConfig } from "opalesce/config";
```

## Architecture

```text
opalesce
  -> @opalesce/cli
  -> @opalesce/config
  -> @opalesce/core

@opalesce/plugin-typescript
  -> @opalesce/core
```

Core owns parsing, the target-neutral interaction contract, and the filesystem-free plugin engine. The TypeScript plugin owns language projection and source rendering. CLI owns config loading and persistence. The facade provides only the public Core and orchestration boundary and does not bundle output plugins.
