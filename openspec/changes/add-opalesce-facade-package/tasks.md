## 1. CLI Package Boundary

- [x] 1.1 Add an explicit `@opalesce/cli` ESM root export for `run` and its command IO types
- [x] 1.2 Extend CLI package verification to cover the runtime and declaration entry points without changing existing bin behavior

## 2. Facade Package Foundation

- [x] 2.1 Scaffold `packages/opalesce` with npm and Nx identity `opalesce`, private ESM metadata, TypeScript solution configs, Vitest, and package verification
- [x] 2.2 Declare facade dependencies on `@opalesce/config`, `@opalesce/orchestrator`, and `@opalesce/cli`
- [x] 2.3 Add the stable facade bin shim and built entry that delegates to the CLI command API

## 3. Facade Public API

- [x] 3.1 Add explicit root exports for project config, plugin authoring, typed services, programmatic pipeline execution, and public result and error contracts
- [x] 3.2 Export the orchestration config helper as `definePipelineConfig` from the facade root
- [x] 3.3 Add explicit `opalesce/config` and `opalesce/orchestrator` subpath modules and manifest exports

## 4. Contract Verification

- [x] 4.1 Add runtime tests for facade root and subpath export identity
- [x] 4.2 Add type-contract tests for project config inference, plugin authoring, programmatic pipeline use, and rejected config shapes
- [x] 4.3 Add a built declaration consumer covering all documented facade entry points
- [x] 4.4 Add package verification for manifest identity, dependencies, export maps, runtime symbols, declaration outputs, and bin exit behavior
- [x] 4.5 Add an end-to-end facade bin test using a TypeScript config that imports only `opalesce`

## 5. Workspace and Documentation Integration

- [x] 5.1 Rename the private root host to `@opalesce/workspace`, switch its direct development dependency and generate script to the facade, and refresh workspace links
- [x] 5.2 Add the facade to the root TypeScript reference graph while keeping the repository root outside Nx
- [x] 5.3 Add facade quick-start and API documentation and update config, CLI, and orchestrator consumer examples to use `opalesce`

## 6. Validation

- [x] 6.1 Run the focused CLI and facade checks, including build-backed package verification and executable integration
- [x] 6.2 Run aggregate workspace build and checks plus root lint, format check, typecheck, and smoke tests
- [x] 6.3 Validate the `add-opalesce-facade-package` OpenSpec change in strict mode and record any unrelated pre-existing root-test limitation

Validation notes:

- Facade and aggregate package builds, package verifiers, type checks, 80 package tests, root lint, format check, root typecheck, and 6 smoke tests pass.
- Root unit tests pass 17 of 18 tests. The remaining pre-existing `test/runtime/api.test.ts` failure expects the removed exploratory root `package.json.exports` map; the private workspace host remains outside the facade package contract.
