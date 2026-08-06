# Plugin smoke fixture

This fixture is a runnable learning example for Opalesce plugin authors. It shows the complete path from typed plugin options to a generated artifact while keeping the plugin next to the consuming config.

It is not a golden-file test. Generated output stays local and is ignored by Git.

## Prerequisites

The workspace currently provides Node.js 24, pnpm, and Just through its Nix development shell.

From the repository root, allow automatic environment loading once:

```sh
direnv allow
```

Alternatively, enter it manually:

```sh
nix develop
```

Install workspace dependencies if they are not already present:

```sh
just setup
```

## Run the fixture

From the repository root:

```sh
just generate
```

The recipe rebuilds the local `opalesce` package, loads `opalesce.config.ts`, parses `asyncapi.yaml`, runs the imported `report.plugin.ts`, and writes:

```text
fixtures/smoke/generated/demo/report.json
```

Paths in the config are relative to `fixtures/smoke`, not to the shell's current directory. The configured `clean: true` removes stale files from `generated/demo` before the CLI persists the current artifacts.

## Read the example from top to bottom

1. `report.plugin.ts` contains the complete plugin implementation.
2. `AsyncAPIReportOptions` defines the plugin's user-facing options.
3. `definePlugin` preserves the factory's option types and returns configured plugin instances.
4. `name` gives the plugin a stable identity for results and errors.
5. `generate` receives the parsed document and parser diagnostics.
6. `generate` returns relative artifact paths and their final text contents without writing to the filesystem itself.
7. `opalesce.config.ts` imports the factory and instantiates the plugin with project options.

The small surface is intentional. A plugin owns its transformation and returned artifacts, while the CLI owns config loading, output cleanup, and filesystem writes.

## Turning the example into a reusable plugin

Keep a plugin beside its config while it serves one project. When it needs reuse or publication:

- Move the factory and its options into a dedicated module or package.
- Export the factory and its public option types from one documented entry point.
- Keep the plugin name stable and make output paths configurable.
- Add focused tests for returned artifacts, invalid input, and generation failures.
- Document installation, a minimal config example, generated files, and supported options.

This progression follows the same contributor-friendly shape used by Kubb: begin with a minimal typed plugin factory and config, then add package metadata, tests, and publishing concerns only when the plugin becomes reusable.

## Stack

| Area                                | Source                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| Development environment             | [`flake.nix`](../../flake.nix)                                        |
| Workspace dependencies and commands | [`package.json`](../../package.json) and [`justfile`](../../justfile) |

## Checks

Run the workspace checks after changing the plugin API or this fixture:

```sh
just check
```

## License

This fixture is covered by the repository's [MIT License](../../LICENSE).
