## ADDED Requirements

### Requirement: Core owns the in-memory generation engine

`@opalesce/core` SHALL expose AsyncAPI parsing, plugin authoring, plugin ordering and lifecycle execution, typed services, artifact collection, and orchestration errors from its root entry point.

#### Scenario: Programmatic consumer imports the complete engine

- **WHEN** a TypeScript consumer imports the documented parser, plugin, service, artifact, error, and pipeline contracts from `@opalesce/core`
- **THEN** the package compiles without a dependency on `@opalesce/orchestrator`

### Requirement: Programmatic generation uses run

`@opalesce/core` SHALL export `run(config)` as the only programmatic pipeline runner and MUST NOT export `runPipeline`.

#### Scenario: Execute an in-memory pipeline

- **WHEN** a consumer calls `run` with valid in-memory AsyncAPI input and configured plugins
- **THEN** Core parses the input once, runs all setup hooks before build hooks in resolved dependency order, and returns the document, diagnostics, artifacts, and plugin names

#### Scenario: Reject the removed runner name

- **WHEN** package runtime and declaration exports are inspected
- **THEN** `run` is present and `runPipeline` is absent

### Requirement: Core remains filesystem-free

Core MUST NOT discover configuration files, interpret input strings as filesystem paths, persist artifacts, write terminal output, or set process exit state.

#### Scenario: CLI generates files

- **WHEN** the CLI executes a project generation command
- **THEN** the CLI resolves and reads the input, calls Core `run`, and persists successful artifacts outside Core

### Requirement: Orchestrator package boundary is removed

The workspace MUST NOT define an `@opalesce/orchestrator` package or TypeScript and Nx project reference, and the `opalesce` facade MUST NOT expose an `opalesce/orchestrator` subpath.

#### Scenario: Install and build the workspace

- **WHEN** pnpm resolves workspace importers and Nx discovers package projects
- **THEN** config, CLI, and facade packages depend on `@opalesce/core` and no orchestrator project is present

### Requirement: Facade exposes Core run without CLI collision

The `opalesce` root SHALL export Core's `run`, while the executable entrypoint SHALL continue to import the command-level `run` directly from `@opalesce/cli`.

#### Scenario: Use the facade programmatically and as a command

- **WHEN** a consumer imports `run` from `opalesce` and invokes the installed `opalesce` executable
- **THEN** the import executes the Core pipeline contract and the executable executes the CLI command contract
