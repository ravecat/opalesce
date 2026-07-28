## ADDED Requirements

### Requirement: Opalesce executable package

The workspace SHALL provide a private ESM package at `packages/cli` with package and Nx project identity `@opalesce/cli`. Its package manifest SHALL expose an `opalesce` bin shim with a Node.js shebang that loads the built CLI entry. The package SHALL depend on `@opalesce/config` and `@opalesce/orchestrator`, while Core and the orchestrator MUST NOT depend on the CLI.

#### Scenario: Invoke the installed executable

- **WHEN** a workspace or package consumer invokes the installed `opalesce` bin
- **THEN** the stable JavaScript shim loads the built CLI entry without a source path alias or TypeScript runtime compiler

#### Scenario: Keep engine independent

- **WHEN** the workspace project graph is inspected
- **THEN** dependency edges point from the CLI toward config and orchestration packages and never from orchestration or Core toward the CLI

### Requirement: Explicit generate command

The executable SHALL support `opalesce generate [input]`, `--config <path>`, `--out <directory>`, and help for the root executable and generate command. Successful help and generation MUST exit with code `0`, operational generation failures MUST exit with code `1`, and invalid command syntax or unsupported options MUST exit with code `2`.

#### Scenario: Request root help

- **WHEN** a user invokes `opalesce --help`
- **THEN** the command prints usage including `generate` to stdout and exits with code `0`

#### Scenario: Request generate help

- **WHEN** a user invokes `opalesce generate --help`
- **THEN** the command prints generate arguments and options to stdout and exits with code `0`

#### Scenario: Invoke an unknown command

- **WHEN** a user invokes a command other than `generate`
- **THEN** the CLI prints a concise usage error to stderr and exits with code `2`

#### Scenario: Override input and output

- **WHEN** a user invokes `opalesce generate <input> --out <directory>`
- **THEN** the positional input and output option override their config values for that run

### Requirement: Deterministic config discovery

Without `--config`, the CLI SHALL search from the process working directory through its ancestors for exactly one supported config candidate named `opalesce.config.ts`, `opalesce.config.mts`, `opalesce.config.cts`, `opalesce.config.js`, `opalesce.config.mjs`, or `opalesce.config.cjs`. The nearest directory with a candidate SHALL win. More than one candidate in that directory MUST be rejected as ambiguous. An explicit `--config` path SHALL bypass discovery and resolve relative to the process working directory.

#### Scenario: Discover config in current directory

- **WHEN** the working directory contains exactly one supported config candidate and `--config` is omitted
- **THEN** the CLI loads that candidate

#### Scenario: Discover config from nested directory

- **WHEN** no candidate exists in the working directory but an ancestor contains exactly one
- **THEN** the CLI loads the nearest ancestor candidate

#### Scenario: Prefer nearer config

- **WHEN** both a working-directory ancestor and a higher ancestor contain config candidates
- **THEN** the CLI stops at and loads the nearer directory

#### Scenario: Reject ambiguous config

- **WHEN** the selected directory contains more than one supported candidate
- **THEN** generation fails before importing any candidate and identifies the ambiguity

#### Scenario: Resolve explicit config

- **WHEN** a user passes `--config ./configs/opalesce.config.ts`
- **THEN** the CLI resolves that path from the process working directory and does not perform automatic discovery

#### Scenario: Report missing config

- **WHEN** discovery reaches the filesystem root without a candidate
- **THEN** generation fails with a concise config-not-found message and exit code `1`

### Requirement: Trusted config loading and validation

The CLI SHALL import the selected config using the workspace Node.js 24 runtime, normalize supported ESM and CommonJS default exports, require one default-exported object, and validate the public config shape before reading input or invoking plugins. Config modules SHALL be treated as trusted project code and SHALL NOT be sandboxed.

#### Scenario: Load TypeScript config

- **WHEN** a supported TypeScript config default-exports a valid `defineConfig` result using Node.js erasable TypeScript syntax
- **THEN** the CLI loads the object without a third-party TypeScript config compiler

#### Scenario: Load JavaScript config

- **WHEN** a supported ESM or CommonJS JavaScript config default-exports a valid config object
- **THEN** the CLI normalizes and validates that object

#### Scenario: Reject missing default export

- **WHEN** a config module does not default-export a config object
- **THEN** generation fails before input reading or pipeline execution and identifies the invalid export

#### Scenario: Reject invalid config shape

- **WHEN** a config has an empty input, an empty output path, a non-boolean `clean`, or a non-array plugin collection
- **THEN** generation fails before input reading or pipeline execution and identifies the invalid field

### Requirement: Explicit path resolution

Config-declared input and output paths SHALL resolve relative to the selected config file directory. A positional input or `--out` path SHALL resolve relative to the process working directory. The CLI SHALL convert resolved paths to absolute values before reading input or persisting output.

#### Scenario: Run discovered config from nested directory

- **WHEN** a config in an ancestor declares relative input and output paths
- **THEN** both paths resolve from the config directory regardless of the invocation directory

#### Scenario: Resolve command-line overrides

- **WHEN** a nested-directory invocation supplies relative input or output overrides
- **THEN** the overridden paths resolve from the invocation working directory

### Requirement: Single pipeline adaptation

For one generate invocation, the CLI SHALL read the resolved input file as UTF-8 text and call `runPipeline` exactly once with that text, the configured parser options, and the configured plugins. The CLI MUST NOT create, clean, or modify the output directory before the pipeline succeeds.

#### Scenario: Generate through orchestrator

- **WHEN** the input and config are valid
- **THEN** the CLI forwards in-memory input and pipeline options to the orchestrator and receives its diagnostics and artifacts

#### Scenario: Input read fails

- **WHEN** the resolved input cannot be read
- **THEN** generation exits with code `1`, reports the input failure, and leaves output untouched

#### Scenario: Pipeline fails

- **WHEN** Core parsing or a plugin hook fails
- **THEN** generation exits with code `1`, reports the failure, and leaves output untouched

### Requirement: Guarded artifact persistence

After a successful pipeline, the CLI SHALL write every returned text artifact as UTF-8 beneath the resolved output directory and create required parent directories. It MUST defensively reject any artifact whose resolved destination escapes the output directory. With omitted or false `clean`, it SHALL overwrite emitted paths without deleting unrelated or stale files. With `clean: true`, it SHALL replace the output directory only when that directory is a strict descendant of the config directory and is not the process working directory, config directory, or filesystem root.

#### Scenario: Persist successful artifacts

- **WHEN** a successful pipeline returns valid nested artifact paths
- **THEN** the CLI creates their parent directories and writes their exact contents beneath the output directory

#### Scenario: Preserve unrelated output

- **WHEN** `clean` is omitted or false and the output directory already contains a file not emitted by the pipeline
- **THEN** generation leaves that unrelated file unchanged

#### Scenario: Clean dedicated output

- **WHEN** `clean` is true and the output is a strict descendant of the config directory
- **THEN** the CLI removes the previous output directory before writing the successful artifact set

#### Scenario: Reject unsafe cleanup

- **WHEN** `clean` is true and output resolves to the config directory, process working directory, filesystem root, or a path outside the config directory
- **THEN** generation fails before deleting output and identifies the unsafe cleanup target

#### Scenario: Reject escaping artifact

- **WHEN** a returned artifact would resolve outside the output directory
- **THEN** persistence fails without writing that artifact outside the output boundary

### Requirement: Observable command output

The CLI SHALL print help and a concise successful file-count and output-path summary to stdout. It SHALL print parser diagnostics, configuration errors, input errors, pipeline errors, and persistence errors to stderr. Expected operational failures MUST be rendered without an automatic stack trace.

#### Scenario: Report successful generation

- **WHEN** generation persists all returned artifacts
- **THEN** stdout identifies the generated artifact count and resolved output directory and the process exits with code `0`

#### Scenario: Report parser diagnostics

- **WHEN** a successful pipeline returns non-fatal parser diagnostics
- **THEN** the CLI renders each diagnostic to stderr before the success summary

#### Scenario: Report operational failure

- **WHEN** config loading, input reading, pipeline execution, or persistence fails
- **THEN** stderr receives a concise error message without an automatic stack trace and the process exits with code `1`

### Requirement: Workspace and package verification

The private root workspace SHALL link the CLI bin and expose a repository command that invokes `opalesce generate`. Both new packages SHALL participate in aggregate workspace builds and checks. Verification SHALL cover public type contracts, built ESM package consumption, built-bin help, and an isolated end-to-end generation fixture.

#### Scenario: Run workspace command

- **WHEN** a developer runs the repository generation script
- **THEN** the linked workspace `opalesce` bin executes the generate command

#### Scenario: Check workspace

- **WHEN** aggregate workspace validation runs
- **THEN** config and CLI type checks, tests, builds, package verification, and bin integration coverage participate through Nx
