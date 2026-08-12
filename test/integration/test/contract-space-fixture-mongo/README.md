# test-mongo-contract-space (fixture)

Integration-tests fixture exercising the **contract-space mechanism**
against the Mongo family. Companion to
[`test/integration/test/contract-space-fixture/`](../contract-space-fixture/),
which provides the SQL counterpart; the two share a structural shape
so the same end-to-end pipeline (planner → runner → verifier) can be
exercised against either family.

## What this exists for

The framework's per-space planner / runner / verifier needs at least
one schema-contributing Mongo extension to exercise end-to-end. Real
Mongo consumers will land in later milestones; this fixture is the
purpose-built scaffolding that exercises:

- The `contractSpace` descriptor field on
  `MongoControlExtensionDescriptor`.
- Per-space migration emission under `migrations/<space-id>/`.
- Pinned per-space artefacts (`contract.json`, `contract.d.ts`,
  `refs/head.json`) for a Mongo contract.
- The aggregate runner's per-space marker advance with strict
  post-apply `db verify`.
- The verifier's per-space remediation hints when a fixture-owned
  collection drifts from its pinned contract.

The exposed schema declares a single `test_audit_event` collection
with one unique index and one strict JSON-schema validator — the
smallest non-empty Mongo schema that exercises both the index and
validator surfaces of `MongoStorageCollection`.

## Why a test-tree fixture rather than a workspace package

Mirrors the rationale of the SQL fixture: the `extension-` prefix is
reserved for production extensions, and a fixture sitting under
`packages/3-extensions/` would be structurally indistinguishable from
a real extension. The fixture's actual job — providing a typed
`contractSpace` value the framework's helpers can be exercised
against — does not require a workspace package. Keeping it under the
integration-tests workspace's `test/` tree both removes the misleading
"real extension" signal and keeps the fixture visible alongside the
tests that consume it.
