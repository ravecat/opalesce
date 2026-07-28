## Why

Opalesce has a focused AsyncAPI parsing boundary but no package-level runtime for composing that parsed document with optional schema and output plugins. A typed, in-memory orchestration layer is needed now so future packages can integrate through one deterministic pipeline instead of duplicating ordering, shared-state, error, and artifact-collection behavior.

## What Changes

- Add an ESM TypeScript package named `@opalesce/orchestrator`.
- Add a programmatic pipeline that parses in-memory AsyncAPI input once through `@opalesce/core`, then exposes the valid official document and parser diagnostics to configured plugins.
- Add typed plugin factories, setup and build phases, explicit plugin dependencies, stable dependency ordering, and startup validation for duplicate names, missing dependencies, and dependency cycles.
- Add typed service tokens so one plugin can provide an in-memory capability, such as a future schema graph, to dependent plugins without untyped context mutation.
- Add centralized text-artifact collection with canonical relative paths and collision detection.
- Add structured configuration and plugin execution errors while preserving Core parse errors.
- Keep filesystem input, config discovery, CLI/bin behavior, artifact persistence, concrete schema processing, emitters, and publication out of scope.
- Leave the exploratory root plugin runtime and CLI unchanged during package-first migration.

## Capabilities

### New Capabilities

- `plugin-orchestration`: In-memory AsyncAPI parsing and deterministic plugin execution with typed shared services and artifact collection.

### Modified Capabilities

None.

## Impact

- Adds `packages/orchestrator` as a new Nx package project.
- Adds a workspace dependency from `@opalesce/orchestrator` to `@opalesce/core`.
- Establishes public contracts that future `@opalesce/schema` and output-plugin packages can consume.
- Does not change `@opalesce/core`, existing root runtime behavior, release configuration, or published package behavior.
