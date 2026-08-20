# Kubb plugin release model

Date: 2026-08-20

## Conclusion

Kubb's current plugin model matches the requirement that each plugin can be released separately:

- `@kubb/plugins` is a private monorepo root and is not the package users install.
- Every plugin is a distinct public npm package named `@kubb/plugin-*`, for example `@kubb/plugin-ts`, `@kubb/plugin-zod`, and `@kubb/plugin-react-query`.
- The plugin repository configures neither a Changesets `fixed` group nor a `linked` group, and its release workflow explicitly uses per-package releases.
- Therefore package identity, semver version, npm publication, git tag, changelog, and GitHub Release can be independent per plugin.

This means Kubb does not use an import such as `@kubb/plugins/typescript` for independently released plugins. That form would be a subpath of one package. Kubb uses separate package names inside the existing `@kubb` scope.

## Evidence

### Package layout and naming

The root of [`kubb-labs/plugins`](https://github.com/kubb-labs/plugins/blob/0ececa4b5833f8073a4aea0f95025b4d6a82e612/package.json) is named `@kubb/plugins`, has `private: true`, and declares `packages/*` as workspaces. It is an administrative container, not an aggregate npm package.

Each plugin directory has its own manifest. For example, [`packages/plugin-ts/package.json`](https://github.com/kubb-labs/plugins/blob/0ececa4b5833f8073a4aea0f95025b4d6a82e612/packages/plugin-ts/package.json) declares:

```json
{
  "name": "@kubb/plugin-ts",
  "version": "5.0.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

The same shape is used by packages such as [`@kubb/plugin-react-query`](https://github.com/kubb-labs/plugins/blob/0ececa4b5833f8073a4aea0f95025b4d6a82e612/packages/plugin-react-query/package.json). Internal plugin dependencies use workspace ranges, for example React Query depends on `@kubb/plugin-ts` through `workspace:^`; pnpm replaces that workspace protocol with a publishable semver range.

### Versioning policy

The plugin repository's [Changesets configuration](https://github.com/kubb-labs/plugins/blob/0ececa4b5833f8073a4aea0f95025b4d6a82e612/.changeset/config.json) has both `fixed: []` and `linked: []`. There is no rule forcing all plugins to share a version or to be bumped and published together. `updateInternalDependencies: "patch"` can still cause dependent plugin releases when an internal dependency range must be updated.

All current stable plugin manifests happen to be `5.0.0` because Kubb released the v5 line together. Equal current versions are not evidence of a fixed-version policy. The repository has already produced package-specific prereleases, for example [`@kubb/plugin-react-query@5.0.0-beta.104`](https://github.com/kubb-labs/plugins/releases/tag/%40kubb/plugin-react-query%405.0.0-beta.104), while other plugins remained on a different beta number.

### Stable release flow

The official [plugin release workflow](https://github.com/kubb-labs/plugins/blob/0ececa4b5833f8073a4aea0f95025b4d6a82e612/.github/workflows/release.yml) does the following:

1. Builds and tests the plugin workspace.
2. Invokes Kubb's shared release action, which wraps `changesets/action` and runs `pnpm exec changeset version` for versioning.
3. Stages publishable packages on npm through `pnpm stage publish -r --access public --json` with npm provenance and OIDC trusted publishing.
4. Requires the `npm-release-approval` GitHub environment before promotion.
5. Verifies that every staged version is live on npm, creates Changesets git tags, and creates one GitHub Release per package.

The implementation is visible in Kubb's official shared [`release` action](https://github.com/kubb-labs/config/blob/b6c32300e26286508cc3da47d55b0a7a4c8d5583/.github/actions/release/action.yml), its [`stage publish` script](https://github.com/kubb-labs/config/blob/b6c32300e26286508cc3da47d55b0a7a4c8d5583/.github/actions/release/release.mjs), and the [`promote` action](https://github.com/kubb-labs/config/blob/b6c32300e26286508cc3da47d55b0a7a4c8d5583/.github/actions/promote/action.yml). The plugin workflow deliberately omits `release-mode: combined`; its own comment says packages version independently and promotion defaults to per-package mode.

When no stable package was staged, a push to `main` also creates canary versions and publishes them under the `canary` dist-tag. The same workflow listens to `alpha`, `beta`, and `rc` branches for prerelease flows.

### Deliberate contrast with Kubb core

Kubb applies a different policy to its engine repository. The core [Changesets configuration](https://github.com/kubb-labs/kubb/blob/8aa33954635b1b7ea0b8cb651e6c4df07e0f35dc/.changeset/config.json) puts `@kubb/*`, `kubb`, and `unplugin-kubb` in one fixed group. Its [release workflow](https://github.com/kubb-labs/kubb/blob/8aa33954635b1b7ea0b8cb651e6c4df07e0f35dc/.github/workflows/release.yml) selects `release-mode: combined` and explicitly contrasts this with `kubb-labs/plugins`, where packages version independently.

One naming exception is `@kubb/plugin-barrel`: it currently lives in the core repository and participates in the core fixed group. The main generator plugins live in the independent plugin repository.

## Implication for Opalesce

The closest Kubb-style design is:

```text
@opalesce/plugin-typescript
@opalesce/plugin-json-schema
@opalesce/plugin-zod
```

Each directory should have its own non-private `package.json` and public `publishConfig`. A private `packages/plugins/package.json` may be useful only as a workspace or tooling boundary, but consumers should not import plugins through `@opalesce/plugins/*` if separate npm publication is required.

For independent releases, configure the release tool without a fixed or linked group for plugins and generate changes per affected package. Keep in mind that independence does not guarantee that only one package is published: changing a shared plugin dependency can legitimately require dependent package bumps.

Creating a second npm scope such as `@opalesce-plugins` is not required for this model. Kubb gets independent publication while keeping core and plugins under the same `@kubb` scope; the operational split comes from separate package manifests and release configuration, not from a second namespace.

## Uncertainty

The independent policy is explicit in the current source, but the stable v5 packages were released together at `5.0.0` on 2026-08-19. Independent prerelease tags demonstrate that the pipeline can publish subsets, but longer-term stable-version divergence has not yet accumulated in the new `kubb-labs/plugins` repository.
