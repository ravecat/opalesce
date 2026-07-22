## Why

The repository contains exploratory generator artifacts at the root, but the target project structure is a package-first `opalesce` workspace. Establishing Nx around `packages/*` creates the intended long-term boundary while `@opalesce/core` provides the first focused package without treating the current root layout as a permanent project.

## What Changes

- Add a pnpm workspace named `opalesce` and a minimal Nx project graph containing only projects under `packages/*`.
- Keep the repository root as workspace infrastructure rather than registering it as an Nx project.
- Allow the current root source, tests, and tooling to coexist temporarily without making their layout or package identity part of the target architecture.
- Add `@opalesce/core` as a strict ESM TypeScript library with its own build, typecheck, and test boundaries.
- Make `@opalesce/core` parse in-memory AsyncAPI input through the official `@asyncapi/parser` package and expose the parsed `AsyncAPIDocumentInterface` together with parser diagnostics.
- Keep the Nix development requirements as the workspace environment contract: Just, Node.js 24, pnpm 10, and the four existing Linux and Darwin system targets.
- Update the single root lockfile for the Nx workspace and package dependencies.
- Defer all plugin, template, runner, artifact-generation, legacy-code migration, Nx Release, and package-publication behavior to later changes.

## Capabilities

### New Capabilities

- `nx-workspace-foundation`: Package-first Nx and pnpm workspace topology, task discovery, and environment compatibility.
- `asyncapi-document-core`: A filesystem-independent `@opalesce/core` API for producing an official parsed AsyncAPI document and diagnostics from in-memory input.

### Modified Capabilities

None.

## Impact

- Workspace configuration: new `nx.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`; updated root workspace identity, scripts, development dependencies, ignore rules, and lockfile. No root `project.json` is created.
- New package: `packages/core` with package metadata, Nx metadata, TypeScript configuration, source, and focused tests.
- Dependencies: matching `nx` and `@nx/js` versions at the workspace root; `@asyncapi/parser` owned directly by `@opalesce/core` rather than inherited from transitional root artifacts.
- CI and release: workspace validation targets package projects; package publication remains deferred to a separate release change.
- Transitional compatibility: this change does not move or delete current root source and tests, but they are not modeled as the future workspace package boundary.
