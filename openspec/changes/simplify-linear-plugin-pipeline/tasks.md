## 1. Core Plugin Contract

- [x] 1.1 Replace the phase-specific plugin contexts with one `PluginContext` exposing only document, diagnostics, and artifact emission, and require one `build` hook per plugin.
- [x] 1.2 Simplify `run` to snapshot and execute configured plugins exactly once in declared order while preserving parse-once, sequential await, artifact collection, and fail-fast behavior.
- [x] 1.3 Remove service tokens, the service registry, dependency ordering, graph-specific errors, execution phases, and their Core exports.
- [x] 1.4 Simplify `PluginExecutionError` to retain only the active plugin name and original cause.

## 2. Consumer Contract Propagation

- [x] 2.1 Update CLI config validation to require the linear `name` plus `build` plugin shape and stop recognizing `setup` and `dependsOn`.
- [x] 2.2 Update Core, config, CLI, facade, and smoke-fixture type and runtime consumers for the reduced public contract.

## 3. Regression Coverage

- [x] 3.1 Replace setup, dependency-graph, service-registry, and artifact-observation tests with declared-order, repeated-entry, exactly-once, sequential-await, parse-once, and fail-fast build tests.
- [x] 3.2 Update public type and export contract tests to prove removed APIs are unavailable and the single build context remains usable.
- [x] 3.3 Update CLI config tests to accept build-only plugins and reject plugins without a build hook.

## 4. Documentation

- [x] 4.1 Rewrite the Core lifecycle, plugin authoring, error, and public API documentation around the linear single-build model.
- [x] 4.2 Verify config, CLI, facade, and smoke documentation or examples contain no references to the removed lifecycle or dependency APIs.

## 5. Validation

- [x] 5.1 Run focused Core and CLI type checks and tests, then fix all failures.
- [x] 5.2 Run repository formatting and lint checks for changed files.
- [x] 5.3 Run the complete workspace check and generation smoke validation, and record any remaining risk.
