## ADDED Requirements

### Requirement: Public configuration package

The workspace SHALL provide a private ESM TypeScript library at `packages/config` with package and Nx project identity `@opalesce/config`. The package SHALL emit JavaScript and TypeScript declarations from one root export and SHALL expose its complete documented API without source path aliases or deep imports.

#### Scenario: TypeScript consumer imports config API

- **WHEN** a TypeScript consumer imports the `@opalesce/config` package root
- **THEN** the consumer can use the runtime authoring helper and public config types

#### Scenario: Node.js consumer loads built config package

- **WHEN** a Node.js ESM consumer imports the built package root
- **THEN** the documented runtime helper loads without workspace source aliases

### Requirement: Path-based project config

The package SHALL export an `OpalesceConfig` contract containing one non-empty input path, one output object with a non-empty path and optional boolean `clean`, optional Core parser options, and an optional readonly collection of orchestration plugins. `clean` MUST be treated as `false` when omitted. The project config SHALL remain distinct from the in-memory orchestration `PipelineConfig`.

#### Scenario: Author a minimal config

- **WHEN** a consumer provides non-empty `input` and `output.path` values
- **THEN** the value satisfies the public config contract without parser options, plugins, or `clean`

#### Scenario: Configure pipeline options

- **WHEN** a consumer provides parser options and orchestration plugins
- **THEN** their existing public types are accepted without redefining plugin or parser contracts in the config package

#### Scenario: Opt into output cleanup

- **WHEN** a consumer sets `output.clean` to `true`
- **THEN** the config represents an explicit request for guarded output-directory cleanup before persistence

### Requirement: Side-effect-free config authoring

The package SHALL export `defineConfig` as a side-effect-free identity helper that accepts one `OpalesceConfig` object and preserves its concrete TypeScript type. Calling or importing `defineConfig` MUST NOT discover files, read input, run the pipeline, write artifacts, print output, or terminate a process.

#### Scenario: Preserve concrete config types

- **WHEN** a consumer passes a config with concrete plugin instances and literal options to `defineConfig`
- **THEN** the returned value preserves those concrete types

#### Scenario: Import a project config

- **WHEN** a tool imports a default-exported `defineConfig` result
- **THEN** importing the config only evaluates trusted config module code and does not start generation through the helper

### Requirement: Focused configuration boundary

`@opalesce/config` MUST NOT parse command arguments, discover or import config files, resolve filesystem paths, read AsyncAPI sources, invoke `runPipeline`, persist artifacts, or define process exit behavior. It SHALL depend on public orchestration contracts rather than on CLI implementation.

#### Scenario: Use config package without CLI

- **WHEN** a library consumer imports `@opalesce/config`
- **THEN** no CLI entry point, filesystem operation, or process side effect is activated
