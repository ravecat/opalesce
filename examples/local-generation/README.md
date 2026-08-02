# Local generation example

This example parses `asyncapi.yaml` and runs one linear plugin that emits a Markdown summary.

From the repository root, build the local packages:

```sh
pnpm exec nx run opalesce:build
```

Run generation with the local config:

```sh
pnpm exec opalesce generate --config ./examples/local-generation/opalesce.config.ts
```

The command creates the ignored file `examples/local-generation/generated/asyncapi-summary.md`. Inspect it with:

```sh
sed -n '1,200p' ./examples/local-generation/generated/asyncapi-summary.md
```
