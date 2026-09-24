## Context

The workspace already has three release surfaces: the general `check` workflow, a read-only stable release preview on pushes to `master`, and a manually dispatched stable publisher. npm Trusted Publishing authorizes `.github/workflows/publish.yml`, so any OIDC-backed canary publisher must remain in that file. Nx manages six independently versioned projects and already updates dependents during stable releases.

The preview and canary channels answer different questions. Preview shows the stable versions and changelogs that current Git history would produce. Canary produces installable artifacts for integration testing while keeping `latest` unchanged.

## Goals / Non-Goals

**Goals:**

- Publish affected, checked workspace packages automatically from `master` under the `canary` dist-tag.
- Make a canary version identify its source commit with an eight-character SHA prefix.
- Keep retries of the same commit idempotent.
- Preserve stable release preview and manual stable publication as separate behaviors.
- Keep canary version mutations local to the disposable runner.

**Non-Goals:**

- Provide atomic multi-package publication or rollback npm versions.
- Promote canary artifacts directly to stable versions.
- Replace the stable release preview, changelog, release commit, or Git tag process.
- Introduce a beta branch, staged publishing, or another package registry.

## Decisions

### Keep preview and publication separate

`.github/workflows/release-preview.yml` remains a push-triggered dry run. It continues to calculate the future stable release without credentials or mutation. Canary publication is added to `publish.yml` because npm authorizes that exact workflow for OIDC. The stable job is restricted to `workflow_dispatch`, while the canary job is restricted to pushes on the default branch.

Alternative considered: replace preview with canary publication. Rejected because installable artifacts do not expose the future stable changelog and version plan as directly as the existing dry run.

### Use an eight-character source SHA prerelease identifier

The workflow passes `canary.${GITHUB_SHA:0:8}` to `nx release version`. Nx appends its normal prerelease counter, producing versions such as `0.2.1-canary.a1b2c3d4.0`. The same commit therefore resolves to the same package versions on retry.

Alternative considered: include a timestamp or run number. Rejected because it creates a new version for an unchanged commit and weakens retry idempotency.

### Version only in the disposable runner

Canary versioning calls `nx release version` with Git commit, tag, push, and staging disabled. It does not invoke changelog generation. Only package manifests changed by versioning are considered for publication. A push without releasable changes exits successfully without contacting npm.

### Propagate prerelease identity to dependents

`release.version.applyPreidToDependents` is enabled. Nx remains the owner of affected-project selection, dependency propagation, workspace protocol replacement, build order, and package publication.

### Publish sequentially and fail fast

Canary publication uses the `canary` dist-tag, one publish worker, and Nx bail behavior. Runs for `master` are serialized without cancelling an in-progress publication, preventing a newer push from interrupting a partially published package set. npm has no multi-package transaction, so this reduces but cannot eliminate partial publication. The workflow checks whether each changed package version already exists in npm, skips existing versions without moving the `canary` dist-tag backward, and passes only missing projects to Nx. A failed registry lookup other than a missing version stops the run rather than publishing an unverified package set.

## Risks / Trade-offs

- [Partial npm publication remains possible] -> Publish sequentially, fail on the first error, preserve deterministic versions, and retry the same SHA to publish missing versions.
- [Eight-character SHA prefixes can theoretically collide] -> The risk is acceptable for the expected number of canaries within one base version; exact source provenance remains attached by npm OIDC publication.
- [Canary checks duplicate the general check workflow] -> Keep the publisher self-contained so it cannot publish before another independently scheduled workflow finishes.
- [Prerelease versions accumulate in npm] -> Publish only when Nx detects releasable package changes and keep them off `latest`.
- [Workflow trigger expansion could accidentally run stable publication on push] -> Gate stable and canary jobs explicitly by event name and default branch.

## Migration Plan

1. Add prerelease propagation to Nx release configuration.
2. Add push-triggered canary publication to `publish.yml` while retaining manual stable publication.
3. Keep the existing preview workflow unchanged.
4. Validate workflow syntax, workspace checks, stable dry run, and canary dry-run behavior without publishing.
5. Roll back by removing the canary job and prerelease propagation option; previously published canary versions remain immutable but do not affect `latest`.

## Open Questions

None.
