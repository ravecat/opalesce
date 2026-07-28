## 1. Core Engine

- [x] 1.1 Move parsing into a focused Core module, move orchestration under Core, and export the programmatic runner as `run`
- [x] 1.2 Move lifecycle, parser-forwarding, type-contract, and package-consumer coverage into Core and update package verification

## 2. Consumer Packages

- [x] 2.1 Redirect config and CLI imports, dependencies, and TypeScript references from orchestrator to Core
- [x] 2.2 Re-export Core `run` from the `opalesce` root and remove the `opalesce/orchestrator` subpath without changing bin use of CLI `run`

## 3. Workspace Cleanup

- [x] 3.1 Remove the orchestrator package and its Nx, TypeScript, and pnpm workspace metadata
- [x] 3.2 Update current Core, config, CLI, and facade documentation for the consolidated architecture and `run` API

## 4. Validation

- [x] 4.1 Run focused Core, config, CLI, and facade type checks, tests, builds, and package verification
- [x] 4.2 Run workspace formatting, linting, build, and check regression commands and confirm no current code or metadata references the removed API
