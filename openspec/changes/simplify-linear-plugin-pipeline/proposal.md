## Why

The current Core plugin contract adds dependency ordering, a two-phase lifecycle, and a typed service registry even though Opalesce plugins are intended to independently generate artifacts from the same parsed AsyncAPI document. Simplifying the contract now keeps configuration order authoritative and avoids stabilizing cross-plugin coupling before a concrete use case requires it.

## What Changes

- **BREAKING** Execute plugins strictly once and in the exact order declared in `config.plugins`.
- **BREAKING** Replace the `setup` and `build` lifecycle with a required `build` hook as the only plugin execution hook.
- **BREAKING** Remove `dependsOn`, dependency ordering, missing-dependency checks, and cycle detection.
- **BREAKING** Remove typed service tokens and the plugin `get` and `provide` dependency-injection API.
- **BREAKING** Limit the build context to the parsed AsyncAPI document, parser diagnostics, and artifact emission.
- Preserve parse-once behavior, sequential asynchronous execution, artifact validation and collection, error attribution to the active plugin, and filesystem ownership in the CLI.
- Update Core consumers, examples, tests, and package documentation to use the linear contract.
- Defer package publication, additional input adapters, and any future cross-plugin composition mechanism to explicit follow-up changes backed by concrete requirements.

## Capabilities

### New Capabilities

- `linear-plugin-pipeline`: Defines config-ordered, single-build plugin execution over one parsed AsyncAPI document without dependency injection or a plugin dependency graph.

### Modified Capabilities

None.

## Impact

- Changes the public plugin and context types exported by `@opalesce/core` and the `opalesce` facade.
- Removes Core service-registry and topological-ordering implementation modules and related errors.
- Updates plugin definitions in Core tests, CLI and facade integration tests, smoke fixtures, and documentation.
- Leaves `PipelineResult`, generated artifact persistence, config discovery, terminal behavior, and the package graph unchanged.
