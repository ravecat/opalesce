## ADDED Requirements

### Requirement: Package-level orchestration boundary

The workspace SHALL provide an ESM TypeScript library at `packages/orchestrator` with package and Nx project identity `@opalesce/orchestrator`. The package SHALL emit JavaScript and TypeScript declarations from one root export, SHALL depend directly on `@opalesce/core`, and MUST NOT change the public Core API.

#### Scenario: Package consumer imports the orchestration API

- **WHEN** a TypeScript consumer imports the package root
- **THEN** the consumer can use the exported runtime functions, error classes, plugin contracts, service contracts, artifact contracts, pipeline config, and result types without a deep import

#### Scenario: Runtime consumer loads the built package

- **WHEN** a Node.js ESM consumer imports the built package root
- **THEN** only the documented runtime values are exposed and no source path alias is required

### Requirement: Structured in-memory pipeline

The package SHALL export `defineConfig` as a type-preserving identity helper and `runPipeline(config)` as the orchestration entry point. The config SHALL accept official Core `Input`, optional Core parser and parse options, and an optional readonly plugin collection. The runner MUST parse the input exactly once through `parseAsyncAPI` and MUST expose the successful official document and complete non-fatal parser diagnostics to plugin contexts and the result.

#### Scenario: Run a pipeline without plugins

- **WHEN** `runPipeline` receives a valid in-memory AsyncAPI input and no plugins
- **THEN** it returns the official parsed document, parser diagnostics, an empty artifact collection, and an empty resolved plugin-name collection

#### Scenario: Forward parser options

- **WHEN** a caller supplies Core parser or parse options
- **THEN** the runner forwards them unchanged to Core parsing

#### Scenario: Reject invalid AsyncAPI input

- **WHEN** Core rejects invalid input with `AsyncAPIParseError`
- **THEN** the runner rejects with that same error and does not run a plugin hook

### Requirement: Typed plugin definition

The package SHALL export `definePlugin` and public plugin interfaces. A plugin SHALL declare a non-empty name and MAY declare dependencies, a setup hook, and a build hook. `definePlugin` MUST preserve the option and concrete plugin types returned by its factory.

#### Scenario: Define a configurable plugin

- **WHEN** a consumer passes a typed plugin factory to `definePlugin`
- **THEN** the returned factory retains its option parameter and concrete plugin return types

#### Scenario: Run both lifecycle phases

- **WHEN** configured plugins declare setup and build hooks
- **THEN** every setup hook completes in resolved plugin order before any build hook starts, and build hooks then complete in the same resolved order

#### Scenario: Omit a lifecycle phase

- **WHEN** a plugin omits setup or build
- **THEN** the runner skips the omitted phase without failing

### Requirement: Deterministic dependency ordering

The runner MUST validate plugin identities and dependencies before parsing input. It SHALL reject empty or duplicate plugin names, missing or self dependencies, and dependency cycles. For a valid graph it SHALL use a stable topological order in which configured order breaks ties between currently eligible plugins.

#### Scenario: Reorder a dependent plugin

- **WHEN** a plugin is configured before a provider named in its `dependsOn`
- **THEN** the provider runs before the dependent plugin in both phases

#### Scenario: Preserve eligible plugin order

- **WHEN** multiple configured plugins have no unresolved dependency relation
- **THEN** they become eligible and run according to their relative config order

#### Scenario: Reject duplicate names

- **WHEN** two configured plugins have the same name
- **THEN** the runner rejects with a duplicate-name `PluginConfigurationError` before parsing or running hooks

#### Scenario: Reject a missing dependency

- **WHEN** a plugin names a dependency that is not configured
- **THEN** the runner rejects with a missing-dependency `PluginConfigurationError` before parsing or running hooks

#### Scenario: Reject a dependency cycle

- **WHEN** configured plugin dependencies form a cycle or a plugin depends on itself
- **THEN** the runner rejects with a dependency-cycle `PluginConfigurationError` before parsing or running hooks

### Requirement: Typed shared services

The package SHALL export `createServiceToken<T>()` and typed setup and build context methods for providing and retrieving services. Service lookup MUST use token identity, each token MUST be provided at most once per pipeline, and a missing service request MUST fail with an exported `ServiceRegistryError`.

#### Scenario: Consume a dependency service

- **WHEN** a provider registers a value during setup and a dependent plugin retrieves the same token during setup or build
- **THEN** the dependent plugin receives that value with the token's static type

#### Scenario: Keep equal service names isolated

- **WHEN** two different tokens have the same diagnostic name
- **THEN** values registered for the tokens remain independent

#### Scenario: Reject duplicate service provision

- **WHEN** a second plugin provides a value for an already registered token
- **THEN** its hook fails with a duplicate-service `ServiceRegistryError`

#### Scenario: Reject a missing service

- **WHEN** a plugin retrieves a token that has not been provided
- **THEN** its hook fails with a missing-service `ServiceRegistryError`

### Requirement: Central artifact collection

Build contexts SHALL expose a readonly snapshot of artifacts emitted so far and an `emit` method for adding text artifacts. An artifact path MUST be a canonical forward-slash-separated relative path without empty, current-directory, parent-directory, absolute, or backslash segments. The runner MUST reject a second artifact using an existing path and MUST return defensive frozen artifact objects in a frozen collection.

#### Scenario: Collect artifacts in resolved order

- **WHEN** build hooks emit distinct valid artifacts
- **THEN** the result contains them in emission order

#### Scenario: Inspect earlier artifacts

- **WHEN** a later build hook reads its artifact snapshot
- **THEN** it sees artifacts emitted by earlier build hooks but cannot mutate the runner's collection

#### Scenario: Reject an invalid artifact path

- **WHEN** a plugin emits an artifact with an absolute, non-canonical, backslash-containing, empty, current-directory, or parent-traversing path
- **THEN** its hook fails with an invalid-path `ArtifactError`

#### Scenario: Reject an artifact collision

- **WHEN** a plugin emits an artifact path already emitted by any plugin
- **THEN** its hook fails with a path-collision `ArtifactError`

### Requirement: Observable pipeline failures

The package SHALL export structured configuration, service, artifact, and plugin execution error classes. A setup or build hook failure MUST be wrapped in `PluginExecutionError` with the plugin name, lifecycle phase, and original cause. Core parse errors and pre-parse plugin configuration errors MUST NOT be wrapped as plugin execution errors.

#### Scenario: Setup hook fails

- **WHEN** a setup hook throws
- **THEN** the runner rejects with `PluginExecutionError` identifying the plugin and `setup` phase and retaining the thrown value as its cause

#### Scenario: Build hook fails

- **WHEN** a build hook throws
- **THEN** the runner rejects with `PluginExecutionError` identifying the plugin and `build` phase and retaining the thrown value as its cause

#### Scenario: Pipeline failure is fail-fast

- **WHEN** any plugin hook fails
- **THEN** no later hook runs and the runner returns no partial result

### Requirement: Filesystem-free orchestration

The package MUST NOT discover or execute config files, interpret input strings as filesystem paths, provide a CLI or bin, read source files, write artifacts, clean output directories, or contain concrete schema and output generation behavior.

#### Scenario: Caller owns input and persistence

- **WHEN** a consumer runs the pipeline
- **THEN** it supplies in-memory Core input and receives in-memory artifacts without orchestration performing filesystem I/O
