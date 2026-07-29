# @opalesce/core

`@opalesce/core` is the in-memory AsyncAPI generation engine for Opalesce. It parses input once, resolves plugin dependencies, runs plugin lifecycle hooks, shares typed services, and collects generated text artifacts without writing files.

The package is released as a focused building block for advanced integrations. Normal consumers use the `opalesce` facade, while `@opalesce/config` and `@opalesce/cli` remain the focused config, filesystem, and command layers.

## Project Workflow

Most projects describe generation without calling the pipeline directly:

```ts
// opalesce.config.ts
import { defineConfig, definePlugin } from "opalesce";

const versionFile = definePlugin(() => ({
  name: "version-file",
  build(context) {
    context.emit({
      path: "metadata/version.txt",
      contents: `AsyncAPI ${context.document.version()}\n`,
    });
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
import { definePipelineConfig, definePlugin, run, type Input } from "opalesce";

const input = {
  asyncapi: "3.1.0",
  info: {
    title: "Events",
    version: "1.0.0",
  },
} satisfies Input;

const versionFile = definePlugin((options: { readonly path: string }) => ({
  name: "version-file",
  build(context) {
    context.emit({
      path: options.path,
      contents: `AsyncAPI ${context.document.version()}\n`,
    });
  },
}));

const config = definePipelineConfig({
  input,
  plugins: [versionFile({ path: "metadata/version.txt" })],
});

const result = await run(config);

console.log(result.artifacts);
```

The result contains the official parsed AsyncAPI document, parser diagnostics, artifacts in emission order, and the resolved plugin order:

```ts
interface PipelineResult {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
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

1. Validate plugin names and dependency relationships.
2. Resolve a stable topological plugin order.
3. Parse `config.input` once.
4. Run every plugin `setup` hook in resolved order.
5. Run every plugin `build` hook in the same order.
6. Return a frozen result with all in-memory artifacts.

Plugin configuration failures happen before parsing. Core parse failures pass through unchanged. A setup or build failure stops the pipeline immediately.

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
| `plugins` | No       | Plugins to validate, order, and execute. Defaults to an empty pipeline.                                      |

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
  build(context) {
    context.emit({
      path: options.path,
      contents: JSON.stringify(
        {
          asyncapi: context.document.version(),
        },
        null,
        2,
      ),
    });
  },
}));
```

A plugin can implement either or both lifecycle hooks:

```ts
interface OrchestrationPlugin {
  readonly name: string;
  readonly dependsOn?: readonly string[];
  setup?(context: PluginSetupContext): void | Promise<void>;
  build?(context: PluginBuildContext): void | Promise<void>;
}
```

- `setup` registers or consumes shared in-memory services.
- `build` consumes services, inspects previously emitted artifacts, and emits new artifacts.
- All setup hooks finish before the first build hook starts.
- Hooks run sequentially. A hook can be synchronous or asynchronous.

Plugin names must be non-empty and unique in one pipeline.

## Plugin Dependencies

Use `dependsOn` when a plugin requires another configured plugin:

```ts
const provider = definePlugin(() => ({
  name: "provider",
  setup() {},
}));

const consumer = definePlugin(() => ({
  name: "consumer",
  dependsOn: ["provider"],
  build() {},
}));

const config = defineConfig({
  input,
  plugins: [consumer(), provider()],
});
```

The resolved order is `provider`, then `consumer`, even though the consumer appears first in the config. Config order breaks ties between plugins that are currently eligible to run.

The runner rejects:

- Empty plugin names.
- Duplicate plugin names.
- Missing dependencies.
- Self dependencies.
- Dependency cycles.

These failures use `PluginConfigurationError` and occur before Core parses the input.

## Sharing Typed Services

Service tokens allow one plugin to provide a typed in-memory capability to another plugin without adding untyped fields to a global context.

```ts
import { createServiceToken, definePipelineConfig, definePlugin, run } from "opalesce";

interface DocumentInfo {
  readonly asyncapiVersion: string;
}

const documentInfoService = createServiceToken<DocumentInfo>("document-info");

const documentInfoProvider = definePlugin(() => ({
  name: "document-info-provider",
  setup(context) {
    context.provide(documentInfoService, {
      asyncapiVersion: context.document.version(),
    });
  },
}));

const documentInfoFile = definePlugin(() => ({
  name: "document-info-file",
  dependsOn: ["document-info-provider"],
  build(context) {
    const documentInfo = context.get(documentInfoService);

    context.emit({
      path: "metadata/document.txt",
      contents: `${documentInfo.asyncapiVersion}\n`,
    });
  },
}));

const result = await run(
  definePipelineConfig({
    input,
    plugins: [documentInfoFile(), documentInfoProvider()],
  }),
);
```

The generic token type controls both `provide` and `get`. Token identity, not the diagnostic name, selects the value, so two tokens with the same name remain independent.

A token can be provided only once per pipeline. Retrieving an unavailable token or providing the same token twice raises `ServiceRegistryError` inside the active plugin hook.

A future `@opalesce/schema` package can use this boundary to export a shared `ServiceToken<SchemaGraph>`.

## Emitting Artifacts

Only build contexts expose `emit`:

```ts
context.emit({
  path: "types/UserCreated.ts",
  contents: "export interface UserCreated {}\n",
});
```

Artifact paths must:

- Be non-empty and relative.
- Use forward slashes.
- Contain no empty, `.` or `..` segments.
- Not be POSIX or Windows absolute paths.
- Be unique across the complete pipeline.

Artifacts are stored as defensive frozen copies. `context.artifacts` is a frozen snapshot of artifacts emitted so far, allowing a later plugin such as a barrel generator to inspect earlier output:

```ts
const barrelPlugin = definePlugin(() => ({
  name: "barrel",
  build(context) {
    const modules = context.artifacts
      .filter((artifact) => artifact.path.endsWith(".ts"))
      .map((artifact) => `export * from "./${artifact.path}";`)
      .join("\n");

    context.emit({
      path: "index.ts",
      contents: `${modules}\n`,
    });
  },
}));
```

Core returns artifacts but does not write them. A facade or storage layer owns output-directory resolution, atomic writes, cleanup, and rollback.

## Error Handling

```ts
import { PluginConfigurationError, PluginExecutionError, run } from "opalesce";
import { AsyncAPIParseError } from "@opalesce/core";

try {
  await run(config);
} catch (error) {
  if (error instanceof PluginConfigurationError) {
    console.error(error.code, error.pluginNames);
  } else if (error instanceof AsyncAPIParseError) {
    console.error(error.diagnostics);
  } else if (error instanceof PluginExecutionError) {
    console.error(error.pluginName, error.phase, error.cause);
  } else {
    throw error;
  }
}
```

| Error                      | When it is raised                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PluginConfigurationError` | Plugin names or dependency relationships are invalid. This error is not wrapped.                               |
| `AsyncAPIParseError`       | Core cannot produce a valid AsyncAPI document. This error passes through unchanged.                            |
| `PluginExecutionError`     | A setup or build hook fails. It contains `pluginName`, `phase`, and the original `cause`.                      |
| `ServiceRegistryError`     | A hook retrieves a missing service or provides a token twice. It is available as `PluginExecutionError.cause`. |
| `ArtifactError`            | A hook emits an invalid or colliding artifact path. It is available as `PluginExecutionError.cause`.           |

The pipeline is fail-fast and returns no partial result after an error.

## Public API

Runtime exports:

- `parseAsyncAPI`
- `AsyncAPIParseError`
- `defineConfig`
- `definePlugin`
- `run`
- `createServiceToken`
- `PluginConfigurationError`
- `PluginExecutionError`
- `ServiceRegistryError`
- `ArtifactError`

The root entry point also exports the parser, pipeline, plugin, context, service, artifact, and error-code types:

- `Input`
- `ParseAsyncAPIOptions`
- `AsyncAPIDocumentInterface`
- `Diagnostic`

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

The package tests cover parser option forwarding, lifecycle ordering, dependency validation, typed services, artifact validation, immutable results, package exports, and error propagation.

## License

No license has been declared yet.
