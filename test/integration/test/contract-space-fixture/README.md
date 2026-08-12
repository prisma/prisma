# test-contract-space (fixture)

Integration-tests fixture exercising the **contract-space mechanism** in
`@internal/migration-tools` (see its `spaces` export at
`packages/1-framework/3-tooling/migration/src/exports/spaces.ts`).

## What this exists for

The framework's per-space planner / runner / verifier needs at least one
schema-contributing extension to exercise end-to-end. Real consumers
(cipherstash, pgvector) land in later milestones; this fixture is the
purpose-built scaffolding that exercises:

- The `contractSpace` descriptor field on `SqlControlExtensionDescriptor`.
- Per-space migration emission under `migrations/<space-id>/`.
- Pinned per-space artefacts (`contract.json`, `contract.d.ts`, `refs/head.json`).
- The verifier's orphan-marker / orphan-pinned-dir / declared-but-unmigrated cases.
- The `node_modules`-deleted scenario (apply / verify must succeed reading
  only the user repo, no descriptor import).

## Why a test-tree fixture rather than a workspace package

Earlier iterations hosted this surface as `@internal/extension-test-contract-space`
under `packages/3-extensions/`. The `extension-` prefix is reserved for
production extensions (pgvector, cipherstash, arktype-json), and a fixture
sitting in that directory was structurally indistinguishable from a real
extension. The fixture's actual job — providing a typed `contractSpace`
value the framework's helpers can be exercised against — does not require
a workspace package. Keeping it under the integration-tests workspace's
`test/` tree both removes the misleading "real extension" signal and keeps
the fixture visible alongside the tests that consume it.
