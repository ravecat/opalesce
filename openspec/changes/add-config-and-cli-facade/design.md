## Context

`@opalesce/core` owns in-memory AsyncAPI parsing and `@opalesce/orchestrator` owns the filesystem-free plugin lifecycle, typed services, and artifact collection. The missing boundary is a project-facing facade that can load a declarative config, adapt filesystem input to the in-memory pipeline, persist successful artifacts, and expose the workflow through an `opalesce` executable.

The exploratory root source tree contains similar concerns, but it uses transitional config, runtime, artifact, and command contracts. It remains migration input rather than the implementation base for the package-first API.

The workspace currently standardizes on Node.js 24, TypeScript 6, pnpm 10, ESM packages, Nx package projects, Vitest, ESLint, and oxfmt.

## Goals / Non-Goals

**Goals:**

- Make `opalesce generate` the normal project workflow.
- Define one type-safe, path-based `opalesce.config.*` contract.
- Keep configuration authoring independent from command parsing and filesystem execution.
- Adapt a loaded user config to the existing in-memory `PipelineConfig` without moving filesystem behavior into the orchestrator.
- Persist artifacts only after a successful pipeline and apply explicit safety rules before destructive output cleanup.
- Give command failures deterministic messages and exit codes.
- Validate both packages as ESM workspace consumers and validate the built bin end to end.

**Non-Goals:**

- Change Core parsing, plugin lifecycle, service, or artifact contracts.
- Remove the programmatic `runPipeline` API.
- Add watch mode, URL input, multiple configs, config functions, interactive setup, validation-only commands, reporters, JSON output, formatting, linting, or post-generation commands.
- Add an output-storage package before another caller needs that abstraction.
- Migrate or delete the exploratory root runtime.
- Publish the packages or configure release behavior.

## Decisions

### 1. Retain the orchestrator as the execution engine

The dependency direction is:

```text
@opalesce/cli ------> @opalesce/config
       |                      |
       +----------------------+
       |                      v
       +------------> @opalesce/orchestrator -> @opalesce/core
```

`@opalesce/orchestrator` remains responsible for plugin validation, dependency ordering, parsing through Core, lifecycle execution, typed services, and in-memory artifacts. `@opalesce/cli` owns process and filesystem adaptation. `@opalesce/config` owns only the public config shape and authoring helper.

This is preferred over folding orchestration into the CLI because plugin packages and programmatic consumers need a stable engine that has no command, filesystem, stdout, or exit-code dependencies. It is preferred over folding user config into the orchestrator because path resolution and output settings do not belong in an in-memory pipeline contract.

### 2. Use a small path-based public config contract

`@opalesce/config` exports:

```ts
export interface OpalesceConfig {
  readonly input: string;
  readonly output: {
    readonly path: string;
    readonly clean?: boolean;
  };
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}

export declare function defineConfig<const TConfig extends OpalesceConfig>(
  config: TConfig,
): TConfig;
```

The first version accepts one config object with one local input path and one output directory. `defineConfig` is a side-effect-free identity helper that preserves concrete plugin and option types. The package imports orchestration and Core contracts only through the orchestrator public surface.

The config is intentionally distinct from `PipelineConfig`: its `input` is a path, and its `output` has no meaning inside the pipeline. Keeping both types prevents the orchestrator from guessing whether a string is content or a path.

`clean` defaults to `false`. A config must opt into destructive output replacement.

This is preferred over a union of paths, URLs, inline content, objects, functions, promises, and arrays because those modes create resolution and execution semantics that are not required for the first usable CLI. They can be added backward-compatibly after concrete use.

### 3. Load one default-exported config with Node.js 24

The CLI supports these candidate names in an explicit order:

```text
opalesce.config.ts
opalesce.config.mts
opalesce.config.cts
opalesce.config.js
opalesce.config.mjs
opalesce.config.cjs
```

Without `--config`, discovery walks from the process working directory toward the filesystem root. The first directory containing one candidate wins. More than one candidate in that directory is an ambiguity error rather than an extension-priority choice. `--config` bypasses discovery and resolves relative to the process working directory.

The loader uses Node.js 24 native module and erasable TypeScript support, normalizes ESM and CommonJS default exports, requires a default-exported object, and validates the public runtime shape before reading input or running plugins. No third-party config transpiler is added.

Config-declared `input` and `output.path` resolve relative to the config file directory. Positional input and `--out` overrides resolve relative to the process working directory because they are command-line paths. The resolved execution state uses absolute paths so later stages cannot reinterpret their base.

This is preferred over resolving every path from the invocation directory because a config must keep working when invoked from a nested workspace directory or through `--config`. It is preferred over silently choosing one of several config files because ambiguity should fail close to its source.

### 4. Make `generate` an explicit command

The first command surface is:

```text
opalesce generate [input] [--config <path>] [--out <directory>]
opalesce --help
opalesce generate --help
```

Bare `opalesce` prints command help and exits successfully only when used with `--help`; otherwise a missing or unknown command is a usage error. A default-command alias can be added later without changing `opalesce generate`.

The command implementation separates argument parsing from the executable side effect. A testable command function receives arguments, working directory, stdout, and stderr and returns an exit code. The bin is a thin shebang entry that calls it and assigns `process.exitCode`.

Exit codes are:

- `0` for successful generation and help.
- `1` for config discovery or loading, input reading, pipeline, or output persistence failures.
- `2` for invalid command syntax or unsupported options.

On success, stdout receives a concise generated-file summary. Diagnostics and failures use stderr. The CLI does not expose stack traces unless a future debug mode defines that behavior.

### 5. Adapt filesystem state around one `runPipeline` call

The generate flow is:

1. Parse command arguments.
2. Discover and import the config.
3. Validate its runtime shape.
4. Resolve input and output paths.
5. Read the input as UTF-8 text.
6. Call `runPipeline` once with the text, parser options, and plugins.
7. Print returned diagnostics.
8. Persist returned artifacts.
9. Print the success summary.

No output directory is created, cleaned, or modified until the pipeline succeeds. Core and plugin errors retain their existing types inside the command boundary; the CLI renders a concise message and converts the failure to exit code `1`.

This is preferred over making the config execute the pipeline during import because config loading must remain side-effect free. It is also preferred over placing file reads and writes in the orchestrator because that would break its programmatic in-memory contract.

### 6. Keep persistence internal and defensively validate paths

The CLI writer joins each orchestrator artifact path beneath the resolved output directory, creates required parent directories, and writes UTF-8 contents. It defensively verifies containment even though the orchestrator already validates artifact paths.

With `clean: false`, the writer creates the output directory if needed and overwrites only emitted paths. It does not remove stale or unrelated files. With `clean: true`, the output directory is removed before writing, but only when it is a strict descendant of the config directory and is not the process working directory, config directory, or filesystem root.

Persistence failures may leave partially written files. Atomic directory replacement and a generated-file manifest are deferred until real usage demonstrates the need. The command does guarantee that parse and plugin failures leave the output untouched.

Keeping persistence internal to the CLI is preferred over adding `@opalesce/storage` now because there is only one caller. The module boundary remains focused enough to extract later without changing config or orchestrator APIs.

### 7. Follow existing package and verification conventions

Both packages use the same ESM manifest, solution TypeScript configs, Nx targets, type-contract tests, package-consumer tests, build verification, Vitest configuration, and aggregate workspace checks as Core and the orchestrator.

`@opalesce/cli` declares:

```json
{
  "bin": {
    "opalesce": "./bin/opalesce.js"
  }
}
```

The stable JavaScript bin shim imports `dist/bin.js`. This allows pnpm to create the workspace command link before build output exists while ensuring command execution still uses the built TypeScript entry. The private root package links the CLI as a workspace development dependency and exposes a convenience `generate` script that builds the CLI before invoking `opalesce generate`, while the root remains outside the Nx graph. A built-bin integration test runs the command against an isolated fixture containing a config, AsyncAPI input, and emitting plugin.

## Risks / Trade-offs

- [Node-native TypeScript config support is tied to the Node.js 24 runtime baseline] -> Declare and test the baseline; add a config transpiler only if broader Node support becomes a release requirement.
- [Two packages export helpers named `defineConfig`] -> Documentation always imports project config from `@opalesce/config` and labels the orchestrator helper as an in-memory programmatic helper.
- [`clean: false` can retain stale generated files] -> Document the behavior and let projects opt into guarded `clean: true`; consider a manifest-based cleanup mode later.
- [`clean: true` is destructive] -> Require explicit opt-in, enforce strict descendant safety, and do not touch output until the pipeline succeeds.
- [A config module executes normal JavaScript during import] -> Treat configs as trusted project code and do not claim sandboxing.
- [Persistence can fail after some files are written] -> Report failure clearly; defer atomic replacement until required and keep pipeline failures non-mutating.
- [The root exploratory CLI temporarily duplicates behavior] -> Do not route new packages through it; remove it in a separate migration after the package path is proven.

## Migration Plan

1. Add and validate `@opalesce/config` without changing orchestration behavior.
2. Add `@opalesce/cli`, config discovery/loading, path adaptation, generation, persistence, and the bin.
3. Link the bin into the private workspace and validate a built end-to-end generation fixture.
4. Update package documentation so CLI-driven and programmatic workflows are distinct.
5. Defer root runtime removal until the new CLI has concrete schema and output plugins to replace its generated output.

Rollback removes the two new packages, their workspace references and lockfile entries, and the documentation changes. Core, the orchestrator, and the exploratory root runtime remain independently usable.

## Open Questions

None block implementation. Watch mode, config functions or arrays, URL input, manifest-based cleanup, atomic output replacement, and a public facade package remain explicit follow-up decisions.
