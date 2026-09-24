## Why

Opalesce needs installable builds from `master` so downstream projects can exercise unreleased package changes without moving the stable `latest` channel. The existing release preview remains useful for inspecting the next stable release, but it does not provide consumable artifacts.

## What Changes

- Publish affected packages automatically under the npm `canary` dist-tag after a push to `master` passes workspace checks.
- Derive deterministic prerelease identifiers from the first eight characters of the source commit SHA while retaining Nx's prerelease counter.
- Keep canary version changes ephemeral so they create no changelog, release commit, or Git tag.
- Keep stable publication as a manual `workflow_dispatch` path in the trusted `publish.yml` workflow.
- Retain the separate dry-run release preview for visibility into the future stable bump.
- Propagate canary prerelease identifiers to dependents in the independent-package release graph.
- Stop sequential canary publication on the first failure and support idempotent retry of the same commit.

## Capabilities

### New Capabilities

- `automatic-canary-releases`: Automatic, traceable, and recoverable npm canary publication for affected workspace packages.

### Modified Capabilities

None.

## Impact

- Affects `.github/workflows/publish.yml`, `nx.json`, and repository release operations.
- Uses the existing npm Trusted Publisher binding to `ravecat/opalesce` and `publish.yml`.
- Adds no runtime package API and no production dependency.
- Does not replace the stable release process, migrate package boundaries, or change the `latest` channel contract.
