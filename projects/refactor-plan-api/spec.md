# Summary

Collapse `MigrationPlanner.plan({ fromHash, fromContract })` into a single `fromContract` input so that "I have a hash without a contract" becomes structurally unrepresentable on the planning hot path. Replaces TML-2275's literal proposal (which asks `db update` to forward an "origin contract hash" it does not actually possess) with a deeper modeling fix that makes reconciliation-vs-authoring asymmetry explicit at the type level.

# Description

## Background

`MigrationPlanner.plan(...)` is the single planning entrypoint shared by four CLI commands:

- `migration plan` — scaffolds a `migration.ts` package on disk (authored migration).
- `migration new` — same, but with an empty stub. Uses `plan()` only for the data-safety path; primarily uses `emptyMigration(...)`.
- `db init` — bootstraps a database from introspection. Does not write `migration.ts`.
- `db update` — pure reconciliation (introspect → diff → apply). Does not write `migration.ts`.

`plan(...)` accepts both `fromHash: string | null` and `fromContract?: unknown`. These are redundant: wherever a meaningful `fromHash` is passed, the caller has already derived it from the same source as `fromContract` (a previously-written migration bundle's `metadata.toContract` / `metadata.to`). They cannot disagree.

Today's call sites:

| Command | `fromContract` available? | `fromHash` passed | `toContract` available? |
|---|---|---|---|
| `migration plan` — first migration ever | no (`null`) | `null` | yes |
| `migration plan` — subsequent | yes (`bundle.metadata.toContract`) | `bundle.metadata.to` | yes |
| `migration plan --from <hash>` | yes (resolved bundle) | bundle's `metadata.to` | yes |
| `migration new` — uses `emptyMigration({ fromHash, toHash })` (separate path) | n/a for `plan()` | n/a for `plan()` | n/a |
| `db init` | **structurally unavailable** | `null` | yes |
| `db update` | **structurally unavailable** | `null` | yes |

`db init` and `db update` cannot have a `fromContract`: their "from state" is a live introspected `SchemaIR`, not a contract. Even when `db update` finds a marker, the marker carries hashes (`storageHash`, `profileHash`) but **not the original contract**. There is no way to materialize a `fromContract` in those commands — by design, not by oversight.

## Why TML-2275's literal proposal is wrong

TML-2275 asks `db update` to "pass the actual origin storage hash we already have (the workspace's current contract hash), not the empty-string placeholder". The only "origin hash" `db update` could plausibly source is the marker's `storageHash`. Forwarding that to the planner would mean threading a hash *without* the corresponding `Contract` — exactly the orphan-hash anti-pattern that `fromContract`'s presence on the same API was meant to make redundant. It would also re-introduce the smell the ticket set out to remove: a magic value where the schema implies one isn't possible.

## What this project does instead

Remove `fromHash` from `MigrationPlanner.plan(...)`. Keep `fromContract`. The planner derives any `from` identity it needs to stamp onto `MigrationPlan.describe()` as `fromContract?.storage.storageHash ?? null`.

After the change:

- `db init` / `db update` simply omit `fromContract` (or pass `null`). The structural fact "there is no prior contract" is honest in the type.
- `migration plan` passes `fromContract` (already does) and stops passing the redundant `fromHash`.
- `MigrationScaffoldContext.fromHash` (used by `emptyMigration(...)` for `migration new`) is **untouched**. The empty-scaffold path has no contract to point at; passing a hash is the right shape there.

Net result: the `plan()` API expresses the correct invariant — "from identity is contract-shaped or absent" — and the marker-as-fromHash temptation becomes impossible to express.

# Requirements

## Functional Requirements

- `MigrationPlanner.plan(...)` no longer accepts a `fromHash` parameter. It accepts `fromContract: Contract | null` — **required**, no `?`. The type is `Contract | null` (not `unknown`); `framework-components` already imports `Contract` from `@internal/contract/types`, so there is no layering obstacle.
- All three target planners (postgres, sqlite, mongo) implement the new shape and derive `from` for `describe()` stamping from `fromContract?.storage.storageHash ?? null`.
- `db-init` and `db-update` pass `fromContract: null` explicitly. The required parameter forces every call site to make the "I have one / I don't" distinction visible.
- `migration plan` no longer passes `fromHash`; passes `fromContract` (already does today) as the sole "from" identity input to `plan()`.
- `migration new`'s `plan()` invocation (the data-safety path, if any) follows the same convention. The `emptyMigration(...)` invocation is unchanged; `MigrationScaffoldContext.fromHash` stays.
- `Migration.origin` continues to derive from `describe().from === null ? null : { storageHash: from }` (already correct; no change required).

## Non-Functional Requirements

- **No observable behaviour changes.** Identical SQL/operations emitted; identical `migration.json` contents; identical CLI exit codes.
- **No layering violations.** `MigrationPlanner` lives in `framework-components`; if directly typing `fromContract` as `Contract` violates the import graph, keep `unknown` and document that planners are responsible for narrowing.
- **Test coverage is preserved or improved.** Existing planner tests are migrated; no test is silently dropped.

## Non-goals

- **Not changing `MigrationScaffoldContext.fromHash`.** Empty-migration scaffolding has no `fromContract` to derive from; the hash is the right input there. Document the asymmetry, do not "fix" it.
- **Not adding marker reads to `db update`.** That was TML-2275's literal ask; this project supersedes it. `db update` continues to read the marker only post-apply (for writing).
- **Not changing `migration.json` schema.** `from`, `fromContract`, `toContract` bookends remain as today.
- **Not deprecating or renaming `fromHash` in any other API surface** (`MigrationScaffoldContext`, `MigrationMeta`, `MigrationMetadata`, on-disk schemas). Scope is `MigrationPlanner.plan(...)` only.
- **Not addressing the broader question of removing `fromContract`/`toContract` bookends from `migration.json`** (TML-2274 covers that).

# Acceptance Criteria

- [ ] `MigrationPlanner.plan(...)` interface in `@internal/framework-components/control` has no `fromHash` field and declares `fromContract: Contract | null` (required, typed).
- [ ] No production code in `packages/**/src/**` passes `fromHash` to a `plan(...)` call.
- [ ] No production code in `packages/**/src/**` compares against `fromHash === ''` or `fromHash === null` as a "baseline" sentinel inside `plan(...)` callers (the check should not exist; baseline is implicit in `fromContract === null`).
- [ ] All three target planners (postgres, sqlite, mongo) derive `describe().from` from `fromContract?.storage.storageHash ?? null`.
- [ ] `db-init` and `db-update` invoke `plan(...)` with `fromContract: null` explicitly; the produced `MigrationPlan.origin` is `null` in both cases (verified by tests).
- [ ] `migration plan` produces `migration.json` whose `from` matches `fromContract.storage.storageHash` (when a prior bundle exists) or `null` (when no prior bundle exists).
- [ ] Existing migration end-to-end and integration tests pass without modification of fixtures (other than removing `fromHash` from direct planner calls).
- [ ] `MigrationScaffoldContext.fromHash` is unchanged.
- [ ] `Migration.origin` is unchanged (still derives from `describe().from`).

# Other Considerations

## Security

N/A — no auth, encryption, or trust-boundary changes.

## Cost

N/A — no runtime cost change. Saves trivial CPU (one fewer field threaded through plan invocations).

## Observability

No metrics/logging changes. Planner contract changes do not surface in CLI output.

## Data Protection

N/A.

## Analytics

N/A.

## Migration / rollout

- This is an **internal API change**. No public API consumers exist outside the monorepo today (the CLI commands, planners, and tests are all in-tree).
- Single PR. No flag, no deprecation window.
- If we discover an out-of-tree consumer mid-implementation, stop and re-scope.

# References

- Linear: [TML-2275](https://linear.app/prisma-company/issue/TML-2275/model-no-origin-contract-baseline-origin-properly-across-db) — the originating ticket (this project supersedes its proposal).
- PR review threads on [PR #354](https://github.com/prisma/prisma-next/pull/354) — original surfacing of the empty-string sentinel smell.
- Related: TML-2274 — removal of `fromContract`/`toContract` bookends from `migration.json` (out of scope here, but worth coordinating sequencing).

## Implementation touchpoints

- `packages/1-framework/1-core/framework-components/src/control/control-migration-types.ts` — `MigrationPlanner.plan(...)` interface
- `packages/3-targets/3-targets/postgres/src/core/migrations/planner.ts`
- `packages/3-targets/3-targets/sqlite/src/core/migrations/planner.ts`
- `packages/3-mongo-target/1-mongo-target/src/core/mongo-planner.ts`
- `packages/1-framework/3-tooling/cli/src/control-api/operations/db-init.ts`
- `packages/1-framework/3-tooling/cli/src/control-api/operations/db-update.ts`
- `packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts`
- `packages/1-framework/3-tooling/cli/src/commands/migration-new.ts` (only the `plan()` invocation, not `emptyMigration()`)
- Direct planner tests under `packages/3-targets/**/test/migrations/planner.*.test.ts` and `packages/3-mongo-target/**/test/mongo-planner.test.ts`

# Open Questions

_Resolved during spec drafting. Recorded here for traceability:_

1. **Type the `fromContract` parameter precisely or keep `unknown`?** **Resolved: type as `Contract | null`.** `framework-components` already imports `Contract` from `@internal/contract/types` (incl. in `control-migration-types.ts` itself); there is no layering obstacle.
2. **Make `fromContract` required on `plan()`?** **Resolved: yes, required (no `?`).** All four `plan()` call sites must pass it explicitly. `db init`/`db update` pass `null`.
3. **Drop the parameter or pass `null` from `db init`/`db update`?** **Resolved: pass explicit `null`** (consequence of #2).
