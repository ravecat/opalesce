# opalesce

`opalesce` is the consumer-facing package for the Opalesce generation pipeline. It provides the project config API, plugin authoring contracts, programmatic pipeline access, and the `opalesce` executable through one base dependency.

The package is published to the public npm registry as the recommended entry point for consumers.

## Quick Start

Future public installation will require the facade:

```sh
pnpm add -D opalesce
```

Add output plugin packages separately when they become available.

Inside this workspace, use `workspace:*`:

```json
{
  "devDependencies": {
    "opalesce": "workspace:*"
  },
  "scripts": {
    "generate": "opalesce generate"
  }
}
```

Create `opalesce.config.ts`:

```ts
import { defineConfig, definePlugin } from "opalesce";

const metadata = definePlugin(() => ({
  name: "metadata",
  build(context) {
    context.emit({
      path: "metadata/version.txt",
      contents: `${context.document.version()}\n`,
    });
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
    clean: true,
  },
  plugins: [metadata()],
});
```

Run generation:

```sh
opalesce generate
```

Projects install concrete output plugins separately. They do not need direct dependencies on `@opalesce/cli`, `@opalesce/config`, or `@opalesce/core`.

## Public Entry Points

### `opalesce`

Use the root for normal config files, plugin authoring, and programmatic pipelines:

```ts
import { defineConfig, definePipelineConfig, definePlugin, run } from "opalesce";
```

- `defineConfig` authors a path-based `opalesce.config.*` file.
- `definePlugin` authors an orchestration plugin.
- `definePipelineConfig` authors an in-memory pipeline config.
- `run` runs the in-memory pipeline directly.

The root also exports the public config, plugin, service, parser, artifact, result, context, and error types.

### `opalesce/config`

Use the config-only entry when a config file wants the smallest explicit surface:

```ts
import { defineConfig, type OpalesceConfig } from "opalesce/config";
```

## Architecture

```text
opalesce
  -> @opalesce/cli
  -> @opalesce/config
  -> @opalesce/core
```

Core owns parsing and the filesystem-free plugin engine. CLI owns config loading and persistence. The facade contains no config loading, pipeline, parsing, or persistence logic of its own.
