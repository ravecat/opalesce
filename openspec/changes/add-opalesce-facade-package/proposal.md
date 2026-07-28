## Why

The package-first runtime currently requires consumers to install and import several internal `@opalesce/*` packages for one generation workflow. A single `opalesce` facade is needed so projects have one stable dependency, config import, and executable while internal package boundaries can evolve independently.

## What Changes

- Add a private ESM workspace package whose npm identity is `opalesce`.
- Expose project configuration from both `opalesce` and `opalesce/config`.
- Expose plugin authoring and programmatic pipeline APIs from `opalesce`, with the complete low-level orchestration contract available from `opalesce/orchestrator`.
- Expose the `opalesce` bin through the facade and delegate command execution to `@opalesce/cli`.
- Make the private repository root an explicitly named workspace host and exercise the facade as the root development dependency.
- Update consumer documentation to install and import `opalesce` instead of depending directly on config, CLI, and orchestrator packages.
- Keep concrete output plugins as separately installed packages.
- Defer npm publication, release automation, bundled output plugins, legacy root-source migration, and changes to config or pipeline behavior.

## Capabilities

### New Capabilities

- `consumer-package-facade`: Defines the installable `opalesce` package, its root and subpath exports, executable delegation, dependency boundaries, and consumer workflow.

### Modified Capabilities

None.

## Impact

- Adds `packages/opalesce` as an Nx package project with npm identity `opalesce`.
- Adds workspace dependencies from the facade to `@opalesce/config`, `@opalesce/orchestrator`, and `@opalesce/cli`.
- Renames the private root package from `opalesce` to `@opalesce/workspace` to avoid duplicate workspace package identities.
- Switches root command linking from direct `@opalesce/cli` usage to the facade package.
- Adds root TypeScript references, lockfile entries, package verification, consumer type tests, runtime tests, and facade documentation.
- Preserves the existing internal package APIs and keeps every package protected from publication.
