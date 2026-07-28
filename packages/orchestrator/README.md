# @opalesce/orchestrator

`@opalesce/orchestrator` runs an in-memory AsyncAPI plugin pipeline for Opalesce. It parses input once through `@opalesce/core`, resolves plugin dependencies, runs plugin lifecycle hooks, shares typed services, and collects generated text artifacts without writing files.

The package is currently private and intended for use by other packages in this workspace. `@opalesce/config` and `@opalesce/cli` provide the project-facing config, filesystem, and command layers above it.

## Project Workflow

Most projects describe generation without calling the pipeline directly:

```ts
// opalesce.config.ts
import { defineConfig } from "@opalesce/config";
import { definePlugin } from "@opalesce/orchestrator";

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

The CLI discovers the config, reads the input, calls `runPipeline` once, and writes successful artifacts. The config remains side-effect free.

## Programmatic Usage

Call `runPipeline` explicitly when another program already owns input loading and artifact persistence:

```ts
import { defineConfig, definePlugin, runPipeline, type Input } from "@opalesce/orchestrator";

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

const config = defineConfig({
  input,
  plugins: [versionFile({ path: "metadata/version.txt" })],
});

const result = await runPipeline(config);

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

## Workspace Usage

Add the package to another workspace package:

```json
{
  "dependencies": {
    "@opalesce/orchestrator": "workspace:*"
  }
}
```

Then refresh workspace links:

```sh
pnpm install
```

The package is not currently published and cannot be installed from the public npm registry.

## Pipeline Lifecycle

`runPipeline` executes one deterministic pipeline:

1. Validate plugin names and dependency relationships.
2. Resolve a stable topological plugin order.
3. Parse `config.input` once through `@opalesce/core`.
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
import { definePlugin } from "@opalesce/orchestrator";

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
import {
  createServiceToken,
  defineConfig,
  definePlugin,
  runPipeline,
} from "@opalesce/orchestrator";

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

const result = await runPipeline({
  input,
  plugins: [documentInfoFile(), documentInfoProvider()],
});
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

The orchestrator returns artifacts but does not write them. A facade or storage layer owns output-directory resolution, atomic writes, cleanup, and rollback.

## Error Handling

```ts
import {
  PluginConfigurationError,
  PluginExecutionError,
  runPipeline,
} from "@opalesce/orchestrator";
import { AsyncAPIParseError } from "@opalesce/core";

try {
  await runPipeline(config);
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

- `defineConfig`
- `definePlugin`
- `runPipeline`
- `createServiceToken`
- `PluginConfigurationError`
- `PluginExecutionError`
- `ServiceRegistryError`
- `ArtifactError`

The root entry point also exports the pipeline, plugin, context, service, artifact, and error-code types. It re-exports the Core types used by the public contract:

- `Input`
- `ParseAsyncAPIOptions`
- `AsyncAPIDocumentInterface`
- `Diagnostic`

## Current Boundaries

`@opalesce/orchestrator` intentionally does not:

- Discover or execute `opalesce.config.*`.
- Provide an `opalesce` bin or CLI arguments.
- Read an AsyncAPI source file.
- Write or clean output directories.
- Generate schemas, TypeScript, Zod, JSON Schema, or barrel files by itself.
- Support binary artifacts.

Those behaviors belong to config-loader, CLI, storage, schema, and output-plugin packages built on top of this API.

## Prerequisites

Workspace development uses Node.js 24 as declared by the repository Nix environment. The private package does not yet declare a public runtime support range.

Recommended:

```sh
nix develop
pnpm install
```

The workspace pins pnpm through the root `packageManager` field. For manual setup, install Node.js 24, enable the pinned pnpm version, and run `pnpm install` from the repository root.

## Stack

| Area                                      | Version source files                       |
| ----------------------------------------- | ------------------------------------------ |
| Runtime dependencies and package metadata | [`package.json`](./package.json)           |
| Development environment                   | [`../../flake.nix`](../../flake.nix)       |
| Workspace tooling and scripts             | [`../../package.json`](../../package.json) |

## Development Commands

Run commands from the repository root:

| Command                                          | Purpose                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm exec nx build @opalesce/orchestrator`      | Build ESM JavaScript and TypeScript declarations, including package dependencies. |
| `pnpm --dir packages/orchestrator run typecheck` | Type-check package source and tests without emitting files.                       |
| `pnpm --dir packages/orchestrator run test`      | Run focused orchestrator runtime tests.                                           |
| `pnpm exec nx run @opalesce/orchestrator:check`  | Build and verify the package boundary, then run type-checking and tests.          |
| `pnpm run build:workspace`                       | Build every Nx package project.                                                   |
| `pnpm run check:workspace`                       | Run package checks across the Nx workspace.                                       |

The package tests cover Core option forwarding, lifecycle ordering, dependency validation, typed services, artifact validation, immutable results, package exports, and error propagation.

## License

No license has been declared yet.
