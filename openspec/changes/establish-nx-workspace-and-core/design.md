## Context

The repository contains exploratory ESM generator source, tests, a CLI, built-in plugins, emitters, and semantic-release configuration at the repository root. These artifacts are migration input rather than the target workspace layout. The internal `src/core` directory is not an extractable package boundary because it imports root configuration and types, reads files, and participates in the existing plugin runtime.

The first migration step must establish a package-first workspace without requiring all exploratory artifacts to move immediately. The root is infrastructure only and is not an Nx project. The new `@opalesce/core` package establishes the first clean boundary around the official AsyncAPI parser and its `AsyncAPIDocumentInterface`. The existing Nix flake remains the development environment contract.

## Goals / Non-Goals

**Goals:**

- Use `opalesce` as the workspace identity and represent projects only under `packages/*`.
- Keep current root artifacts available as migration input without treating them as permanent project contracts.
- Give new packages a strict TypeScript baseline and independently runnable build, typecheck, and test targets.
- Provide a small Core API that parses top-level in-memory input and returns a valid official AsyncAPI document plus diagnostics.
- Preserve one pnpm lockfile and the Nix-based Just, Node.js 24, and pnpm 10 environment without packaging Git in the shell.

**Non-Goals:**

- Moving or deleting current root source, tests, emitters, plugins, or runtime modules in this change.
- Defining plugin, template, runner, configuration, artifact-plan, JSON Schema, TypeScript, or Zod generation contracts.
- Replacing semantic-release, publishing `@opalesce/core`, or deciding fixed versus independent package versioning.
- Registering the repository root as an Nx project.
- Introducing applications, frontend tooling, Nx Release, or unrelated Nx plugins.

## Decisions

### 1. Build a package-first Nx workspace

The repository root is the `opalesce` workspace container and does not receive a `project.json`. Libraries live under `packages/*`, beginning with `packages/core` as `@opalesce/core`. `pnpm-workspace.yaml` includes `packages/*`, and the repository keeps exactly one root `pnpm-lock.yaml`.

Current root artifacts may coexist during migration, but Nx does not discover them as a project. This is preferred over creating a placeholder root project because its name, targets, inputs, and outputs would encode a layout that is already known to be temporary. It is also preferred over moving everything immediately because that would mix workspace adoption with several package-boundary decisions.

Before the first package is created, an empty Nx project graph is valid. Package manifests and package-local `project.json` files become the source of project identities and target metadata.

### 2. Use a minimal Nx toolchain

The root adds exact, matching versions of `nx` and `@nx/js`. The initial `nx.json` contains the schema reference, `defaultBase: master`, `workspaceLayout` with `packages` as the library directory, disabled TUI, the `@nx/js/typescript` inference plugin with build inference enabled and typecheck inference disabled, and cache defaults only for existing build, check, typecheck, test, lint, and `format.check` targets.

No React, Next.js, Jest, Vite, Docker, SWC, or Nx Release plugin is added. This follows the useful workspace and TypeScript patterns from the existing Moda repository without copying its application-specific or release-specific configuration.

### 3. Preserve native commands and add aggregate workspace commands

`build:workspace` runs `nx run-many -t build`, and `check:workspace` runs `nx run-many -t check`. These commands operate only on package projects. The Core package defines a `check` script that runs its explicit typecheck followed by its focused tests, so the aggregate check has one unambiguous package target. CI validation uses `check:workspace` after installation. Package publication remains a separate decision and no Nx release behavior is introduced here.

`format.check` is the canonical Nx target name because it does not conflict with Nx's colon-delimited project and target syntax. The existing `format:check` root script remains a transitional native entry point outside the Nx project graph.

This avoids recursive target definitions and prevents transitional root scripts from becoming workspace project contracts.

### 4. Isolate the new TypeScript baseline

`tsconfig.base.json` defines the strict ES2022, ESM, and Bundler-resolution baseline for new packages. `packages/core/tsconfig.json` is a solution configuration that references `tsconfig.lib.json`. The library configuration emits JavaScript and declarations into the package `dist` directory. A separate, non-composite `tsconfig.check.json` includes Core source, tests, and consumer type assertions with `noEmit: true`.

Target ownership is deliberately hybrid. `@nx/js/typescript` infers the Core `build` target from `tsconfig.lib.json` and the package export paths. Typecheck inference is disabled so it cannot add an emitting build dependency. Core package scripts explicitly own `typecheck`, `test`, and `check`: typecheck runs `tsc -p tsconfig.check.json`, test runs `vitest run --config vitest.config.ts`, and check composes typecheck plus test. The plugin is scoped to `packages/**/*`, so transitional root TypeScript configuration cannot introduce inferred targets.

A separate `verify-package` Nx target depends on Core `build` and exercises the built ESM and declaration entry points as a consumer. The Core `check` target depends on `verify-package`, while the focused source test target remains runnable without a pre-existing `dist` directory.

The transitional root `tsconfig.json` does not extend the new base in this change. Package projects use the new base directly rather than inheriting from temporary root compiler behavior.

### 5. Make official parser models the Core boundary

Core depends directly on `@asyncapi/parser` and does not define a parallel AsyncAPI object model. Its initial public contract is intentionally small:

```ts
export interface ParsedAsyncAPI {
  readonly document: AsyncAPIDocumentInterface;
  readonly diagnostics: readonly Diagnostic[];
}

export type AsyncAPIParserOptions = NonNullable<ConstructorParameters<typeof Parser>[0]>;

export interface ParseAsyncAPIOptions {
  readonly parser?: AsyncAPIParserOptions;
  readonly parse?: ParseOptions;
}

export declare function parseAsyncAPI(
  input: Input,
  options?: ParseAsyncAPIOptions,
): Promise<ParsedAsyncAPI>;
```

Core re-exports exactly the official root-exported `Input`, `ParseOptions`, `AsyncAPIDocumentInterface`, and `Diagnostic` types used by this contract so consumers do not need a second model vocabulary. `@asyncapi/parser` 3.6.0 does not root-export its named `ParserOptions` interface, so Core exposes `AsyncAPIParserOptions` derived from the first argument of the official `Parser` constructor instead of relying on a deep package import. `Input` permits YAML or JSON text, a JavaScript AsyncAPI object, or an existing `AsyncAPIDocumentInterface`. The `parser` options are passed unchanged to the `Parser` constructor, preserving ruleset and custom schema-parser extension points; the `parse` options are passed unchanged to `Parser.parse`.

This is preferred over moving the existing `AsyncApiDocument` class because that class belongs to the exploratory entity-generation implementation. It is also preferred over returning a custom normalized schema tree because Core must retain access to new capabilities exposed by the official parser.

### 6. Guarantee a valid document on success

`parseAsyncAPI` resolves only when the parser returns a document and no diagnostic with error severity. Non-error diagnostics remain in the successful result. Failure rejects with an exported `AsyncAPIParseError` carrying the complete readonly diagnostics collection. Both result and error receive a defensive copy whose array is shallow-frozen; individual official diagnostic objects are not cloned or deep-frozen.

This invariant keeps every downstream Core consumer from repeating document and fatal-diagnostic checks while preserving the information needed to report parser failures. It matches the current legacy acceptance rule without changing the legacy implementation.

### 7. Keep Core free of orchestration concerns

Core accepts only in-memory top-level parser input. It does not accept a filesystem path, call the parser's `fromFile` helper, discover configuration, write files, manage plugins, name generated entities, or emit artifacts. External `$ref` resolution remains the official parser's behavior and can read files or network resources according to `AsyncAPIParserOptions`, `ParseOptions`, source location, and resolver configuration. Core therefore does not claim complete I/O isolation.

Repository-wide lint and formatting cover package source and tests, while generated `**/dist/**` and `.nx/**` paths are excluded from tooling as well as Git.

### 8. Defer publication safely

The `opalesce` workspace name and reserved `@opalesce` namespace fix project identity without defining release ownership. `packages/core/package.json` declares the `@opalesce/core` identity, ESM entry point, declaration entry point, files, scripts, and direct dependencies, and it is protected from accidental publication during this change. A later release change will choose its initial version, remove that protection, and define its relationship to other `@opalesce/*` packages.

## Risks / Trade-offs

- [Current root artifacts are outside the Nx graph] Workspace aggregate commands do not validate them. Accept this during the package-first migration and move required behavior behind explicit package boundaries.
- [Parser types become part of the Core API] Updating `@asyncapi/parser` can require a Core release. Keep it as an explicit direct dependency and validate supported AsyncAPI fixtures on upgrades.
- [External references can perform I/O] Official parser resolution can use file, HTTP, or HTTPS readers. Document this behavior, forward official controls, and keep top-level path loading outside Core.
- [Parsing logic temporarily exists in two places] Core and exploratory root loading can drift. Cover valid, warning, and invalid Core cases, but defer root delegation until a separate migration change.
- [Nx increases dependency and lockfile surface] Pin matching Nx package versions and add only the JavaScript plugin required for this workspace.
- [Publication is not delivered by this change] Core cannot be consumed from npm yet. Keep local workspace consumption working and handle release ownership as an explicit follow-up.

## Migration Plan

1. Add workspace metadata and dependencies without moving existing files.
2. Verify the root remains outside the Nx graph.
3. Add the isolated `@opalesce/core` package and its focused tests.
4. Add aggregate package workspace commands and make check CI use them.
5. Run focused Core targets, Nx aggregate validation, and frozen installation.

Rollback removes the new workspace files, `packages/core`, Nx dependencies and scripts, and the lockfile changes. Because current root artifacts do not move in this change, rollback does not require restoring source locations.

## Open Questions

None block this change. Package publication, version relationships, plugin contracts, runner ownership, and migration of the current generator remain explicit follow-up decisions.
