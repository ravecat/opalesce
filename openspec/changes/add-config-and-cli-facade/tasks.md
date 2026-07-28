## 1. Workspace package foundations

- [x] 1.1 Scaffold `@opalesce/config` with the existing ESM manifest, TypeScript solution, Nx project, Vitest, and package-verification conventions
- [x] 1.2 Scaffold `@opalesce/cli` with the existing package conventions and a built `opalesce` bin entry
- [x] 1.3 Link both projects through workspace dependencies, root TypeScript solution references, root CLI development dependency, generation script, and pnpm lockfile

## 2. Public project configuration

- [x] 2.1 Implement `OpalesceConfig`, output options, and the type-preserving side-effect-free `defineConfig` export
- [x] 2.2 Add config-package runtime, type-contract, package-consumer, and package-export verification
- [x] 2.3 Document the supported `opalesce.config.*` format, path bases, cleanup opt-in, and package boundary

## 3. Config discovery and command contract

- [x] 3.1 Implement upward config discovery, explicit `--config` resolution, supported candidate handling, and ambiguity errors
- [x] 3.2 Implement Node.js 24 ESM, CommonJS, and erasable TypeScript config loading with default-export and runtime-shape validation
- [x] 3.3 Implement root and `generate` argument parsing, help output, input and output overrides, and exit-code classification
- [x] 3.4 Cover config discovery, loading, validation, help, invalid syntax, and config-versus-command path bases with focused tests

## 4. Pipeline adaptation and artifact persistence

- [x] 4.1 Implement UTF-8 input loading and adaptation from `OpalesceConfig` to one `runPipeline` invocation
- [x] 4.2 Implement contained UTF-8 artifact writes, non-clean preservation, guarded clean behavior, and unsafe-target rejection
- [x] 4.3 Implement diagnostic, failure, and successful generation rendering across stdout and stderr
- [x] 4.4 Add focused tests proving input or pipeline failures leave output untouched and successful runs persist exact artifacts

## 5. Executable and workspace integration

- [x] 5.1 Add the thin shebang bin entry and verify it assigns the returned command exit code without importing source aliases
- [x] 5.2 Add a built-bin integration fixture covering TypeScript config loading, plugin execution, artifact output, diagnostics, and summary output
- [x] 5.3 Update orchestrator documentation to distinguish `runPipeline` programmatic usage from the `opalesce generate` project workflow
- [x] 5.4 Document CLI installation, config discovery, command usage, outputs, errors, cleanup behavior, and current boundaries

## 6. Validation

- [x] 6.1 Run config and CLI format, lint, typecheck, unit tests, build, package verification, and built-bin integration checks
- [x] 6.2 Run orchestrator regression checks and aggregate workspace build and check targets
- [x] 6.3 Run root format, lint, typecheck, relevant legacy tests, strict OpenSpec validation, and diff checks, documenting any unrelated pre-existing failure

## Validation Notes

- Root lint, format check, typecheck, smoke tests, strict OpenSpec validation, and diff checks pass.
- Root unit tests pass 17 of 18 tests. The remaining pre-existing `test/runtime/api.test.ts` failure expects the removed root `package.json.exports` map and is unrelated to the package-first config and CLI change.
