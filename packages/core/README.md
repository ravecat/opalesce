# @opalesce/core

`@opalesce/core` is the in-memory AsyncAPI generation engine for Opalesce. It parses input once, runs each configured plugin in declared order, and collects generated text artifacts without writing files.

The package is released as a focused building block for advanced integrations. Normal consumers use the `opalesce` facade, while `@opalesce/config` and `@opalesce/cli` remain the focused config, filesystem, and command layers.

## Project Workflow

Most projects describe generation without calling the pipeline directly:

```ts
// opalesce.config.ts
import { defineConfig, definePlugin } from "opalesce";

const versionFile = definePlugin(() => ({
  name: "version-file",
  generate(context) {
    return [
      {
        path: "metadata/version.txt",
        contents: `AsyncAPI ${context.document.version()}\n`,
      },
    ];
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
  },
  plugins: [versionFile()],
});
```

```sh
opalesce generate
```

The CLI discovers the config, reads the input, calls `run` once, and writes successful artifacts. The config remains side-effect free.

## Programmatic Usage

Call `run` explicitly when another program already owns input loading and artifact persistence:

```ts
import { defineConfig, definePlugin, run, type Input } from "@opalesce/core";

const input = {
  asyncapi: "3.1.0",
  info: {
    title: "Events",
    version: "1.0.0",
  },
} satisfies Input;

const versionFile = definePlugin((options: { readonly path: string }) => ({
  name: "version-file",
  generate(context) {
    return [
      {
        path: options.path,
        contents: `AsyncAPI ${context.document.version()}\n`,
      },
    ];
  },
}));

const config = defineConfig({
  input,
  plugins: [versionFile({ path: "metadata/version.txt" })],
});

const result = await run(config);

console.log(result.artifacts);
```

The result contains the official parsed AsyncAPI document, parser diagnostics, artifacts in return order, and the configured plugin order:

```ts
interface PipelineResult {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
  readonly source?: AsyncAPISource;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly pluginNames: readonly string[];
}
```

## Internal Workspace Usage

Internal packages can depend on Core directly:

```json
{
  "dependencies": {
    "@opalesce/core": "workspace:*"
  }
}
```

Then refresh workspace links:

```sh
pnpm install
```

The scoped package is not a normal consumer dependency; prefer the `opalesce` facade unless direct access to the engine is required.

## Pipeline Lifecycle

`run` executes one deterministic pipeline:

1. Snapshot `config.plugins` in declared order.
2. Parse `config.input` once.
3. Run and await each plugin `generate` in declared order.
4. Return a frozen result with all in-memory artifacts.

Core parse failures pass through unchanged. A generation failure stops the pipeline immediately, so later plugins do not run.

## Pipeline Configuration

```ts
interface PipelineConfig {
  readonly input: Input;
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}
```

| Field     | Required | Purpose                                                                                                      |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `input`   | Yes      | YAML or JSON text, a JavaScript AsyncAPI object, or an existing official AsyncAPI document accepted by Core. |
| `parser`  | No       | Core parser-constructor and parse options forwarded unchanged to `parseAsyncAPI`.                            |
| `plugins` | No       | Plugins to execute sequentially in declared order. Defaults to an empty pipeline.                            |

`defineConfig` is an identity helper. It preserves the concrete config type and improves TypeScript inference:

```ts
const config = defineConfig({
  input,
  parser: {
    parse: {
      source: "memory://events/asyncapi.yaml",
    },
  },
  plugins: [],
});
```

An input string is treated as AsyncAPI document content, not as a filesystem path.

## Defining Plugins

`definePlugin` preserves the arguments and concrete return type of a plugin factory:

```ts
import { definePlugin } from "opalesce";

interface ManifestPluginOptions {
  readonly path: string;
}

export const manifestPlugin = definePlugin((options: ManifestPluginOptions) => ({
  name: "manifest",
  generate(context) {
    return [
      {
        path: options.path,
        contents: JSON.stringify(
          {
            asyncapi: context.document.version(),
          },
          null,
          2,
        ),
      },
    ];
  },
}));
```

A plugin has one required execution hook:

```ts
interface OrchestrationPlugin {
  readonly name: string;
  generate(
    context: PluginContext,
  ): readonly GeneratedArtifact[] | Promise<readonly GeneratedArtifact[]>;
}
```

- `generate` receives the parsed document, parser diagnostics, and optional unresolved source snapshot and returns text artifacts.
- Plugin generations run sequentially in the exact order declared in `plugins`.
- Core awaits asynchronous generation before starting the next plugin.
- Each plugin derives and owns any generator-specific model it needs.
- Plugins do not receive services or artifacts from other plugins.

For raw text and object inputs, `context.source.data` is an Opalesce-owned recursively frozen snapshot captured before parser reference resolution. It preserves authored `$ref` strings and boolean schemas instead of exposing the resolved, potentially cyclic parser model. `context.source.uri` contains `parse.source` when supplied. The same source identity is shared by every plugin and the pipeline result.

When `input` is an existing `AsyncAPIDocumentInterface`, `source` is `undefined`. Core does not reconstruct purported authored input from `document.json()` because that model has already been resolved.

The name identifies a plugin in results and execution errors. Repeated entries and repeated names are executed rather than deduplicated.

## Linear Plugin Order

The config array is the complete execution plan:

```ts
const config = defineConfig({
  input,
  plugins: [typescriptPlugin(), documentationPlugin(), metadataPlugin()],
});
```

Core does not reorder plugins. If the same plugin instance appears twice, its `generate` runs twice at those positions. Generation contexts cannot observe earlier artifacts, so config order controls execution without creating a plugin dependency API.

## Returning Artifacts

`generate` returns artifact descriptions:

```ts
return [
  {
    path: "types/UserCreated.ts",
    contents: "export interface UserCreated {}\n",
  },
];
```

Artifact paths must:

- Be non-empty and relative.
- Use forward slashes.
- Contain no empty, `.` or `..` segments.
- Not be POSIX or Windows absolute paths.
- Be unique across the complete pipeline.

Artifacts are stored as defensive frozen copies and become visible in `PipelineResult` after the complete run succeeds. A plugin cannot inspect artifacts returned by another plugin. Outputs that must be coordinated, such as modules and their barrel file, belong to one plugin.

Core returns artifacts but does not write them. A facade or storage layer owns output-directory resolution, atomic writes, cleanup, and rollback.

## Error Handling

```ts
import { AsyncAPIParseError, PluginExecutionError, run } from "@opalesce/core";

try {
  await run(config);
} catch (error) {
  if (error instanceof AsyncAPIParseError) {
    console.error(error.diagnostics);
  } else if (error instanceof PluginExecutionError) {
    console.error(error.pluginName, error.cause);
  } else {
    throw error;
  }
}
```

| Error                  | When it is raised                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `AsyncAPIParseError`   | Core cannot produce a valid AsyncAPI document. This error passes through unchanged.           |
| `PluginExecutionError` | Plugin generation fails. It contains `pluginName` and the original `cause`.                   |
| `ArtifactError`        | A plugin returns an invalid or colliding artifact path. It is a `PluginExecutionError.cause`. |

The pipeline is fail-fast and returns no partial result after an error.

## Public API

Runtime exports:

- `parseAsyncAPI`
- `AsyncAPIParseError`
- `defineConfig`
- `definePlugin`
- `run`
- `PluginExecutionError`
- `ArtifactError`

The root entry point also exports parser, pipeline, plugin, context, artifact, and error-code types, including:

- `Input`
- `ParseAsyncAPIOptions`
- `AsyncAPIDocumentInterface`
- `Diagnostic`
- `AsyncAPISource`
- `JsonValue`
- `OrchestrationPlugin`
- `PluginContext`
- `PipelineConfig`
- `PipelineResult`
- `GeneratedArtifact`

## Current Boundaries

`@opalesce/core` intentionally does not:

- Discover or execute `opalesce.config.*`.
- Provide an `opalesce` bin or CLI arguments.
- Read an AsyncAPI source file.
- Write or clean output directories.
- Generate schemas, TypeScript, Zod, JSON Schema, or barrel files by itself.
- Support binary artifacts.

Those behaviors belong to config-loader, CLI, storage, schema, and output-plugin packages built on top of this API.

## Prerequisites

Workspace development uses Node.js 24 as declared by the repository Nix environment. The package does not yet declare a public runtime support range.

Recommended:

```sh
nix develop
pnpm install
```

The workspace pins pnpm through the root `packageManager` field. For manual setup, install Node.js 24, enable the pinned pnpm version, and run `pnpm install` from the repository root.

## Stack

| Area                                      | Version source files                 |
| ----------------------------------------- | ------------------------------------ |
| Runtime dependencies and package metadata | [`package.json`](./package.json)     |
| Development environment                   | [`../../flake.nix`](../../flake.nix) |
| Workspace command aliases                 | [`../../justfile`](../../justfile)   |

## Development Commands

Run commands from the repository root:

| Command                                  | Purpose                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `just nx build @opalesce/core`           | Build ESM JavaScript and TypeScript declarations.           |
| `pnpm --dir packages/core run typecheck` | Type-check package source and tests without emitting files. |
| `pnpm --dir packages/core run test`      | Run focused parser and orchestration runtime tests.         |
| `just nx run @opalesce/core:check`       | Run package type-checking and tests.                        |
| `just nx run-many -t build`              | Build every Nx package project.                             |
| `just nx run-many -t check --parallel=1` | Run package checks across the Nx workspace.                 |

The package tests cover parser option forwarding, declared plugin order, sequential asynchronous generation, artifact validation, immutable results, package exports, and error propagation.

## License

Licensed under the [MIT License](./LICENSE).
