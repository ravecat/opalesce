## 1. Nx prerelease behavior

- [x] 1.1 Configure Nx to apply canary prerelease identifiers to dependency-driven package bumps
- [x] 1.2 Verify the resolved release configuration preserves independent stable versioning

## 2. Canary publication workflow

- [x] 2.1 Extend `publish.yml` with a push-triggered, OIDC-enabled canary job while keeping stable publication manual
- [x] 2.2 Generate ephemeral canary versions from the eight-character source SHA and skip publication for an empty release set
- [x] 2.3 Publish canary packages sequentially under the `canary` dist-tag with fail-fast behavior
- [x] 2.4 Preserve the separate stable release preview without mutation

## 3. Validation and reconciliation

- [x] 3.1 Validate OpenSpec artifacts, workflow syntax, and formatting
- [x] 3.2 Run workspace checks and stable release dry-run regression validation
- [x] 3.3 Exercise canary versioning through a non-publishing dry run, verify no tracked state is changed, and simulate changed, already-published, and unchanged package selection
- [x] 3.4 Reconcile task and specification status with the verified implementation
