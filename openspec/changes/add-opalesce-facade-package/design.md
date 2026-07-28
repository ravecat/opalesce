## Context

`@opalesce/core`, `@opalesce/orchestrator`, `@opalesce/config`, and `@opalesce/cli` now form the package-first generation stack. The layers have useful internal ownership, but the documented project setup exposes those boundaries to every consumer: a project must install three base packages before it adds any output plugin.

The current repository root is a private infrastructure host named `opalesce`. It is intentionally outside the Nx graph and still contains exploratory source and tests. A workspace package cannot reuse that npm identity until the host receives an explicit non-product name.

Kubb's current package model provides the relevant consumer precedent: one top-level package supplies the executable and config surface, while output plugins remain separate dependencies. Opalesce needs the same dependency shape without copying Kubb's defaults, adapters, or broader config behavior.

## Goals / Non-Goals

**Goals:**

- Give a project one base dependency named `opalesce`.
- Preserve the focused ownership and dependency direction of the internal packages.
- Expose a stable root API for project config, plugin authoring, and programmatic pipelines.
- Provide explicit `opalesce/config` and `opalesce/orchestrator` subpaths.
- Make the facade own the installed `opalesce` bin while reusing CLI behavior.
- Verify runtime exports, declarations, executable delegation, and a one-dependency consumer config.

**Non-Goals:**

- Publishing any package or configuring Nx Release or semantic-release for the package graph.
- Making internal `@opalesce/*` packages public or removing their `private` protection.
- Adding bundled output plugins, schema processing, defaults, watch mode, init, or new CLI flags.
- Changing config validation, pipeline lifecycle, artifacts, errors, or filesystem semantics.
- Migrating or removing the exploratory root source tree.

## Decisions

### 1. Add `packages/opalesce` with npm identity `opalesce`

The facade is an ESM TypeScript Nx library at `packages/opalesce`, and its package and Nx project identity is `opalesce`. The directory matches the consumer-facing package name:

```text
consumer
  -> opalesce
       -> @opalesce/cli
       -> @opalesce/config
       -> @opalesce/orchestrator
            -> @opalesce/core
```

The facade SHALL contain no duplicated generation logic. Its runtime modules are explicit re-export boundaries, and its executable is a thin adapter to the CLI package.

An alternative named `@opalesce/facade` would preserve the scope convention but would not solve the consumer problem: projects would still learn an architectural layer name and the executable package would remain separate. Folding the facade into `@opalesce/cli` would couple programmatic APIs to a command-oriented package and would not provide the desired top-level product identity.

### 2. Rename the private root host to `@opalesce/workspace`

The root manifest becomes `@opalesce/workspace`, remains private, and remains outside Nx. This frees the `opalesce` identity for the product package without moving or publishing legacy root source.

The root development dependency changes from `@opalesce/cli` to `opalesce`. Its `generate` script builds the facade project before invoking the linked executable, so workspace development exercises the same dependency boundary as a future consumer.

Keeping duplicate `opalesce` identities was rejected because package manager and Nx project resolution would be ambiguous. Reusing the root itself as the facade was rejected because it would make the exploratory source tree and repository tooling part of the new package contract.

### 3. Use explicit root exports and two documented subpaths

The package export map contains:

```text
opalesce
opalesce/config
opalesce/orchestrator
```

The root exports:

- Project `defineConfig`, `OpalesceConfig`, and `OutputConfig` from `@opalesce/config`.
- Plugin authoring, service-token, pipeline execution, result, context, artifact, parser, and error contracts from `@opalesce/orchestrator`.
- The orchestration identity helper under the unambiguous name `definePipelineConfig`.

The name `defineConfig` always means the path-based project config consumed by `opalesce generate`. The existing orchestration helper is not removed or renamed in `@opalesce/orchestrator`; only the facade root aliases it to avoid exporting two different functions with the same name.

`opalesce/config` explicitly mirrors the complete `@opalesce/config` surface. `opalesce/orchestrator` explicitly mirrors the complete `@opalesce/orchestrator` surface, including its original `defineConfig` name. Explicit re-exports keep the facade contract reviewable and prevent future internal exports from leaking automatically.

### 4. Give `@opalesce/cli` a narrow programmatic command entry

`@opalesce/cli` gains a package root that exports `runCli` and the command IO types from its existing command module. The existing `@opalesce/cli` bin remains unchanged.

The facade owns its own stable bin shim and built bin entry. The built entry calls `runCli(process.argv.slice(2))` and assigns the returned code to `process.exitCode`. This preserves arguments, stdout, stderr, and exit-code behavior without spawning another Node.js process or importing an undeclared deep path.

Importing the existing CLI bin as a side effect was considered, but it would make the facade depend on the internal file layout rather than an explicit package boundary.

### 5. Keep publication protection in place

The facade and every internal package remain `private: true` with workspace protocol dependencies. This change validates install-like workspace consumption but does not claim the packages are available from npm.

Publication will require a separate decision about versions, dependency ranges, release ownership, provenance, and whether internal packages are independently public or bundled. Removing `private` here would create an incomplete and unsafe release contract.

### 6. Verify the facade at package and command boundaries

The facade follows the existing package pattern:

- Solution, library, check, and package-consumer TypeScript configurations.
- Nx `check` depending on build-backed package verification.
- Vitest runtime tests for export identity and the project config helper.
- Type-contract tests for root and subpath imports, including rejected project config shapes.
- A package consumer compiled against built declarations without source aliases.
- A verification script that checks the manifest, built entries, exact runtime exports, and executable help/error behavior.
- An end-to-end facade bin test that loads a TypeScript config importing only `opalesce`, executes an inline plugin, and writes its artifact.

Focused facade checks run first, followed by aggregate workspace checks and the root lint, format, and type checks.

## Risks / Trade-offs

- [The facade has no publishable dependencies while internal packages remain private] -> Keep the facade private and make publication an explicit follow-up spanning the complete dependency graph.
- [Root API growth can make the facade unstable] -> Export a deliberate symbol list, keep full low-level access on `opalesce/orchestrator`, and cover exact runtime and type contracts.
- [Two config helpers can confuse consumers] -> Reserve root `defineConfig` for project config, alias the in-memory helper to `definePipelineConfig`, and retain the original only on `opalesce/orchestrator`.
- [Two packages expose an `opalesce` bin inside the dependency graph] -> Consumers install the facade directly and the facade owns the documented command; the internal CLI bin remains available for workspace isolation and focused testing.
- [Renaming the root package affects transitional release tooling] -> The root remains private and publication is already deferred; rollback is a manifest-only name and dependency reversal.

## Migration Plan

1. Add the CLI programmatic root export without changing command behavior.
2. Add and validate the private `opalesce` facade package.
3. Rename the private root host and switch its direct development dependency and generate script to the facade.
4. Add the facade to root TypeScript references and refresh the pnpm lockfile.
5. Update consumer documentation to use `opalesce` while retaining internal package documentation for maintainers.
6. Run facade, workspace, formatting, lint, type, smoke, and strict OpenSpec validation.

Rollback removes `packages/opalesce`, restores the root name and direct CLI dependency, removes the facade reference and lockfile importer, and reverts the documentation. Internal config, CLI, orchestrator, and Core behavior remains intact throughout.

## Open Questions

None block implementation. Package publication, public version coupling, default plugins, and whether low-level subpaths remain documented long term are follow-up decisions.
