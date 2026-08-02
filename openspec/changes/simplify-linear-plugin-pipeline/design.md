## Context

`@opalesce/core` currently parses one AsyncAPI document, topologically sorts configured plugins by string names, creates a per-run service registry, executes every `setup` hook, executes every `build` hook, and returns emitted artifacts. This architecture permits plugins to exchange arbitrary typed values and consume earlier artifacts, but it makes plugin names dependency identifiers and allows execution order to differ from the user's config.

The intended package model is smaller: each plugin independently receives the same parsed AsyncAPI document, derives any plugin-specific model internally, and emits its own artifacts. The config array is the complete execution plan. Core remains filesystem-free, while `@opalesce/cli` owns config loading and artifact persistence. No package currently provides a concrete cross-plugin service that requires the existing dependency-injection boundary.

## Goals / Non-Goals

**Goals:**

- Make `config.plugins` the sole source of plugin execution order.
- Give every configured plugin exactly one required `build` invocation.
- Keep one parsed AsyncAPI document and its diagnostics available to every build.
- Keep plugin builds sequential and await asynchronous builds before starting the next plugin.
- Preserve artifact validation, ordered collection, fail-fast behavior, and plugin failure attribution.
- Remove all public and internal dependency-injection and dependency-graph contracts.
- Update every workspace consumer and current documentation in the same change.

**Non-Goals:**

- Introduce a shared normalized schema model before a concrete generator requires one.
- Support plugin-to-plugin service discovery, automatic dependency installation, artifact post-processing, or parallel plugin execution.
- Move input loading, output persistence, terminal behavior, or config discovery into Core.
- Add new generator plugins, input adapters, package publication behavior, or release compatibility aliases.
- Rewrite historical OpenSpec changes that record the superseded architecture.

## Decisions

### The config array is the execution plan

`run` takes a defensive shallow copy of `config.plugins` and iterates it directly. It does not sort, deduplicate, or infer relationships. Repeating a plugin or using the same diagnostic name more than once executes every configured entry in its declared position and preserves those names in `PipelineResult.pluginNames`.

Topological ordering was rejected because it makes source order an unreliable explanation of runtime behavior and turns plugin names into dependency API identifiers. A separate priority field was rejected for the same reason.

### A plugin has one required build hook

`OrchestrationPlugin` retains its diagnostic `name` and exposes only a required `build(context)` hook. Core invokes it once per configured entry. `PluginContext` contains `document`, `diagnostics`, and `emit`; the phase-specific `PluginSetupContext`, `PluginBuildContext`, and `PluginExecutionPhase` contracts are removed.

Retaining optional lifecycle hooks was rejected because it permits setup-only plugins and recreates an implicit dependency system. Renaming the public plugin type is deferred because it is unrelated to the lifecycle simplification.

### Plugins do not exchange runtime state through Core

Core removes `createServiceToken`, `ServiceToken`, `ServiceRegistry`, `get`, and `provide`. The build context also stops exposing accumulated artifacts. A plugin derives its own model from `context.document` and owns all related outputs.

If a universal normalized model becomes necessary, it belongs in Core and should be added to the context through a separate specification. If several plugins need common implementation logic, they can import a normal library without creating runtime ordering. Artifact post-processing can be reconsidered only with a concrete requirement.

### Core preserves sequential asynchronous and fail-fast semantics

Core awaits each `build` before starting the next configured plugin. Emitted artifacts remain in one per-run `ArtifactStore`, so result ordering follows emission order and collisions still fail. A failed build is wrapped in `PluginExecutionError` with `pluginName` and `cause`, then execution stops. The redundant `phase` field is removed because `build` is the only phase.

Parallel execution was rejected because it would make artifact order and failure selection nondeterministic. Continuing after a failed plugin was rejected because the pipeline could return incomplete output that the CLI might persist.

### Graph-specific public errors and implementation modules are removed

`PluginConfigurationError`, `ServiceRegistryError`, their code types, `orderPlugins.ts`, and `services.ts` are removed. `ArtifactError`, `PluginExecutionError`, parser errors, and artifact path rules remain. The CLI config validator requires every plugin to provide a string `name` and a function `build`, and no longer recognizes `setup` or `dependsOn` as lifecycle fields.

Compatibility aliases were rejected because the packages remain at an unpublished `0.0.0` contract and aliases would preserve the conceptual surface this change is intended to remove.

## Risks / Trade-offs

- [A future generator needs an expensive shared model] -> First establish whether the model is universal; add it to Core or extract a normal shared library through a dedicated change.
- [A plugin wants to consume another plugin's artifacts] -> Keep outputs owned by one plugin or configure an explicit standalone post-processing step outside this contract until a concrete case justifies artifact access.
- [Duplicate plugin names make failure output ambiguous] -> Treat names as diagnostic labels only and allow plugin factories to include option-specific labels when needed; preserve config position through deterministic order.
- [Removing runtime fields breaks existing plugin examples] -> Update every workspace fixture, test, and README in the same change; no published compatibility promise currently exists.
- [Config mutation during an asynchronous run changes behavior] -> Snapshot the configured plugin array before parsing and execution.

## Migration Plan

1. Replace the Core plugin and context types with the single-build contract.
2. Simplify `run` to snapshot and execute the config list sequentially.
3. Remove service-registry, dependency-ordering, graph-specific errors, and their exports.
4. Update CLI runtime config validation and all package type contracts.
5. Replace graph, service, setup, and artifact-observation tests with config-order, exactly-once, duplicate-entry, sequential-await, and fail-fast coverage.
6. Update Core and consumer documentation and run focused then workspace-wide validation.

Rollback restores the removed modules and public exports, reinstates the two-phase runner, and restores the previous tests and documentation from version control. No persisted data or generated-file migration is required.

## Open Questions

None. Cross-plugin composition will require a new concrete use case and specification rather than a speculative extension of this pipeline.
