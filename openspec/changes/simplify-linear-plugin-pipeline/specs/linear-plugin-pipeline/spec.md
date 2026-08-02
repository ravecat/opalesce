## ADDED Requirements

### Requirement: Configuration order defines plugin execution

Core SHALL execute every configured plugin exactly once and in the same order in which the entries appear in `config.plugins`. Core MUST NOT reorder, deduplicate, or infer dependencies between configured entries.

#### Scenario: Execute plugins in declared order

- **WHEN** a caller configures plugins in the order `second`, `first`, `second`
- **THEN** Core invokes their builds in the order `second`, `first`, `second`
- **AND** the result reports plugin names in that same order

#### Scenario: Run an empty plugin list

- **WHEN** a caller omits `plugins` or configures an empty plugin list
- **THEN** Core parses the input and returns an empty artifact list and an empty plugin-name list

### Requirement: Plugins expose one build hook

The public plugin contract SHALL require a diagnostic name and exactly one lifecycle hook named `build`. Core MUST NOT expose plugin `setup`, `dependsOn`, execution-phase, service-token, service-registry, `get`, or `provide` contracts.

#### Scenario: Author a plugin against the public contract

- **WHEN** a TypeScript consumer defines a plugin with `name` and `build`
- **THEN** the plugin compiles through `definePlugin` and can be included in a pipeline config

#### Scenario: Inspect the build context

- **WHEN** a plugin build receives its context
- **THEN** the context exposes the parsed AsyncAPI document, parser diagnostics, and artifact emission
- **AND** the context does not expose accumulated artifacts or cross-plugin service access

### Requirement: Core shares one parsed document with independent builds

Core SHALL parse pipeline input exactly once and provide the resulting AsyncAPI document and diagnostics to every plugin build. Each plugin SHALL be able to derive its own internal model without modifying pipeline configuration or depending on another plugin.

#### Scenario: Multiple plugins inspect the same parsed input

- **WHEN** two plugins build from one valid AsyncAPI input
- **THEN** both builds receive the parsed document produced by the single parser invocation
- **AND** both receive the retained parser diagnostics

#### Scenario: Parsing fails before builds

- **WHEN** Core cannot produce a valid AsyncAPI document
- **THEN** Core returns the parse failure unchanged
- **AND** no plugin build runs

### Requirement: Asynchronous builds are sequential

Core SHALL await each plugin build before invoking the next configured plugin.

#### Scenario: A build completes asynchronously

- **WHEN** the first plugin returns an unresolved promise
- **THEN** Core does not invoke the second plugin until that promise resolves

### Requirement: Artifacts remain an ordered pipeline result

Each plugin build SHALL be able to emit text artifacts. Core SHALL validate and collect emitted artifacts in emission order and SHALL return frozen artifact snapshots without writing files.

#### Scenario: Several plugins emit artifacts

- **WHEN** configured plugins emit distinct valid artifact paths
- **THEN** `PipelineResult.artifacts` contains defensive frozen copies in emission order
- **AND** the CLI can persist the returned artifacts after Core succeeds

#### Scenario: Plugins emit the same artifact path

- **WHEN** a later plugin emits a path already emitted in the current run
- **THEN** Core fails that plugin with an artifact path-collision cause
- **AND** Core returns no successful partial pipeline result

### Requirement: Build failures are attributed and fail fast

Core SHALL wrap a plugin build failure with the active plugin name and original cause. Core MUST stop before invoking any later plugin and MUST NOT report a separate execution phase.

#### Scenario: A plugin build throws

- **WHEN** a configured plugin throws or rejects during `build`
- **THEN** Core rejects with `PluginExecutionError` containing the plugin name and original cause
- **AND** no later plugin build runs
