# Slice 3: nested writes (connect/disconnect/create) through the junction

_Parent project: `projects/sql-orm-many-to-many/`. Outcome: nested `connect`/`disconnect`/`create` over an M:N relation become junction-table writes; nested `.create` on a required-payload junction is disabled at types **and** runtime._

## At a glance

`db.orm.User.update({ tags: (t) => t.connect({ id }) })` / `.disconnect(...)` / nested `create` must route to the `UserTag` junction (INSERT / DELETE / insert-target-then-link), under both `create()` and `update()`. Today `partitionByOwnership` (`mutation-executor.ts:351`) throws `'N:M nested mutations are not supported yet'`. This slice lifts that guard and adds a **junction-owned** write path. Separately, when a junction carries **required non-FK payload columns** (which the M:N sugar can't populate), nested `.create` through the sugar is **disabled at the type level and at runtime**, pointing users to the junction model's own relations / the SQL builder (per the project non-goals).

## Chosen design

**Runtime — a third ownership bucket.** `partitionByOwnership` gains `junctionOwned` (relations carrying `through`) alongside `parentOwned`/`childOwned`. The `create()` and `update()` graph flows execute junction mutations **after** the parent row exists (parent PK known):
- **`connect({criteria})`** → resolve target row(s) by criteria, `INSERT INTO junction (parentCols, childCols) VALUES (parentPk, targetPk)` per pair. Connecting an already-linked pair **deliberately errors** (wrapped unique-violation domain error) — an intentional divergence from Prisma-classic implicit-M:N `connect`, which is idempotent (`ON CONFLICT DO NOTHING`); see the edge-case table. _(Recorded during round-3 review.)_
- **`disconnect({criteria})`** → `DELETE FROM junction WHERE parentCols = parentPk AND childCols = targetPk`.
- **`create(data)`** → insert the target row, then INSERT the junction link. (Only when the junction has no required payload — see the guard.)
- `disconnect` stays gated to `update()` (existing rule); `connect`/`create` work in both flows. The currently-passing **rejection unit test flips to a positive assertion**.

**Required-payload guard — types + runtime.** When the junction has required non-FK columns (NOT NULL, no default, not a FK), the M:N sugar cannot supply them on any operation that **writes a junction row** — that's **both `create` and `connect`** (each INSERTs a `(parent, child)` junction row, leaving the required column unset → a DB NOT-NULL violation). `disconnect` (a DELETE) is unaffected. So both `create` and `connect` are disabled:
- **Runtime:** the junction-owned `create` **and `connect`** branches throw a clear error naming the offending columns + pointing to the junction model / SQL builder. Uses slice 0's `requiredPayloadColumns` (already on `ResolvedRelation`). `disconnect` stays allowed. _(Correction during execution — the original spec wrongly assumed `connect` was FK-pair-only safe; see `wip/unattended-decisions.md` #9.)_
- **Type level (operator-mandated, in-slice):** the relation-mutator's `create` input resolves to `never` (or `create` is omitted) for an M:N relation whose junction has required payload columns. **Open risk** (see below): this requires the *type* level to know the junction's required-payload columns; slice 0 computes `requiredPayloadColumns` at *runtime* only — the contract `.d.ts` `through` type does **not** carry it. The type-disable dispatch must either derive "junction has a required non-FK field" from the junction model's field types in `contract.d.ts`, or — if that's infeasible — **halt and surface** (it may require extending slice 0's emitted `through` to carry the flag at the type level, which is a scope/▲contract decision for the operator).

**Fixtures.** The pure `User ↔ Tag` junction (slice 1) covers connect/disconnect/create (no required payload). A **second** relation with a **required-payload junction** (e.g. `User ↔ Role` via `UserRole` with a required non-FK column like `level`) is added to the fixture to exercise the disable.

## Coherence rationale

One story: "M:N nested writes go through the junction, with the required-payload safety rail." The runtime routing, the rejection-test flip, the required-payload fixture, the type+runtime disable, and the integration tests are the connect/disconnect/create capability + its one guard — cohesive. The type-disable is its own dispatch (operator: type safety non-negotiable, kept in-slice).

## Scope

**In:** `partitionByOwnership` + the junction-owned write path in `mutation-executor.ts` (connect/disconnect/create, both flows); flipping the rejection unit test positive; the required-payload-junction fixture + re-emit; the type-level + runtime `.create` disable on required-payload junctions; write integration tests (per standard).

**Out:** `set` / `connectOrCreate` / nested `update`/`upsert`/`delete` related-row kinds (TML-2781); reading/writing payload columns through the sugar (non-goal); the reverse `Tag.users` direction (deferred — see project decision log).

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| `create()` parent flow vs `update()` | junction writes run after parent PK is known in **both**; `disconnect` stays `update()`-only (existing rule) | mirror the existing parent/child ownership flows |
| Composite-key junction | INSERT/DELETE across all `parentColumns`/`childColumns` pairs | slice 0 arrays |
| Required-payload junction | **`create` AND `connect` disabled** (both write a junction row that can't satisfy the required NOT-NULL column → DB violation); `disconnect` (DELETE) still allowed | corrected mid-flight — see decision #9 |
| **Type-level disable feasibility** | the `.d.ts` `through` type may not carry required-payload info — derive from junction field types, or **halt + surface** if infeasible (possible slice-0 contract extension) | the slice's key risk |
| Duplicate `connect` (junction link already present) | **deliberately errors** — the unique violation from the junction INSERT is wrapped in a domain error ("violated a unique constraint on junction …; the junction link may already be present") rather than silently skipped. Intentional divergence from Prisma-classic implicit-M:N `connect`, which is idempotent (`ON CONFLICT DO NOTHING`): erroring keeps the write path portable (no per-target upsert dialect) and surfaces caller bugs instead of masking them. Revisit only if idempotent connect becomes a requirement | recorded during round-3 review (reviewer asked for the divergence to land in the decision log) |

## Slice-specific done conditions

- [ ] `connect`/`disconnect`/`create` over the pure M:N relation route to junction INSERT/DELETE under both `create()` and `update()`; the `partitionByOwnership` guard is gone; the rejection unit test is flipped to a positive assertion.
- [ ] Nested `create` **and `connect`** on a **required-payload** junction are rejected **at runtime** (clear message) — and at the **type level** for `create` once the type-disable is unblocked (deferred, decision #8); `disconnect` on it still works.
- [ ] Integration tests (PGlite) per the standard: whole-row readback (via `include('tags')`) after connect/disconnect/create — whole-row `toEqual`, explicit `.select` in most, ≥1 implicit; cover both flows + the disable.

## Open Questions

1. **Type-level disable mechanism.** Working position: derive "junction has a required non-FK field" from the junction model's field types in `contract.d.ts` and resolve the mutator's `create` input to `never`. If `contract.d.ts` lacks the needed info, **halt and surface** — extending slice 0's emitted `through` (a contract-shape change) is an operator decision, not an unattended one.

## References

- Parent project: `projects/sql-orm-many-to-many/spec.md` (§ Cross-cutting — integration-test standard; § Non-goals).
- Slice 0 `ResolvedRelation.through.requiredPayloadColumns` (runtime); slice 1 fixture + read-back via `include`.
- `mutation-executor.ts` `partitionByOwnership` (~338) + the `create()`/`update()` graph flows; `relation-mutator.ts` `create` input type.
- Linear: [TML-2787](https://linear.app/prisma-company/issue/TML-2787)
