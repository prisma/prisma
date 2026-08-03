# SQL ORM — Many-to-Many End to End — Plan

**Spec:** `projects/sql-orm-many-to-many/spec.md`
**Linear Project:** [SQL ORM: Many-to-Many End to End](https://linear.app/prisma-company/project/sql-orm-many-to-many-end-to-end-c178df40ca3a) (planning record: TML-2597, `Plan: …`, Done)

## At a glance

**Runtime core (slices 0–3, complete):** one **foundation slice** (slice 0) makes M:N a validatable contract shape and surfaces the shared `through` descriptor, then a **three-way parallel fan-out** — read, filter, write — each consuming slice 0's hand-off.

**Follow-on (slices 4–6, added 2026-06-02):** demo examples + authoring-surface completeness — SQLite demo examples (done), PSL M:N authoring (a framework gap surfaced while adding the demos), and PG demo examples (blocked by the PSL work). See [§ Follow-on slices](#follow-on-slices--authoring-completeness--demos).

## Composition

### Stack (deliver in order)

1. **Slice `00-contract-resolver-foundation`** — Linear: [TML-2784](https://linear.app/prisma-company/issue/TML-2784)
   - **Outcome:** An M:N relation (`rel.manyToMany` with `through`) emits a contract that round-trips `validateContract`; the shared resolver surfaces a uniform `through` descriptor (and the junction's required-non-FK-column info); the cardinality tag is canonicalised on `'N:M'` repo-wide.
   - **Builds on:** None (correlated-only read path from TML-2729 / TML-2657 already on `main`).
   - **Hands to:** (a) a validatable M:N contract shape — `through: { table, parentColumns, childColumns }` declared in the JSON schema + arktype validator + `ContractReferenceRelation` type; (b) `ResolvedRelation.through` + required-payload-column info on `resolveModelRelations`; (c) a single `'N:M'` cardinality tag with no `'M:N'` left in sql-orm-client.
   - **Focus:** contract surface (`packages/2-sql/1-core/contract` validator, `data-contract-sql-v1.json`, `ContractReferenceRelation` type, delete the `as ContractRelation['cardinality']` cast in `build-contract.ts`) + the orm-client resolver. Reconcile the `parentCols/childCols` field-name drift to `parentColumns/childColumns`. Does **not** teach any consumer (read/filter/write) to use `through` — that's slices 1–3. `pnpm fixtures:check` regen is in-scope.

### Parallel group (each builds on slice 0; mutually independent)

- **Slice `01-correlated-read-through-junction`** — Linear: [TML-2785](https://linear.app/prisma-company/issue/TML-2785)
  - **Outcome:** `db.orm.User.include('tags')` returns `{ …user, tags: Tag[] }` for an M:N relation, in a single SQL execution (one correlated subquery walking the junction, no LATERAL).
  - **Builds on:** Slice 0's `ResolvedRelation.through`.
  - **Hands to:** the include-projection junction-walk pattern (a reference for how filter/write traverse `through`).
  - **Focus:** extend `buildCorrelatedIncludeProjection` (`query-plan-select.ts`) to correlate parent → junction → target; PG + SQLite integration tests. No LATERAL, no multi-query.

- **Slice `02-filter-exists-through-junction`** — Linear: [TML-2786](https://linear.app/prisma-company/issue/TML-2786)
  - **Outcome:** `.filter((u) => u.tags.some/every/none(...))` emits an EXISTS subquery that walks the junction for M:N relations.
  - **Builds on:** Slice 0's `ResolvedRelation.through`.
  - **Hands to:** correctly-shaped M:N relation filters (consumed by any query using `.some/.every/.none`).
  - **Focus:** teach `buildJoinWhere` / `createRelationFilterAccessor` (`model-accessor.ts`) to add the junction hop; PG + SQLite integration.

- **Slice `03-nested-write-through-junction`** — Linear: [TML-2787](https://linear.app/prisma-company/issue/TML-2787)
  - **Outcome:** Nested `connect` / `disconnect` / `create` over M:N route to junction INSERT / DELETE under both `create()` and `update()`; nested `.create` over a required-payload junction is disabled at types **and** runtime.
  - **Builds on:** Slice 0's `ResolvedRelation.through` + required-payload-column info.
  - **Hands to:** the relation-shaped M:N write API (the shape the Pothos plugin wires against).
  - **Focus:** remove the `partitionByOwnership()` "not supported yet" guard; route M:N as junction writes (not parent-/child-owned); flip the rejection unit test to positive; the type-level `.create` disable on required-payload junctions is its own dispatch. **Heaviest slice — re-check *Small* at `drive-plan-slice`; split the type-level disable into its own slice if it doesn't hold as one review.**

## Dependencies (external)

- [x] Correlated-only read path (TML-2729, PR #667) landed on `main` — slice 1 extends `buildCorrelatedIncludeProjection`, which exists.
- [x] Single-query mutation read-back (TML-2657) landed — no multi-query stitcher to reconcile.

## Sequencing rationale

Slice 0 is a hard gate, not a stylistic choice: until the contract validates an M:N relation and the resolver surfaces `through`, slices 1–3 have no validatable integration fixture to test against and nothing to read `through` from. Once slice 0 lands, the three consumers touch disjoint files (`query-plan-select.ts` / `model-accessor.ts` / `mutation-executor.ts`) and share only the read-only `ResolvedRelation.through` field — no write-write contention — so they parallelise cleanly. They are sequenced after 0 purely by data dependency, not by reviewer pacing.

## Follow-on slices — authoring completeness + demos

Added 2026-06-02 after the runtime core (0–3) shipped: while adding M:N **demo examples** we found the navigable M:N API is authorable **only via the TS contract builder** (`rel.manyToMany`), not PSL — so the PG demo (PSL-emitted) can't yet show it. These slices close that gap. Each is its own slice spec under `slices/`.

- **Slice `04-sqlite-demo-examples`** — Linear: [TML-2790](https://linear.app/prisma-company/issue/TML-2790) — **DONE.**
  - **Outcome:** the SQLite demo (`examples/prisma-8-demo-sqlite`, TS-authored) demonstrates the full M:N API: `Post ↔ Tag` via `PostTag`, with include / `some`/`none`/`every` filter / nested `connect`/`disconnect`/`create` ORM modules + CLI commands + seed, smoke-tested end-to-end.
  - **Builds on:** slices 0–3 (the runtime M:N feature).
  - **Hands to:** a worked reference for the M:N ORM API (the PG demo, slice 6, mirrors it once unblocked).

- **Slice `05-psl-many-to-many-authoring`** — Linear: [TML-2794](https://linear.app/prisma-company/issue/TML-2794) — **planned.**
  - **Outcome:** PSL can author a navigable M:N relation — the interpreter lowers a junction (explicit `@@id([a,b])` join model and/or implicit `Tag[]` list) to `cardinality:'N:M'` + a `through` descriptor, parity with the TS builder.
  - **Builds on:** slice 0's contract `through` shape (the lowering target).
  - **Hands to:** PSL-authored M:N → unblocks the PG demo (slice 6).
  - **Focus:** `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` (today emits only `N:1`/`1:N`) + the PSL→RelationNode lowering; recognise/collapse the junction into a `through` relation. **Likely large — re-check slice-INVEST at pickup; may warrant promotion to its own project.**

- **Slice `06-pg-demo-examples`** — Linear: [TML-2795](https://linear.app/prisma-company/issue/TML-2795) — **planned, blocked by slice 5.**
  - **Outcome:** the PG demo (`examples/prisma-8-demo`) demonstrates the M:N API (mirroring slice 4), AND its pre-existing dual-mode contract drift (stale TS source / missing TS-builder discriminator authoring) is reconciled.
  - **Builds on:** slice 5 (PSL M:N authoring — the PG demo emits from PSL); slice 4 (the example shape to mirror).
  - **Hands to:** M:N demonstrated in both demos; dual-mode green.
  - **Focus:** add `Post ↔ Tag` M:N to the PSL source + example modules/CLI/seed/tests; resolve dual-mode (`test:dual-mode` is currently red on the TS leg — fix the TS source or drop it). The dual-mode-drift half is independent of slice 5 and can start first.

- **Slice `07-non-id-unique-junction-targets`** — Linear: [TML-2933](https://linear.app/prisma-company/issue/TML-2933) — **planned** (deferred from slice 5, surfaced in PR #819 review).
  - **Outcome:** an M:N junction whose target-side FK references a **non-id, non-null `@unique`** key (not the target's `@id`) lowers to `cardinality:'N:M'` + a `through` whose `targetColumns` are the **referenced** key — via both PSL and TS-builder authoring, with `sql-orm-client` runtime parity.
  - **Builds on:** slice 0's `through` shape; slice 5's PSL junction recognition (this relaxes its `@id`-only constraint).
  - **Hands to:** full M:N target-key flexibility (junctions need not point at the target's `@id`).
  - **Focus:** rework `through.targetColumns` derivation to follow the FK's true referenced key in **both** lowering paths — `targetColumnsForJunction` (`contract-ts/src/build-contract.ts`) and `childColumnsInTargetIdOrder`/`findJunctionFkPairs` (`contract-psl/src/psl-relation-resolution.ts`); relax the `PSL_JUNCTION_TARGET_FK_NOT_ID` decline; PG + SQLite runtime parity. Today the PSL path declines (silently-wrong JOIN if relaxed alone), and the TS path derives `targetColumns` from `@id` ignoring which key the FK references.

### Sequencing (follow-on)

Slice 4 (done) and the **dual-mode-drift half of slice 6** are independent and could have run anytime after the core. Slice 5 (PSL authoring) gates the **M:N-examples half of slice 6**. Slice 7 (non-id unique junction targets) builds on slice 5's PSL junction recognition and is independent of slice 6 — it can run anytime after slice 5. Note this pushes the project to **8 slices** — well past the 1–4 sweet spot; slices 5 and 7 are framework-scoped and may be better promoted to their own project at pickup (flagged above).
