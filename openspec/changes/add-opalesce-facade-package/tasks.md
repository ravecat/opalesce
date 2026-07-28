## 1. CLI Package Boundary

- [ ] 1.1 Add an explicit `@opalesce/cli` ESM root export for `runCli` and its command IO types
- [ ] 1.2 Extend CLI package verification to cover the runtime and declaration entry points without changing existing bin behavior

## 2. Facade Package Foundation

- [ ] 2.1 Scaffold `packages/facade` with npm and Nx identity `opalesce`, private ESM metadata, TypeScript solution configs, Vitest, and package verification
- [ ] 2.2 Declare facade dependencies on `@opalesce/config`, `@opalesce/orchestrator`, and `@opalesce/cli`
- [ ] 2.3 Add the stable facade bin shim and built entry that delegates to the CLI command API

## 3. Facade Public API

- [ ] 3.1 Add explicit root exports for project config, plugin authoring, typed services, programmatic pipeline execution, and public result and error contracts
- [ ] 3.2 Export the orchestration config helper as `definePipelineConfig` from the facade root
- [ ] 3.3 Add explicit `opalesce/config` and `opalesce/orchestrator` subpath modules and manifest exports

## 4. Contract Verification

- [ ] 4.1 Add runtime tests for facade root and subpath export identity
- [ ] 4.2 Add type-contract tests for project config inference, plugin authoring, programmatic pipeline use, and rejected config shapes
- [ ] 4.3 Add a built declaration consumer covering all documented facade entry points
- [ ] 4.4 Add package verification for manifest identity, dependencies, export maps, runtime symbols, declaration outputs, and bin exit behavior
- [ ] 4.5 Add an end-to-end facade bin test using a TypeScript config that imports only `opalesce`

## 5. Workspace and Documentation Integration

- [ ] 5.1 Rename the private root host to `@opalesce/workspace`, switch its direct development dependency and generate script to the facade, and refresh workspace links
- [ ] 5.2 Add the facade to the root TypeScript reference graph while keeping the repository root outside Nx
- [ ] 5.3 Add facade quick-start and API documentation and update config, CLI, and orchestrator consumer examples to use `opalesce`

## 6. Validation

- [ ] 6.1 Run the focused CLI and facade checks, including build-backed package verification and executable integration
- [ ] 6.2 Run aggregate workspace build and checks plus root lint, format check, typecheck, and smoke tests
- [ ] 6.3 Validate the `add-opalesce-facade-package` OpenSpec change in strict mode and record any unrelated pre-existing root-test limitation
