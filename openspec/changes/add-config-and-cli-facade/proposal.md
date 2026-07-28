## Why

Opalesce has an in-memory orchestration engine but no declarative project configuration or executable that turns that engine into a Kubb-like generation workflow. Consumers currently have to call `runPipeline` directly and own config loading, input reading, artifact persistence, diagnostics, and process behavior themselves.

## What Changes

- Add a private `@opalesce/config` ESM package that defines the public `opalesce.config.*` shape and exports a type-preserving `defineConfig` helper.
- Add a private `@opalesce/cli` ESM package with the `opalesce` bin and an `opalesce generate` command.
- Discover or explicitly resolve an `opalesce.config.*` file, load its default export, validate its runtime shape, and resolve paths against an explicit base.
- Read the configured AsyncAPI source, adapt the user config to the existing in-memory `PipelineConfig`, invoke `@opalesce/orchestrator`, and persist successful text artifacts under the configured output directory.
- Report diagnostics and failures through deterministic stdout, stderr, and exit-code behavior.
- Keep `@opalesce/orchestrator` as the filesystem-free plugin lifecycle engine and document `runPipeline` as the programmatic API beneath the CLI.
- Link the CLI into the private workspace so the repository can exercise the same `opalesce generate` entry point as future consumers.
- Defer watch mode, URL input, multiple configs per file, config functions, output formatting and linting, JSON reporting, interactive initialization, legacy root-runtime migration, package publication, and release automation.

## Capabilities

### New Capabilities

- `project-configuration`: Defines the public path-based Opalesce config contract and type-safe authoring helper.
- `generation-cli`: Defines config discovery and loading, command behavior, pipeline adaptation, artifact persistence, diagnostics, and process outcomes for `opalesce generate`.

### Modified Capabilities

None.

## Impact

- New workspace projects: `packages/config` and `packages/cli`.
- Existing dependencies: `@opalesce/cli` depends on `@opalesce/config` and `@opalesce/orchestrator`; `@opalesce/config` depends on orchestration contract types; `@opalesce/orchestrator` continues to depend only on `@opalesce/core`.
- Existing API: `runPipeline` remains available for programmatic in-memory use, while user-facing config files import `defineConfig` from `@opalesce/config`.
- Workspace integration: root TypeScript references, the pnpm lockfile, and the private root development dependencies or scripts gain the new projects and bin.
- Documentation: orchestration documentation distinguishes programmatic use from the CLI-driven project workflow.
- Transitional root CLI and generator files remain untouched and do not define the new package contracts.
