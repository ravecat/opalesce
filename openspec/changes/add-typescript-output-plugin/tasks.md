## 1. Core Interaction Contract Surface

- [x] 1.1 Define readonly public metadata, schema-role, schema-root, message, channel, parameter, operation, reply, dependency, and `InteractionContract` types under `packages/core/src/interaction`.
- [x] 1.2 Add stable `InteractionContractError` codes and source-attributed details for unsupported versions, identities, and references.
- [x] 1.3 Export the intended interaction contract types and error from `@opalesce/core` without exposing internal registry helpers.
- [x] 1.4 Add compile-time export and immutability contracts for the new Core public surface.

## 2. Contract Identity and Schema Dependencies

- [ ] 2.1 Implement kind-qualified identities and exact parser pointer extraction for component, channel-owned inline, operation, and reply roots, including channel-scoped AsyncAPI 2.6 fallback identities.
- [x] 2.2 Implement a registry that deduplicates parser model objects and retains schema handles plus effective formats without mutating them.
- [x] 2.3 Traverse schema-bearing roles into deterministic dependency identities while terminating for repeated, self-recursive, and mutually recursive graphs.
- [x] 2.4 Implement recursive freezing for contract-owned objects and arrays while leaving parser-owned model instances unchanged.
- [ ] 2.5 Add focused tests for identities, dependency deduplication, recursion, ordering, parser preservation, same-role AsyncAPI 2.6 operations, and unrepresentable external reference targets.

## 3. AsyncAPI Version Normalization

- [x] 3.1 Normalize AsyncAPI 3.0 and 3.1 component schemas, reusable and channel messages, application headers, payloads, channel parameters, operations, and replies.
- [ ] 3.2 Normalize AsyncAPI 2.6 component schemas, reusable and channel messages, application headers, payloads, parameters, publish and subscribe operations, and collision-free derived operation identities.
- [x] 3.3 Use parser-effective traits, channels, message selections, and reply selections instead of rebuilding those relationships from unresolved source.
- [ ] 3.4 Preserve foreign schema formats without conversion and reject unsupported versions or unrepresentable reference identities without external resolution.
- [ ] 3.5 Add 2.6, 3.0, and 3.1 contract fixtures covering inline ownership, traits, selections, replies, used and unused schemas, parameters, formats, recursion, derived operation identity collisions, and external reference identity failures.
- [x] 3.6 Add tests for deterministic repeated normalization and absence of filesystem, network, parser, or artifact side effects.

## 4. PluginContext Integration

- [x] 4.1 Add readonly `interaction: InteractionContract` to `PluginContext`.
- [x] 4.2 Implement an enumerable lazy getter that memoizes one contract or construction error per pipeline context.
- [x] 4.3 Verify two consuming plugins receive the same contract identity and normalization runs once.
- [x] 4.4 Verify plugins that never access `interaction` preserve current behavior, including parsed versions outside contract support.
- [x] 4.5 Verify contract construction failures use the existing consuming-plugin error attribution and prevent later plugin execution.
- [x] 4.6 Update Core README and public type tests for the expanded context contract.

## 5. TypeScript Plugin Foundation

- [x] 5.1 Scaffold `packages/plugin-typescript` as the independently publishable `@opalesce/plugin-typescript` package with the workspace Nx, package, TypeScript, Vitest, license, changelog, and export configuration used by focused libraries.
- [x] 5.2 Add dependencies on `@opalesce/core` and TypeScript plus the required workspace references and lockfile metadata.
- [x] 5.3 Implement `TypeScriptPluginOptions` with only readonly `outputPath?: string`, defaulting to `types`.
- [x] 5.4 Implement the default `typescript` factory with literal plugin name `typescript` and generation from `context.interaction` only.
- [x] 5.5 Add stable plugin error codes carrying source pointer and identity, format, reference, naming, or projection details.
- [x] 5.6 Add direct-package runtime, compile-time export, default-path, custom-path, and contract-consumption tests.

## 6. Schema Projection

- [x] 6.1 Define the plugin-owned target AST for unknown, never, primitives, null, literals, arrays, tuples, objects, references, unions, intersections, properties, index signatures, and documentation.
- [x] 6.2 Project boolean, primitive, const, enum, array, tuple, required, optional, nullable, read-only, and write-only semantics.
- [x] 6.3 Project `allOf`, `anyOf`, and `oneOf` with documented TypeScript approximations and no synthesized discriminator fields.
- [ ] 6.4 Implement the fixed additional-properties policy with structural compatibility checking and safe widening to `unknown` for incompatible nested values.
- [ ] 6.5 Preserve symbolic dependency identities and transitive recursion without expanding parser graphs, including owner-scoped recursive anonymous schemas.
- [x] 6.6 Collect and safely escape deterministic JSDoc for descriptions, deprecation, defaults, examples, formats, constraints, access annotations, and discriminators.
- [x] 6.7 Reject unsupported formats and unprojectable schemas before artifact return.
- [ ] 6.8 Add focused projection tests for every mapping, approximation, escape case, named and anonymous recursion case, structured additional-properties compatibility case, and failure mode.

## 7. Naming, Planning, and Rendering

- [ ] 7.1 Implement deterministic role-aware PascalCase names and owner-scoped inline and nested names while preserving exact wire keys, including private recursive dependency names.
- [x] 7.2 Complete the symbol table before rendering and reject public symbol collisions without counter suffixes.
- [x] 7.3 Reject per-directory filename collisions after NFC, lowercase, and portable reserved-name normalization.
- [x] 7.4 Plan fixed schema, message, channel, operation, and barrel paths under the normalized output path.
- [x] 7.5 Compute imports and exports from dependency identities, remove same-file imports, and use sorted relative `.js` type-only specifiers.
- [x] 7.6 Render target AST declarations with the TypeScript compiler factory and printer using fixed LF and two-space formatting.
- [ ] 7.7 Render schema files, message payload and header wrappers, owner-scoped private nested declarations, channel parameters, operation selections, replies, and the public barrel.
- [x] 7.8 Validate rendered TypeScript syntax, enforce one trailing newline, and return the barrel first followed by lexicographic paths only after all stages succeed.
- [ ] 7.9 Add naming, planning, and rendering tests for unsafe names, collisions, empty output, imports, public and private cycles, paths, bytes, and atomic failures.

## 8. TypeScript Conformance Corpus

- [x] 8.1 Build corpus utilities that run self-contained inputs and complete expected artifact trees through the public Core pipeline.
- [x] 8.2 Add representative AsyncAPI 2.6, 3.0, and 3.1 cases that collectively cover schemas, reusable and inline messages, payloads, headers, parameters, operations, and replies.
- [ ] 8.3 Add cases for used and unused schemas, references, named and anonymous self and mutual recursion, composition, literals, nullability, access annotations, primitive and structured additional properties, unsafe keys, and JSDoc escaping.
- [x] 8.4 Add corpus failures for unsupported formats and references, unrepresentable roots, symbol collisions, and filename collisions, plus a rendering-boundary failure test.
- [x] 8.5 Compare every path and byte, run success cases twice, and assert atomic stable diagnostics for failure cases.
- [ ] 8.6 Compile every success tree under strict NodeNext settings, including structured additional-properties and private-recursion regressions, and add representative positive plus `@ts-expect-error` assignments.

## 9. Facade and CLI Integration

- [x] 9.1 Keep `opalesce` free of output-plugin dependencies and expose TypeScript only through the independent `@opalesce/plugin-typescript` package.
- [x] 9.2 Re-export `InteractionContract` and its intended public types from `opalesce` through the existing Core dependency.
- [x] 9.3 Add consumer type tests proving third-party plugins can consume `context.interaction` from `opalesce` and configure TypeScript from `@opalesce/plugin-typescript`.
- [x] 9.4 Add facade-owned CLI persistence and strict consumer-compilation coverage using `opalesce` with the independent TypeScript plugin package.
- [x] 9.5 Verify existing Core, CLI, config, and JSON Schema plugin behavior and contracts remain compatible when interaction is unused.

## 10. Documentation and Validation

- [x] 10.1 Document the Core context contract, facade and independent plugin-package boundary, generated interaction surface, fixed directory layout, and types-only limitations.
- [x] 10.2 Document parser and resolver ownership, lazy normalization, foreign-format handling, and why Modelina is not a first-delivery dependency.
- [x] 10.3 Run focused builds, type checks, and tests for Core, `@opalesce/plugin-typescript`, `opalesce`, and affected CLI integration.
- [x] 10.4 Run repository formatting, linting, aggregate checks, builds, and package verification through established workspace commands.
- [ ] 10.5 Run strict OpenSpec validation and reconcile implementation, conformance, documentation, GitHub Feature #13, and bugs #14 through #17 with both capability specifications.

## 11. Implementation Review Corrections

- [ ] 11.1 Fix [#14](https://github.com/ravecat/opalesce/issues/14) so AsyncAPI 2.6 operations without `operationId` use exact channel-and-role identities and cannot collide across channels.
- [ ] 11.2 Fix [#15](https://github.com/ravecat/opalesce/issues/15) so incompatible structured fixed properties widen schema-valued `additionalProperties` to `unknown` before artifact return.
- [ ] 11.3 Fix [#16](https://github.com/ravecat/opalesce/issues/16) by planning deterministic owner-scoped private declarations for recursive anonymous schema dependencies.
- [ ] 11.4 Fix [#17](https://github.com/ravecat/opalesce/issues/17) so Core rejects parser-resolved reference targets without stable interaction identities and performs no additional resolution.
- [ ] 11.5 Add focused reproductions and complete golden or strict-compilation regression coverage for all four bugs.
- [ ] 11.6 Re-run focused and aggregate validation, verify each GitHub bug's acceptance criteria, and return Feature #13 to review only after every blocker is closed.
