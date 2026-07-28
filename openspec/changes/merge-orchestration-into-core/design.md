## Context

`@opalesce/core` currently exposes only the AsyncAPI parser boundary. The filesystem-free engine that validates and orders plugins, runs lifecycle hooks, shares typed services, and collects artifacts lives in `@opalesce/orchestrator`. Config, CLI, and facade packages therefore depend on a package whose only purpose is to sit immediately above Core.

All affected packages are private and versioned together, so independent publication and compatibility are not current constraints. The CLI must continue to own config discovery, filesystem access, output persistence, terminal rendering, and exit behavior.

The repository root still contains the exploratory generator source, tests, build output, Vitest setup, generator dependencies, and semantic-release configuration that predate the package workspace. The replacement Core, config, CLI, and facade boundaries now cover the retained behavior, so those transitional artifacts no longer have an owner.

## Goals / Non-Goals

**Goals:**

- Make `@opalesce/core` the single programmatic generation engine.
- Preserve current parsing, plugin ordering, lifecycle, service, artifact, and error behavior.
- Expose the programmatic runner only as `run`.
- Remove the redundant orchestrator package, facade subpath, workspace references, and dependency edges.
- Remove the superseded exploratory root package and leave the root as a private workspace host.
- Keep the TypeScript package graph and Nx project graph valid.

**Non-Goals:**

- Move filesystem or CLI behavior into Core.
- Add adapters for other document formats.
- Publish packages or establish independent semantic-versioning policies.
- Extract a lightweight plugin SDK.
- Rewrite historical OpenSpec changes that document the earlier architecture.

## Decisions

### Core owns orchestration behind an internal module boundary

The orchestration modules move under `packages/core/src/orchestrator`, while `packages/core/src/index.ts` remains the only public barrel. This keeps responsibilities discoverable without paying for a separate npm and Nx project.

Keeping `@opalesce/orchestrator` was rejected because it has no independent consumers, dependency policy, version, or runtime target. Flattening every implementation file into `packages/core/src` was rejected because parsing and orchestration remain distinct internal responsibilities.

### The programmatic runner is named `run`

Core exports `run(config): Promise<PipelineResult>` and does not retain a `runPipeline` compatibility alias. The workspace has not published this API, and retaining both names would create avoidable ambiguity.

`@opalesce/cli` also exports a command-level `run`, but the two names live in different packages. The facade root exports Core's `run`; the executable entrypoint imports CLI's `run` directly from `@opalesce/cli`.

### Parsing stays in Core

The parser implementation moves from the former Core barrel into a focused `parseAsyncAPI.ts` module. The orchestration runner imports it internally, and the Core barrel explicitly exports both parser and engine contracts.

Extracting an AsyncAPI adapter now was rejected because Opalesce currently supports one input domain and no second adapter requires that boundary.

### Consumers depend directly on Core

`@opalesce/config` uses Core plugin and parser types. `@opalesce/cli` invokes Core's `run` and persists the returned artifacts. The `opalesce` facade explicitly re-exports its selected Core contract and removes `opalesce/orchestrator`.

The facade does not re-export CLI's command runner, avoiding a root export collision with Core's `run`.

### The repository root is a workspace host

The root `src`, `test`, `dist`, and root Vitest configuration are removed instead of being migrated because their replacement package contracts already exist. Generator-only dependencies and TypeScript path aliases are removed from the root importer. The root TypeScript config becomes a solution-style project reference file, while build, typecheck, test, and check commands delegate to Nx package targets.

The old semantic-release config and publish workflow are also removed. They target the former single root package and cannot safely publish the current private multi-package graph. Publication remains deferred until a dedicated change defines package versions, dependency ranges, and release ownership.

Nix and Just remain workspace tooling. Their commands are redirected to workspace scripts, and the Nix description is renamed from the former AsyncAPI package identity to Opalesce.

## Risks / Trade-offs

- [Core grows beyond parsing] -> Keep parsing and orchestration in separate internal modules with explicit barrel exports.
- [Two packages export functions named `run`] -> Keep command execution scoped to `@opalesce/cli` and programmatic generation scoped to `@opalesce/core` and `opalesce`.
- [Removing `runPipeline` breaks internal callers] -> Update every workspace import and add package-consumer and type-contract checks for `run`.
- [Historical documents mention the old architecture] -> Preserve them as immutable decision history and add this change as the superseding record.
- [Removing a package can leave stale workspace metadata] -> Regenerate the pnpm lockfile and validate the complete Nx build and check graphs.
- [Removing root release automation leaves no publish path] -> Keep all packages private and design multi-package release ownership in a dedicated follow-up.
- [Deleting legacy coverage can hide a behavior gap] -> Retain only behavior represented by current package contracts and run focused plus aggregate package tests before removal is accepted.

## Migration Plan

1. Move parser implementation and orchestration modules into Core and expose `run`.
2. Move orchestration tests and package-contract assertions into Core.
3. Redirect config, CLI, and facade dependencies and imports to Core.
4. Remove the facade orchestrator subpath and the orchestrator workspace project.
5. Remove the superseded root package implementation, tests, build and release configuration, dependencies, and package-specific metadata.
6. Regenerate workspace metadata, update current package documentation, and run targeted plus aggregate validation.

Rollback restores `packages/orchestrator` and the deleted root artifacts from version control, redirects consumer dependencies to orchestrator, restores `runPipeline` and `opalesce/orchestrator`, and regenerates workspace metadata.

## Open Questions

None for this change. A plugin SDK or AsyncAPI adapter becomes a separate decision only when a concrete independent consumer appears.
