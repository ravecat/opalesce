## Context

`@opalesce/core` is the first package-first boundary in the workspace. It parses in-memory AsyncAPI input into the official `AsyncAPIDocumentInterface`, preserves diagnostics, and rejects invalid documents. It intentionally does not discover configuration, manage plugins, generate artifacts, or perform filesystem I/O.

The exploratory root implementation already demonstrates config, plugin ordering, context injection, artifact collection, and CLI behavior, but it combines AsyncAPI loading, schema extraction, and JSON Schema emission inside one plugin. Its `Record<string, unknown>` injection surface and mutable shared context are not suitable as future public package contracts.

The new layer must compose Core with future schema and output packages while keeping Core focused and keeping filesystem concerns outside the package. A future `@opalesce/schema` package must be able to provide a typed schema graph to dependent output plugins without requiring an untyped global context.

## Goals / Non-Goals

**Goals:**

- Add `@opalesce/orchestrator` as the in-memory owner of pipeline configuration and plugin execution.
- Parse the configured AsyncAPI input exactly once through `@opalesce/core`.
- Provide deterministic dependency-aware plugin execution with separate setup and build phases.
- Provide type-safe service exchange between packages.
- Collect text artifacts centrally and reject ambiguous or colliding output paths.
- Expose stable result and error contracts suitable for a later CLI or facade package.

**Non-Goals:**

- Discover or execute config files.
- Add an `opalesce` bin or CLI argument processing.
- Read source files or write generated artifacts.
- Define whether a future schema graph is a mandatory pipeline stage or a service provided by `@opalesce/schema`.
- Migrate or remove the exploratory root runtime.
- Implement concrete schema, TypeScript, Zod, JSON Schema, barrel, or other output plugins.
- Configure package publication or release behavior.

## Decisions

### 1. Add a focused `@opalesce/orchestrator` package

The package lives at `packages/orchestrator`, depends on `@opalesce/core`, and follows the existing ESM, declaration, test, and package-verification conventions. Package solution configs remain composite so Nx can synchronize the root TypeScript solution references without modeling the root as a project. Core remains unaware of orchestration, so the dependency direction is:

```text
@opalesce/orchestrator -> @opalesce/core -> @asyncapi/parser
```

Future plugin packages depend on the orchestrator contracts and any domain package they consume. A later facade or CLI depends on the orchestrator, not the reverse.

This is preferred over adding plugin management to Core because the current Core capability explicitly excludes orchestration. It is also preferred over moving the exploratory root runtime because that would preserve transitional contracts and mixed responsibilities.

### 2. Use a structured in-memory pipeline config

The public entry point is:

```ts
export interface PipelineConfig {
  readonly input: Input;
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}

export declare function defineConfig<const TConfig extends PipelineConfig>(
  config: TConfig,
): TConfig;

export declare function runPipeline(config: PipelineConfig): Promise<PipelineResult>;
```

`defineConfig` is an identity helper for inference and authoring. `runPipeline` validates plugins before parsing, invokes `parseAsyncAPI` once, and supplies the successful document and parser diagnostics to every phase.

The input is the official in-memory Core `Input`, not a filesystem path descriptor. A future config loader can resolve a user-facing path to in-memory input before calling this API.

### 3. Use two explicit plugin phases

A plugin has a unique name, optional `dependsOn`, optional `setup`, and optional `build`:

```ts
export interface OrchestrationPlugin {
  readonly name: string;
  readonly dependsOn?: readonly string[];
  setup?(context: PluginSetupContext): void | Promise<void>;
  build?(context: PluginBuildContext): void | Promise<void>;
}
```

All setup hooks run in resolved plugin order before any build hook. Setup is the capability-registration phase. Build is the artifact-generation phase. This makes a future schema provider available before any output plugin starts generation without creating a general event bus or hook-name registry.

`definePlugin` preserves a plugin factory's option and result types. Plain objects remain assignable to the public plugin interface.

This is preferred over a single immediate `install` hook because interleaving service registration and artifact generation makes availability depend on incidental plugin position. A large lifecycle hook map is deferred until concrete requirements justify it.

### 4. Resolve explicit dependencies deterministically

Before parsing, the runner validates non-empty unique plugin names, rejects missing dependencies and self-dependencies, and detects cycles. It then computes a stable topological order. When multiple plugins are eligible, their original config order decides which runs first.

The same order is used for setup and build. Plugin array order therefore remains meaningful while explicit dependencies can move a provider ahead of a consumer.

This is preferred over the exploratory `pre` and `post` arrays because both currently behave as prerequisites and do not express direction clearly. A single `dependsOn` relation has one observable meaning.

### 5. Exchange typed services through tokens

The package exposes:

```ts
export interface ServiceToken<T> {
  readonly name: string;
  readonly key: symbol;
}

export declare function createServiceToken<T>(name: string): ServiceToken<T>;
```

Setup contexts can `provide(token, value)` and both phases can `get(token)`. Tokens use symbol identity rather than names for lookup, while names are retained for diagnostics. A token can be provided once per pipeline, and requesting an absent token fails with an exported service error.

A future schema package can export one shared token:

```ts
export const schemaGraphService = createServiceToken<SchemaGraph>("@opalesce/schema/graph");
```

This is preferred over merging arbitrary objects into context because token consumers retain static types and unrelated plugins cannot overwrite fields accidentally.

### 6. Centralize immutable text artifacts

Build contexts expose the artifacts emitted so far and an `emit` method accepting:

```ts
export interface GeneratedArtifact {
  readonly path: string;
  readonly contents: string;
}
```

Paths must be canonical, non-empty, forward-slash-separated relative paths. Absolute paths, backslashes, dot segments, parent traversal, and normalized aliases are rejected. A path can be emitted only once across the pipeline.

The runner stores defensive frozen copies and returns a frozen artifact array. It does not write them. Central collection allows a later storage layer to perform atomic persistence and allows post-generation plugins to inspect earlier artifacts.

Text-only artifacts match the current generator domain. Binary artifacts and a richer file AST are deferred until required.

### 7. Preserve stage-specific failures

Core `AsyncAPIParseError` passes through unchanged. Plugin configuration failures use `PluginConfigurationError` with a machine-readable code. Failures thrown by setup or build hooks are wrapped in `PluginExecutionError` carrying the plugin name, phase, and original cause. Invalid or duplicate artifacts and missing or duplicate services use exported typed errors and are wrapped when raised by a plugin hook.

The pipeline is fail-fast and returns no partial result. This keeps callers from treating incomplete artifacts as successful output.

## Risks / Trade-offs

- [Public plugin contracts can constrain future lifecycle design] -> Keep the first lifecycle to setup and build, and defer additional hooks until a concrete package requires them.
- [A mutable value stored behind a service token can still be mutated] -> The registry protects ownership and lookup, but service packages remain responsible for exposing readonly or frozen values.
- [Topological ordering can differ from literal config order] -> Document stable eligible-order semantics and return the resolved plugin names for observability.
- [Text artifacts may not support future binary assets] -> Add a backward-compatible content union only when a concrete plugin needs it.
- [The role of `@opalesce/schema` is not yet fixed] -> The typed service mechanism supports a provider plugin, while a later mandatory schema stage can add the same service before plugin setup.
- [The exploratory root runtime temporarily duplicates concepts] -> Do not migrate it in this change; validate the new package independently and remove duplication in an explicit follow-up.

## Migration Plan

1. Add and validate `@opalesce/orchestrator` without changing existing root commands.
2. Use package-consumer and type-contract tests to freeze the intended public API.
3. Implement future schema and output packages against service tokens and artifacts.
4. Add a separate facade/config-loader/CLI change that resolves filesystem input, invokes `runPipeline`, and persists returned artifacts.
5. Migrate root consumers only after the replacement packages cover their behavior.

Rollback consists of removing the new package and its workspace lockfile entry; Core and exploratory root behavior remain unchanged.

## Open Questions

- Will `@opalesce/schema` become a mandatory stage or a provider plugin? This change intentionally supports both.
- Should the future facade expose this config directly or resolve a separate path-based user config into it?
- Which concrete plugin first requires richer artifact metadata or a shared naming resolver?
