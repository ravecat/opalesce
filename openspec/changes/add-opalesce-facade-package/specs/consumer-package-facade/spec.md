## ADDED Requirements

### Requirement: Opalesce facade package boundary

The workspace SHALL provide a private ESM TypeScript library at `packages/facade` with package and Nx project identity `opalesce`. The package SHALL emit JavaScript and TypeScript declarations for its documented root and subpath exports, SHALL expose the `opalesce` executable, and SHALL depend on `@opalesce/config`, `@opalesce/orchestrator`, and `@opalesce/cli` without depending on exploratory root source.

#### Scenario: Node.js consumer loads the facade

- **WHEN** a Node.js ESM consumer imports the built `opalesce` package root
- **THEN** the documented runtime exports load without source path aliases or deep imports

#### Scenario: TypeScript consumer loads facade declarations

- **WHEN** a TypeScript consumer compiles imports from `opalesce`, `opalesce/config`, and `opalesce/orchestrator`
- **THEN** package resolution uses the emitted declarations and exposes the documented runtime and type contracts

#### Scenario: Publication remains protected

- **WHEN** the facade package manifest is inspected during this change
- **THEN** the package and its internal workspace dependencies remain protected from publication

### Requirement: Consumer-facing root API

The `opalesce` package root SHALL export project `defineConfig`, `OpalesceConfig`, and `OutputConfig` from the config layer. It SHALL export the documented plugin authoring, typed service, programmatic pipeline, artifact, parser, diagnostic, result, context, and error contracts from the orchestration layer. The root `defineConfig` MUST refer only to project configuration, and the in-memory orchestration config helper SHALL be available as `definePipelineConfig`.

#### Scenario: Author a project config from one package

- **WHEN** a consumer imports `defineConfig` and `definePlugin` from `opalesce`
- **THEN** the consumer can default-export a valid path-based config without installing or importing internal scoped packages directly

#### Scenario: Run a pipeline programmatically

- **WHEN** a programmatic consumer imports `definePipelineConfig`, `definePlugin`, and `runPipeline` from `opalesce`
- **THEN** the consumer can configure and run the existing in-memory orchestration pipeline with its current types and behavior

#### Scenario: Config helper names are unambiguous

- **WHEN** a consumer imports `defineConfig` from the facade root
- **THEN** TypeScript accepts the project input and output path contract and rejects an in-memory pipeline-only config

### Requirement: Explicit facade subpaths

The `opalesce/config` subpath SHALL mirror the complete documented public API of `@opalesce/config`. The `opalesce/orchestrator` subpath SHALL mirror the complete documented public API of `@opalesce/orchestrator`, including the original orchestration `defineConfig` export. The facade SHALL use explicit re-exports so undocumented future internal symbols do not become facade exports automatically.

#### Scenario: Import project configuration subpath

- **WHEN** a config file imports `defineConfig` and config types from `opalesce/config`
- **THEN** the values and types are equivalent to the existing `@opalesce/config` contract

#### Scenario: Import complete orchestration subpath

- **WHEN** a library consumer imports helpers, errors, and types from `opalesce/orchestrator`
- **THEN** the values and types are equivalent to the existing `@opalesce/orchestrator` contract

### Requirement: Facade executable delegation

The facade package SHALL expose an `opalesce` bin through a stable Node.js shim. The built facade command entry SHALL delegate the supplied arguments and process IO to the existing `@opalesce/cli` command API and SHALL preserve its stdout, stderr, and exit-code behavior.

#### Scenario: Display help through the facade bin

- **WHEN** a consumer invokes the facade `opalesce --help`
- **THEN** the command prints the existing root help to stdout and exits with code `0`

#### Scenario: Report command usage failure through the facade bin

- **WHEN** a consumer invokes an unknown command through the facade bin
- **THEN** the command prints the existing usage failure to stderr and exits with code `2`

#### Scenario: Generate through a facade-only project setup

- **WHEN** a project config imports only from `opalesce`, declares an emitting plugin, and the consumer invokes `opalesce generate`
- **THEN** the CLI loads the TypeScript config, runs the existing pipeline once, and writes the emitted artifact with the existing success behavior

### Requirement: Internal CLI command boundary

`@opalesce/cli` SHALL expose a built ESM package root containing `runCli` and its public command IO types so the facade can delegate without importing CLI source or a package-private deep path. The existing CLI executable SHALL retain its current behavior.

#### Scenario: Facade imports the CLI command API

- **WHEN** the facade build resolves `runCli` from `@opalesce/cli`
- **THEN** it resolves through the CLI package export map and emitted declarations

#### Scenario: Existing CLI bin remains valid

- **WHEN** the focused `@opalesce/cli` package checks execute
- **THEN** its stable bin shim, command behavior, and existing integration tests continue to pass

### Requirement: One base consumer dependency

Consumer documentation SHALL require only `opalesce` as the base development dependency and SHALL describe output plugins as separate optional dependencies. It MUST NOT instruct normal project consumers to install `@opalesce/cli`, `@opalesce/config`, or `@opalesce/orchestrator` directly.

#### Scenario: Follow the documented quick start

- **WHEN** a consumer follows the facade quick start
- **THEN** the package manifest contains `opalesce` plus only the output plugin packages selected by that project

### Requirement: Workspace host and facade integration

The private repository root SHALL use the non-product package identity `@opalesce/workspace`, SHALL remain outside the Nx project graph, and SHALL depend directly on the `opalesce` facade for its development command link. The root generate script SHALL build the facade dependency graph before invoking `opalesce generate`.

#### Scenario: Resolve unique workspace package identities

- **WHEN** pnpm and Nx enumerate the workspace
- **THEN** exactly one workspace project owns the `opalesce` product package identity

#### Scenario: Exercise the consumer command boundary in the repository

- **WHEN** the root generate script is invoked
- **THEN** it builds the facade and its internal dependencies before invoking the facade-provided executable
