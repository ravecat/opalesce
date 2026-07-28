## Why

The package named `@opalesce/core` currently owns only AsyncAPI parsing while the actual generation engine lives in a private `@opalesce/orchestrator` package with no independent consumer or release boundary. Consolidating the engine in Core makes package ownership match runtime responsibility and removes an unnecessary workspace layer before the public API stabilizes.

## What Changes

- Move the filesystem-free plugin pipeline, plugin contracts, typed services, artifact collection, and orchestration errors into `@opalesce/core`.
- **BREAKING** Rename the programmatic pipeline entry point from `runPipeline` to `run`.
- **BREAKING** Remove the `@opalesce/orchestrator` workspace package and the `opalesce/orchestrator` facade subpath.
- Update `@opalesce/config`, `@opalesce/cli`, and `opalesce` to consume or re-export the Core contract.
- Remove the superseded exploratory root source, tests, build output, release automation, generator dependencies, and AsyncAPI-specific workspace metadata.
- Preserve CLI and filesystem ownership outside Core.
- Keep historical OpenSpec changes unchanged as records of the earlier package split.
- Defer publication, additional input adapters, and extraction of a lightweight plugin SDK to explicit follow-up changes.

## Capabilities

### New Capabilities

- `core-engine-api`: Defines Core as the owner of AsyncAPI parsing and the in-memory plugin generation engine exposed through `run`.

### Modified Capabilities

None.

## Impact

- Removes `packages/orchestrator` and its Nx and TypeScript project references.
- Expands the runtime and type exports of `@opalesce/core`.
- Changes imports and workspace dependencies in config, CLI, and facade packages.
- Changes the consumer-facing programmatic API from `runPipeline` to `run`.
- Leaves the repository root as a private workspace host whose commands delegate to package projects.
- Requires package-contract, type-contract, lifecycle, CLI, and facade regression coverage to move with the implementation.
