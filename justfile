default:
    @just --list

setup:
    pnpm install

[no-exit-message]
[positional-arguments]
nx +args:
    @pnpm exec nx "$@"

# Run the teaching fixture against the freshly built local CLI and facade packages.
# Additional arguments are forwarded to `opalesce generate` unchanged.
[no-exit-message]
[positional-arguments]
generate *args:
    pnpm exec nx run opalesce:build
    @pnpm exec opalesce generate --config ./fixtures/smoke/opalesce.config.ts "$@"

check:
    pnpm exec eslint .
    pnpm exec oxfmt --check .
    pnpm exec nx run-many -t check --parallel=1

format:
    pnpm exec eslint . --fix
    pnpm exec oxfmt .
