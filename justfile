default:
    @just --list

setup:
    pnpm install

[no-exit-message]
[positional-arguments]
nx +args:
    @pnpm exec nx "$@"

[no-exit-message]
[positional-arguments]
generate +args:
    pnpm exec nx run opalesce:build
    @pnpm exec opalesce generate "$@"

check:
    pnpm exec eslint .
    pnpm exec oxfmt --check .
    pnpm exec nx run-many -t check --parallel=1

format:
    pnpm exec eslint . --fix
    pnpm exec oxfmt .
