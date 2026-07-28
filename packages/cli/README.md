# @opalesce/cli

`@opalesce/cli` turns an `opalesce.config.*` file into one generation run. It discovers and validates project config, reads the AsyncAPI input, invokes `@opalesce/orchestrator`, persists successful artifacts, and maps failures to command output and exit codes.

## Quick Start

Normal projects install the `opalesce` facade and only the output plugins they use:

```json
{
  "devDependencies": {
    "opalesce": "workspace:*"
  },
  "scripts": {
    "generate": "opalesce generate"
  }
}
```

Create `opalesce.config.ts`:

```ts
import { defineConfig, definePlugin } from "opalesce";

const metadata = definePlugin(() => ({
  name: "metadata",
  build(context) {
    context.emit({
      path: "metadata/version.txt",
      contents: `${context.document.version()}\n`,
    });
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
    clean: true,
  },
  plugins: [metadata()],
});
```

Run generation:

```sh
opalesce generate
```

The config only describes the run. The command loads it and invokes the pipeline.

## Command

```text
opalesce generate [input] [options]

Arguments:
  input                 Override the input path from the config

Options:
  -c, --config <path>   Use an explicit Opalesce config file
  -o, --out <dir>       Override the output directory
  -h, --help            Show help
```

Examples:

```sh
opalesce generate
opalesce generate ./specs/events.yaml
opalesce generate --config ./configs/opalesce.staging.ts
opalesce generate --out ./src/generated
```

## Config Discovery

Without `--config`, the CLI searches the invocation directory and then its ancestors for:

1. `opalesce.config.ts`
2. `opalesce.config.mts`
3. `opalesce.config.cts`
4. `opalesce.config.js`
5. `opalesce.config.mjs`
6. `opalesce.config.cjs`

The nearest directory containing a candidate wins. Multiple candidates in that directory are rejected instead of silently selecting one.

An explicit `--config` path bypasses discovery and resolves from the invocation directory. Custom config names are accepted when they use one of the supported extensions.

Config files execute as trusted project code through Node.js 24 native JavaScript or erasable TypeScript loading.

## Path Resolution

- Paths declared by `input` and `output.path` resolve from the config file directory.
- Positional input and `--out` overrides resolve from the invocation directory.
- The CLI normalizes paths to absolute values before reading or writing.

## Output Behavior

The CLI waits for the complete in-memory pipeline to succeed before changing output.

When `output.clean` is omitted or `false`, emitted paths are overwritten but stale and unrelated files remain. When `output.clean` is `true`, the CLI removes the old output directory only when it is a safe strict descendant of the config directory. It rejects the filesystem root, config directory, invocation directory, ancestors of the invocation directory, and paths outside the config directory.

Artifacts are written as UTF-8 text. A persistence error can leave a partial artifact set; atomic replacement is not part of the current command.

## Diagnostics and Exit Codes

- Help and successful summaries use stdout.
- Parser diagnostics and failures use stderr.
- Exit code `0` means help or generation succeeded.
- Exit code `1` means config loading, input reading, pipeline execution, or persistence failed.
- Exit code `2` means command syntax or options were invalid.

Operational failures are rendered without automatic stack traces.

## Architecture

```text
opalesce
  -> @opalesce/cli
  -> @opalesce/config
  -> @opalesce/orchestrator
       -> @opalesce/core
```

Use `runPipeline` directly only when another program already owns input loading and artifact persistence.

`@opalesce/cli` is an internal package boundary. Consumers receive its executable through `opalesce`.

## Current Boundaries

The CLI does not currently provide watch mode, URL input, config functions or arrays, multiple configs, interactive initialization, validation-only commands, reporters, JSON output, formatting, linting, post-generation commands, or atomic output replacement.
