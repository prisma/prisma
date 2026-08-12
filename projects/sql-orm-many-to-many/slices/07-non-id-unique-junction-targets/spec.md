# Slice 7: non-id non-null unique junction targets

_Parent project: `projects/sql-orm-many-to-many/`. Linear: [TML-2933](https://linear.app/prisma-company/issue/TML-2933). Status: **planned** (deferred from slice 5 / TML-2794, surfaced in PR [#819](https://github.com/prisma/prisma-next/pull/819) review)._

## At a glance

A many-to-many junction whose **target-side** FK references a **non-id, non-null `@unique`** key (rather than the target model's `@id`) is not supported. PSL declines such junctions, and the shared lowering would emit a silently-wrong JOIN if PSL recognition were relaxed in isolation. This slice reworks `through.targetColumns` derivation to follow the FK's **true referenced key** across both authoring paths, with runtime parity coverage.

## The finding (PR #819 review)

A reviewer asked why a junction referencing a non-id, non-null `@unique` target key is unsupported. From the code:

- **PSL declines it.** M:N junction recognition (`packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts`, `childColumnsInTargetIdOrder`) requires the junction's child FK to reference **exactly** the target model's `@id` columns; otherwise it declines with the `PSL_JUNCTION_TARGET_FK_NOT_ID` diagnostic.
- **Why it can't just be relaxed.** The shared lowering derives `through.targetColumns` from the target's `@id` via `targetColumnsForJunction` in `packages/2-sql/2-authoring/contract-ts/src/build-contract.ts` — it is **ignorant of which key the FK actually references**. A junction referencing a non-`@id` unique while the target also has an `@id` would emit a `through` whose `targetColumns` are the `@id`, not the referenced unique → a **silently wrong JOIN**.
- **The precise gap.** `targetColumnsForJunction` already falls back to the first unique when the target has **no `@id` at all**. The unsupported case is a target that **has** an `@id` but whose junction FK references a **different** non-null `@unique` key.
- **Why deferred (not relaxed in slice 5).** Supporting this properly reworks `through.targetColumns` derivation across **both** the PSL and TS-builder lowering paths plus runtime parity coverage — crossing slice 5's stated boundary (`Out: sql-orm-client runtime` and the lowering it leans on). So it is its own slice.

## Chosen design (intent — to be firmed at pickup)

Derive `through.targetColumns` from the **key the junction's child FK actually references**, not unconditionally from the target's `@id`, in both lowering paths:

- **TS builder** (`build-contract.ts`, `targetColumnsForJunction`): resolve `targetColumns` from the referenced key of the `through` FK rather than always preferring `@id`. The existing no-`@id`-falls-back-to-first-unique behaviour becomes a special case of "follow the referenced key."
- **PSL** (`psl-relation-resolution.ts`, `childColumnsInTargetIdOrder` + `findJunctionFkPairs`): recognise junctions whose child FK references a non-null `@unique` key (not only the `@id`), ordering `childColumns` by the referenced key's columns; relax / replace the `PSL_JUNCTION_TARGET_FK_NOT_ID` decline so it fires only for genuinely unrecognisable shapes.
- **Runtime parity** (`sql-orm-client`): confirm include / filter / nested write walk the junction through the referenced unique key — PG + SQLite integration fixtures.

## Scope

**In:** `through.targetColumns` derivation following the FK's referenced key in **both** the PSL and TS-builder lowering paths; the `PSL_JUNCTION_TARGET_FK_NOT_ID` diagnostic relaxation; fixtures/tests for a junction referencing a non-id non-null unique target key; round-trip through `validateContract`; `sql-orm-client` runtime parity coverage (include / filter / nested write).

**Out:** new M:N authoring forms beyond the referenced-key change (implicit lists etc. — slice 5 territory); **nullable** unique target keys (a unique target key must be non-null to be a valid FK reference — out of scope, decline as today); the demos (slices 4 / 6); any non-M:N relation path.

## Pre-investigated edge cases

| Edge case | Disposition |
|---|---|
| Target has an `@id` AND the junction FK references a different non-null unique | the core case — `targetColumns` must follow the referenced unique, not the `@id` |
| Target has no `@id`, junction FK references its only unique | already works via the `targetColumnsForJunction` first-unique fallback; the rework must not regress it |
| Composite non-null unique referenced by the child FK | `through.{childColumns,targetColumns}` are arrays — preserve referenced-key column order (parity with the existing `childColumnsInTargetIdOrder` ordering) |
| Nullable unique referenced by the FK | out of scope — a junction FK reference must be non-null; keep declining |
| Multiple non-null uniques on the target, FK references one of them | follow the *referenced* key specifically — never guess "first unique" when an `@id` or another unique also exists |
| `PSL_JUNCTION_TARGET_FK_NOT_ID` consumers | relaxing the decline must keep it firing for FKs that reference no valid full key (genuinely unrecognisable shapes) |

## Slice-specific done conditions

- [ ] A junction whose target-side FK references a non-id, non-null `@unique` key emits `cardinality:'N:M'` + a `through` whose `targetColumns` are the **referenced unique** columns (not the target's `@id`), via **both** PSL and TS-builder authoring, round-tripping `validateContract`.
- [ ] `db.orm.<Model>.include(<m2n>)` / `.filter(m => m.<m2n>.some/none/every(...))` / nested `connect`/`disconnect`/`create` walk the junction through the referenced key correctly — PG + SQLite integration tests, per the project's integration-test standard (whole-row assertions, explicit select, ≥1 implicit).
- [ ] `PSL_JUNCTION_TARGET_FK_NOT_ID` no longer fires for a junction whose child FK references a valid non-null unique key; it still fires for genuinely unrecognisable shapes (regression test on a declined shape).
- [ ] `fixtures:check` green with any new fixture wired into the emit pipeline.

## References

- Parent: `projects/sql-orm-many-to-many/spec.md` (§ Follow-on scope, § Cross-cutting integration-test standard). Slice 0's `through` shape and slice 5's PSL junction recognition are what this extends.
- PR [#819](https://github.com/prisma/prisma-next/pull/819) (review finding); deferred from slice 5 / [TML-2794](https://linear.app/prisma-company/issue/TML-2794).
- Primary surfaces: `packages/2-sql/2-authoring/contract-ts/src/build-contract.ts` (`targetColumnsForJunction`); `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` (`childColumnsInTargetIdOrder`, `findJunctionFkPairs`, `PSL_JUNCTION_TARGET_FK_NOT_ID`).
