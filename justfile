runner := "pnpm"

default:
    @just --list

setup:
    {{ runner }} install

build:
    {{ runner }} run build

check:
    {{ runner }} exec oxfmt --check .
    {{ runner }} exec eslint .
    just typecheck
    just test

format:
    {{ runner }} exec eslint . --fix
    {{ runner }} exec oxfmt .

lint:
    {{ runner }} exec eslint .

test:
    {{ runner }} run test

test-unit:
    {{ runner }} run test:unit

test-smoke:
    {{ runner }} run test:smoke

typecheck:
    {{ runner }} exec tsc --noEmit -p tsconfig.json
