## 1. Establish the workspace

- [x] 1.1 Add `pnpm-workspace.yaml` with `packages/*` as the only package glob and confirm the root remains the only lockfile owner.
- [x] 1.2 Add exact matching `nx` and `@nx/js` 23.1.0 development dependencies, set `build:workspace` to `nx run-many -t build`, set `check:workspace` to `nx run-many -t check`, and update the root lockfile without changing existing root script meanings.
- [x] 1.3 Add the minimal `nx.json` configuration for the pnpm package layout, disabled TUI, TypeScript build inference with typecheck inference disabled, and cache defaults for build, check, typecheck, test, lint, and `format.check`.
- [x] 1.4 Set the root workspace identity to `opalesce`, omit root `project.json`, and verify Nx does not model the repository root as a project before package projects are added.
- [x] 1.5 Add a strict ES2022 ESM `tsconfig.base.json` for new packages while leaving the existing root `tsconfig.json` behavior unchanged.
- [x] 1.6 Ignore `.nx/cache` and `.nx/workspace-data` without altering unrelated ignore rules.
- [x] 1.7 Update repository lint and formatting configuration to validate `packages/*` source and tests while excluding `**/dist/**` and `.nx/**`; keep `format:check` as a native script and use `format.check` as the Nx target name.

## 2. Create `@opalesce/core`

- [x] 2.1 Create `packages/core/package.json` with the `@opalesce/core` identity, private publication protection, ESM and declaration exports, a direct `@asyncapi/parser` dependency, and explicit `typecheck`, `test`, and `check` scripts; leave `build` to Nx TypeScript inference.
- [x] 2.2 Add Core `project.json`, solution `tsconfig.json`, emitting `tsconfig.lib.json`, non-composite no-emit `tsconfig.check.json`, and focused Vitest configuration so Nx exposes independent build, typecheck, test, and check targets.
- [x] 2.3 Implement and export `ParsedAsyncAPI`, `AsyncAPIParserOptions`, `ParseAsyncAPIOptions`, `AsyncAPIParseError`, and `parseAsyncAPI`; derive constructor options from `typeof Parser` and re-export only the official root-exported `Input`, `ParseOptions`, `AsyncAPIDocumentInterface`, and `Diagnostic` types without deep imports.
- [x] 2.4 Enforce the success invariant: return the document plus all diagnostics only when a document exists and no error-severity diagnostic is present; otherwise throw `AsyncAPIParseError`, using a defensive shallow-frozen diagnostics array in both paths.
- [x] 2.5 Add focused tests for valid AsyncAPI 3.0 and 3.1 text, JavaScript object input, existing document input, official document methods, constructor-argument assignability, and unchanged forwarding of both `AsyncAPIParserOptions` and `ParseOptions`.
- [x] 2.6 Add focused tests for retained non-fatal diagnostics, runtime diagnostics-array immutability, invalid input, missing-document failure, the typed error contract, top-level path non-loading, external-reference delegation, and absence of filesystem writes.
- [x] 2.7 Add a `verify-package` Nx target that depends on `build` and checks the built ESM entry point, declarations, exact public surface, and absence of a transitional root dependency; make the Core `check` target depend on it while keeping source tests independently runnable.

## 3. Integrate validation without changing release ownership

- [ ] 3.1 Verify `@opalesce/core` exposes `build` and `check`, then make the exact aggregate commands cover package projects and propagate a Core typecheck, test, or package-verification failure.
- [x] 3.2 Update the check workflow to run the aggregate workspace check inside the existing Nix shell after a frozen pnpm install.
- [ ] 3.3 Verify no Nx release configuration is introduced and `@opalesce/core` remains protected from publication pending a separate release change.
- [x] 3.4 Use `nix flake show --all-systems` to verify all four development-shell outputs, then use `nix develop --command` on the host to verify Just, Node.js 24, and pnpm 10 without adding Git or a second environment definition.

## 4. Validate the completed change

- [ ] 4.1 Run `pnpm install --frozen-lockfile` from a clean dependency state and verify no nested lockfile is created.
- [ ] 4.2 Run `pnpm exec nx show projects`, verify only package projects are discovered, and inspect the Core definition for target inference and output paths.
- [ ] 4.3 Run the Core build, typecheck, test, `verify-package`, and check targets independently through Nx, including `verify-package` from a clean `dist` state.
- [ ] 4.4 Run the aggregate package workspace build and check commands, then rerun them to confirm eligible targets use the Nx cache.
- [ ] 4.5 Verify current root artifacts remain outside the Nx graph and no package target depends on them.
- [ ] 4.6 Confirm the Core AsyncAPI 3.0 and 3.1 suites pass and Nx runtime state remains ignored by Git.
