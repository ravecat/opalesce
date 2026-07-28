## 1. Package Foundation

- [x] 1.1 Add `packages/orchestrator` as an ESM Nx library with declaration output, a direct workspace dependency on `@opalesce/core`, and package-local check targets.
- [x] 1.2 Add package-consumer and runtime export verification for the built package boundary.

## 2. Public Contracts

- [x] 2.1 Define and export pipeline config, result, plugin lifecycle, context, service token, and text artifact types.
- [x] 2.2 Implement and export the config and plugin identity helpers plus typed service-token creation.
- [x] 2.3 Implement structured plugin configuration, plugin execution, service registry, and artifact errors.

## 3. Orchestration Runtime

- [x] 3.1 Implement pre-parse plugin validation and stable dependency ordering for duplicate, missing, self, and cyclic relationships.
- [x] 3.2 Implement the per-run typed service registry with identity-based lookup and duplicate or missing service failures.
- [x] 3.3 Implement canonical artifact validation, collision detection, ordered snapshots, and defensive result freezing.
- [x] 3.4 Implement `runPipeline` with one Core parse, ordered setup and build phases, fail-fast error wrapping, and an immutable result.

## 4. Focused Verification

- [x] 4.1 Add type-contract tests for inference, readonly public results, Core type reuse, and typed service exchange.
- [x] 4.2 Add runtime tests for empty pipelines, option forwarding, lifecycle ordering, dependency validation, service behavior, artifact behavior, failure semantics, and Core parse-error preservation.
- [x] 4.3 Run package typecheck, tests, build, package verification, and lint or formatting checks for all changed files.

## 5. Workspace Validation

- [x] 5.1 Refresh the pnpm workspace lockfile and verify Nx discovers only package projects with the correct dependency direction.
- [x] 5.2 Run the workspace aggregate build and check commands, then document any pre-existing regression outside the new package.

## Validation Notes

- `pnpm run build:workspace` and `pnpm run check:workspace` pass for Core and Orchestrator.
- Repository lint, formatting, root typecheck, and smoke tests pass.
- The legacy root unit suite retains a pre-existing failure in `test/runtime/api.test.ts`: it expects `packageJson.exports`, but the current root `package.json` has no `exports` field. This change does not modify that transitional root package contract.
