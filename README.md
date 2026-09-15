# Opalesce

Generate TypeScript contracts and JSON Schema files from [AsyncAPI](https://www.asyncapi.com/docs) documents through a configurable plugin pipeline.

[![Checks](https://github.com/ravecat/opalesce/actions/workflows/check.yml/badge.svg?branch=master)](https://github.com/ravecat/opalesce/actions/workflows/check.yml)
[![npm version](https://img.shields.io/npm/v/opalesce)](https://www.npmjs.com/package/opalesce)
[![npm downloads](https://img.shields.io/npm/dm/opalesce)](https://www.npmjs.com/package/opalesce)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Getting started](#getting-started) · [Interface](#interface) · [Plugins](#plugins) · [Development](#development) · [Writing a plugin](#writing-a-plugin)

## Motivation

An event contract should describe the messages your application exchanges once. Keeping handwritten TypeScript types and validation schemas aligned with that contract creates duplicate work and opportunities for drift. Opalesce derives these artifacts from the same AsyncAPI document, with a separate plugin for each output target.

Like [Kubb](https://github.com/kubb-labs/kubb), which generates code from OpenAPI, Opalesce uses declarative configuration and plugins to select generation targets. Its input describes event-driven APIs through [AsyncAPI](https://www.asyncapi.com/docs/concepts/asyncapi-document).

The engine uses the [official AsyncAPI JavaScript parser](https://github.com/asyncapi/parser-js) to parse and resolve the document once. Plugins share the parsed document and a normalized description of schemas, messages, channels, and operations. The provided output plugins support AsyncAPI **2.6.0, 3.0.0, and 3.1.0**; see the [AsyncAPI specification](https://www.asyncapi.com/docs/reference/specification/v3.1.0) for the document model.

## Getting started

Install Opalesce and the output plugins you need:

```sh
pnpm add -D opalesce @opalesce/plugin-typescript @opalesce/plugin-json-schema
```

Create `asyncapi.yaml`:

```yaml
asyncapi: 3.1.0
info:
  title: User events
  version: 1.0.0
channels:
  userEvents:
    address: users.created
    messages:
      created:
        $ref: "#/components/messages/UserCreated"
operations:
  sendUserCreated:
    action: send
    channel:
      $ref: "#/channels/userEvents"
components:
  messages:
    UserCreated:
      payload:
        $ref: "#/components/schemas/User"
  schemas:
    User:
      type: object
      required:
        - id
      properties:
        id:
          type: string
```

Create `opalesce.config.ts` next to the document:

```ts
import { defineConfig } from "opalesce";
import typescript from "@opalesce/plugin-typescript";
import jsonSchema from "@opalesce/plugin-json-schema";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
  plugins: [typescript(), jsonSchema()],
});
```

Run generation:

```sh
pnpm exec opalesce generate
```

The example produces:

```text
generated/
  types/
    index.ts
    schemas/User.ts
    messages/UserCreated.ts
    operations/SendUserCreated.ts
  schemas/
    index.schema.json
    User.schema.json
```

Import the generated contract into your application:

```ts
import type { User } from "./generated/types/index.js";

const user: User = { id: "user-123" };
```

## Interface

A config describes one local input document, an output directory, and an ordered list of plugin instances. Plugins are independently installed packages; the `opalesce` entry point provides the helpers and command.

| Entry point                    | Purpose                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `defineConfig` from `opalesce` | Type a project config with `input`, `output`, optional `parser` options, and `plugins`. |
| `definePlugin` from `opalesce` | Define a plugin factory whose `generate(context)` returns text artifacts.               |
| `opalesce generate`            | Load config, read the document, generate artifacts, and write them to disk.             |
| `run` from `@opalesce/core`    | Embed the in-memory pipeline when your program owns input loading and persistence.      |

Config paths resolve relative to the config file. CLI input and output overrides resolve relative to the directory where you run the command:

```sh
pnpm exec opalesce generate ./specs/events.yaml --out ./src/generated
pnpm exec opalesce generate --config ./configs/opalesce.staging.ts
```

Plugins run sequentially in array order. The CLI starts writing only after all generation succeeds. By default, generated paths are overwritten and stale files remain; `output.clean: true` removes the old output directory when it is a safe directory below the config directory. Filesystem write failures can leave partial output.

See the [configuration reference](./packages/config/README.md), [CLI reference](./packages/cli/README.md), and [Core API](./packages/core/README.md) for discovery rules, parsing options, and error handling.

## Plugins

Choose the artifacts your project consumes. Plugin output paths are relative to `output.path`, and paths must be unique across the run.

<details>
<summary><code>@opalesce/plugin-typescript</code></summary>

[`@opalesce/plugin-typescript`](./packages/plugin-typescript/README.md) generates named schemas, message payloads and headers, message wrappers, channel parameters, operation message selections, and replies. A barrel file exposes the generated types through one import path.

Install the plugin to generate compile-time contracts for application code:

```sh
pnpm add -D opalesce @opalesce/plugin-typescript
```

Create `opalesce.config.ts` next to your `asyncapi.yaml`:

```ts
import { defineConfig } from "opalesce";
import typescript from "@opalesce/plugin-typescript";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
  plugins: [typescript({ output: "contracts" })],
});
```

Generate the files:

```sh
pnpm exec opalesce generate
```

| Option   | Default | Purpose                                                                     |
| -------- | ------- | --------------------------------------------------------------------------- |
| `output` | `types` | Directory containing schema, message, channel, operation, and barrel files. |

With `output.path: "./generated"`, this writes under `generated/contracts/`.

The output contains types only. It does not validate runtime data or enforce JSON Schema constraints such as patterns, numeric ranges, or exact `oneOf` semantics. Native AsyncAPI schemas and explicit JSON Schema Draft 07 are supported; foreign schema formats fail generation.

</details>

<details>
<summary><code>@opalesce/plugin-json-schema</code></summary>

[`@opalesce/plugin-json-schema`](./packages/plugin-json-schema/README.md) exports every named `components.schemas` entry as a JSON Schema Draft 07 resource, plus `index.schema.json` mapping component names to their files. Use these artifacts with compatible validators or other schema consumers.

Install the plugin to generate standalone schemas for validation tooling:

```sh
pnpm add -D opalesce @opalesce/plugin-json-schema
```

Create `opalesce.config.ts` next to your `asyncapi.yaml`:

```ts
import { defineConfig } from "opalesce";
import jsonSchema from "@opalesce/plugin-json-schema";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
  plugins: [jsonSchema({ outputPath: "contracts/schemas" })],
});
```

Generate the files:

```sh
pnpm exec opalesce generate
```

| Option       | Default   | Purpose                                                 |
| ------------ | --------- | ------------------------------------------------------- |
| `outputPath` | `schemas` | Directory containing component schemas and their index. |

With `output.path: "./generated"`, this writes under `generated/contracts/schemas/`.

Only named component schemas become roots. Anonymous payloads, headers, and channel parameters do not get separate files. The plugin validates the emitted Draft 07 resource set and rejects unsupported formats or references that cannot resolve within it.

It needs the unresolved source snapshot that the CLI supplies. When embedding Core, an already-parsed document does not include that snapshot; see [source requirements](./packages/plugin-json-schema/README.md#source-requirement) and the [reference policy](./packages/plugin-json-schema/README.md#reference-policy).

</details>

## Development

The workspace uses TypeScript, Nx, and Vitest. Dependency versions live in [package.json](./package.json) and package manifests such as [Core](./packages/core/package.json) and [TypeScript](./packages/plugin-typescript/package.json); the runtime environment is declared in [flake.nix](./flake.nix).

### Prepare the environment

<details>
<summary>Install the managed environment tooling</summary>

Install [Nix](https://nixos.org/download/) with flakes enabled. For automatic shell activation, also install [direnv](https://direnv.net/docs/installation.html), configure its shell hook, and enable [nix-direnv](https://github.com/nix-community/nix-direnv#installation).

</details>

The Nix flake provides Node.js, pnpm, and Just. From the repository root, enter it manually and install dependencies:

```sh
nix develop
just setup
```

Alternatively, run `direnv allow` once to authorize automatic loading whenever your shell enters the repository. With direnv, optional local environment variables are loaded from `envs/.env`.

For manual setup, install Node.js, pnpm **10.34.0** as pinned by `packageManager`, and [Just](https://github.com/casey/just#installation). Then run `just setup`.

### Build and check

Run these commands from the repository root:

| Command                                               | Purpose                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `just nx run-many -t build`                           | Build all packages and their TypeScript declarations.                         |
| `just nx build @opalesce/plugin-typescript`           | Build one plugin and its build dependencies.                                  |
| `pnpm --dir packages/plugin-typescript run test`      | Run the TypeScript plugin's tests once.                                       |
| `pnpm --dir packages/plugin-typescript run typecheck` | Type-check that plugin's source and tests.                                    |
| `just check`                                          | Run workspace linting, formatting checks, type checks, and tests, as CI does. |
| `just format`                                         | Apply lint fixes and formatting.                                              |

For a change to another package, use its corresponding directory or Nx project name. After building, try local generation with the checked-in fixture:

```sh
node packages/opalesce/bin/opalesce.js generate \
  --config packages/plugin-json-schema/test/fixtures/config/opalesce.config.ts \
  --out ./tmp/readme-preview
```

This runs the freshly built local packages and writes to `tmp/readme-preview`. After editing, run the package checks and rebuild before rerunning the command. The CLI performs one generation run per invocation.

## Writing a plugin

A plugin converts the shared context into `{ path, contents }` artifacts. Keep generated files in the return value so Core can validate paths and the CLI can own persistence.

Create `plugins/manifest.ts` in a project that has installed `opalesce`:

```ts
import { definePlugin } from "opalesce";

export default definePlugin((options: { path: string }) => ({
  name: "manifest",
  generate(context) {
    return [
      {
        path: options.path,
        contents:
          JSON.stringify(
            {
              asyncapi: context.document.version(),
              channels: context.interaction.channels.length,
              operations: context.interaction.operations.length,
              messages: context.interaction.messages.length,
            },
            null,
            2,
          ) + "\n",
      },
    ];
  },
}));
```

Register it in `opalesce.config.ts`:

```ts
import { defineConfig } from "opalesce";
import manifest from "./plugins/manifest.ts";

export default defineConfig({
  input: "./asyncapi.yaml",
  output: { path: "./generated" },
  plugins: [manifest({ path: "metadata/manifest.json" })],
});
```

Run `pnpm exec opalesce generate` to write `generated/metadata/manifest.json`. To combine it with the built-in plugins, add the `manifest` import and instance to the getting-started config.

`context.document` exposes the official parser model; `context.interaction` provides the immutable, shared generation contract. `context.diagnostics` contains parser diagnostics, and optional `context.source` preserves the authored source before reference resolution. A plugin can return a promise; Core awaits it before starting the next plugin. Plugins cannot inspect another plugin's artifacts.

Artifact paths must be relative, use forward slashes, omit `.` and `..` segments, and remain unique across all plugins. See [plugin definitions](./packages/core/README.md#defining-plugins) and [artifact rules](./packages/core/README.md#returning-artifacts) for the full contract.

## License and credits

[MIT](./LICENSE) - Copyright Max Sharov. Created by [Max Sharov (@ravecat)](https://github.com/ravecat).

- [AsyncAPI Initiative](https://www.asyncapi.com/) and the [parser contributors](https://github.com/asyncapi/parser-js/graphs/contributors) provide the specification and parser that underpin generation.
- [Kubb](https://github.com/kubb-labs/kubb) and its [contributors](https://github.com/kubb-labs/kubb/graphs/contributors) are a design reference for the declarative plugin workflow.
