runner := "pnpm"

default:
    @just --list

setup:
    {{ runner }} install

build:
    {{ runner }} run build

check:
    {{ runner }} run check

format:
    {{ runner }} exec eslint . --fix
    {{ runner }} exec oxfmt .

lint:
    {{ runner }} exec eslint .

test:
    {{ runner }} run test

typecheck:
    {{ runner }} run typecheck
