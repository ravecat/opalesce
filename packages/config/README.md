# @opalesce/config

`@opalesce/config` defines the project-facing configuration consumed by `opalesce generate`. It provides TypeScript inference without loading files, running plugins, writing artifacts, or changing process state. Normal projects access this API through `opalesce` or `opalesce/config`.

## Project Config

Create one supported config file, normally `opalesce.config.ts`:

```ts
import { defineConfig, definePlugin } from "opalesce";

const metadata = definePlugin(() => ({
  name: "metadata",
  generate(context) {
    return [
      {
        path: "metadata/version.txt",
        contents: `${context.document.version()}\n`,
      },
    ];
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

Config-declared input and output paths resolve from the config file directory. The CLI resolves positional input and `--out` overrides from the invocation directory.

## Configuration

```ts
interface Config {
  readonly input: string;
  readonly output: {
    readonly path: string;
    readonly clean?: boolean;
  };
  readonly parser?: ParseAsyncAPIOptions;
  readonly plugins?: readonly OrchestrationPlugin[];
}
```

- `input` is one local AsyncAPI file path.
- `output.path` is the generated artifact directory.
- `output.clean` defaults to `false`. When enabled, the CLI accepts cleanup only for a safe directory below the config directory.
- `parser` is forwarded to the in-memory engine in `@opalesce/core`.
- `plugins` contains orchestration plugin instances.

`defineConfig` returns the same object and exists only to preserve concrete TypeScript inference.

## Boundaries

This package does not discover or import config files, read the AsyncAPI input, run the pipeline, write artifacts, or expose a command. Those responsibilities belong to `@opalesce/cli`.

Config modules are trusted project code and execute normal JavaScript when the CLI imports them.

The scoped package is an internal workspace boundary. Project consumers install the `opalesce` facade instead of declaring `@opalesce/config` directly.
