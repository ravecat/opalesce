## ADDED Requirements

### Requirement: Pnpm workspace topology

The repository SHALL use a root `pnpm-workspace.yaml` to discover packages under `packages/*` and SHALL maintain a single root `pnpm-lock.yaml`. Workspace packages MUST NOT own nested lockfiles or duplicate the workspace declaration in the root package manifest.

#### Scenario: Core is discovered as a workspace package

- **WHEN** pnpm resolves the workspace package named `@opalesce/core`
- **THEN** it resolves to `packages/core`
- **AND** no package-local lockfile is required

#### Scenario: Frozen installation remains reproducible

- **WHEN** dependencies are installed from the repository root with `pnpm install --frozen-lockfile`
- **THEN** installation succeeds using the single root lockfile

### Requirement: Package-only Nx project graph

The Nx workspace SHALL use `opalesce` as its root workspace identity and SHALL model `packages/core` as project `@opalesce/core`. Nx projects MUST live under `packages/*`; the repository root MUST NOT have a `project.json` or appear as a project in the Nx graph.

#### Scenario: Nx discovers Core without a root project

- **WHEN** an engineer runs `pnpm exec nx show projects`
- **THEN** the output contains `@opalesce/core`
- **AND** the output does not contain a project for the repository root

#### Scenario: Workspace foundation can precede the first package

- **WHEN** the workspace foundation is inspected before `packages/core` is created
- **THEN** `pnpm exec nx show projects` may return an empty project list
- **AND** no placeholder root project is introduced solely to populate the graph

### Requirement: Minimal Nx configuration

The workspace SHALL use exact matching versions of `nx` and `@nx/js`, SHALL enable only TypeScript build inference for the initial packages, and SHALL cache applicable build, check, typecheck, test, lint, and `format.check` targets. Typecheck inference MUST be disabled so the explicit Core no-emit target remains authoritative. The Nx terminal UI MUST be disabled for deterministic local and CI output.

#### Scenario: Nx package versions match

- **WHEN** the root development dependencies are inspected
- **THEN** `nx` and `@nx/js` have the same exact version

#### Scenario: Workspace configuration stays backend-library focused

- **WHEN** `nx.json` is inspected after setup
- **THEN** it contains the `@nx/js/typescript` plugin
- **AND** it does not contain frontend, application, container, test-runner, or release plugins not required by this change

### Requirement: Transitional root artifacts remain outside the graph

Workspace adoption SHALL NOT treat current root source, tests, build output, exports, or release configuration as permanent Nx project boundaries. Existing artifacts MAY remain in place until dedicated package-migration changes move or replace them.

#### Scenario: Workspace setup does not require an immediate source move

- **WHEN** the Nx workspace foundation is added
- **THEN** current root source and tests can remain temporarily
- **AND** their presence does not create a root Nx project

#### Scenario: Root layout does not define future package contracts

- **WHEN** a new library or generator boundary is specified
- **THEN** its identity, exports, and outputs are defined under `packages/*`
- **AND** they are not inferred from current root artifacts

### Requirement: Project-scoped and aggregate task execution

The workspace SHALL provide independently runnable build, typecheck, test, and check targets for `@opalesce/core`. Root `build:workspace` SHALL run `nx run-many -t build`, and root `check:workspace` SHALL run `nx run-many -t check`, covering package projects without creating targets for transitional root artifacts.

#### Scenario: Core targets run independently

- **WHEN** an engineer invokes the Core build, typecheck, test, or check target through Nx
- **THEN** Nx executes only Core and its declared dependencies

#### Scenario: Aggregate workspace validation covers package projects

- **WHEN** an engineer runs the workspace check command
- **THEN** Nx validates `@opalesce/core` and every later package project exposing a check target
- **AND** failure in any included package makes the aggregate command fail

#### Scenario: Aggregate build preserves package outputs

- **WHEN** an engineer runs the workspace build command
- **THEN** the Core output is written to `packages/core/dist`
- **AND** no root `dist` output is required by the Nx aggregate

### Requirement: Isolated TypeScript baselines

The repository SHALL provide a strict ES2022 ESM TypeScript base for new packages. `@opalesce/core` SHALL use that base and emit JavaScript plus declarations, while any transitional root TypeScript configuration remains outside the Nx package graph.

#### Scenario: Core compiles under strict settings

- **WHEN** the Core typecheck target runs
- **THEN** strict TypeScript validation succeeds without emitting files
- **AND** Core source and tests are included

#### Scenario: Transitional root does not define the package baseline

- **WHEN** a package TypeScript project is evaluated after workspace setup
- **THEN** it extends the workspace base configuration
- **AND** it does not inherit compiler behavior from a transitional root `tsconfig.json`

### Requirement: Nix development environment compatibility

The workspace SHALL retain the Nix development shell as the canonical tool environment. The flake MUST expose shells for `x86_64-linux`, `aarch64-linux`, `x86_64-darwin`, and `aarch64-darwin`, and each shell MUST provide Just, Node.js 24, and pnpm 10. Git SHALL remain a host prerequisite rather than a package in the development shell.

#### Scenario: Supported shell outputs remain present

- **WHEN** the flake development-shell output names are evaluated
- **THEN** all four required system identifiers are present

#### Scenario: Required tools are available in the shell

- **WHEN** a developer or CI job enters the default Nix shell
- **THEN** `just`, `node`, and `pnpm` are available
- **AND** Node.js reports major version 24
- **AND** pnpm reports major version 10
- **AND** the flake does not add Git to the shell package set

### Requirement: Workspace-aware lint and formatting

Repository-wide lint and formatting SHALL include source and tests under `packages/*` and SHALL exclude generated `**/dist/**` and `.nx/**` paths. The existing native `format:check` script MUST remain available, while `format.check` SHALL be the canonical Nx target name.

#### Scenario: Built package output is not linted

- **WHEN** Core is built before the root check runs
- **THEN** ESLint and formatting checks ignore `packages/core/dist`
- **AND** they still validate Core source and tests

#### Scenario: Formatting target name is unambiguous

- **WHEN** Nx target defaults and project targets are inspected
- **THEN** `format.check` is used for Nx caching and invocation
- **AND** `format:check` remains a compatibility script but is not referenced by Nx configuration or aggregate commands

### Requirement: CI validation and release isolation

The check workflow SHALL validate the aggregate Nx package workspace after a frozen pnpm install. `@opalesce/core` MUST be protected from publication until a separate release change defines package release ownership; this change SHALL NOT infer future publication behavior from the current root workflow.

#### Scenario: Pull request validation includes Core

- **WHEN** the check workflow runs for a pull request or push
- **THEN** it executes the aggregate workspace check inside the Nix shell

#### Scenario: Package release behavior remains deferred

- **WHEN** the initial workspace and Core package are created
- **THEN** no Nx release configuration is introduced
- **AND** `@opalesce/core` cannot be published accidentally

### Requirement: Nx runtime state stays untracked

Generated Nx cache and workspace-state data SHALL be excluded from version control.

#### Scenario: Nx commands do not dirty the repository with runtime state

- **WHEN** Nx creates `.nx/cache` or `.nx/workspace-data`
- **THEN** Git ignores those paths
