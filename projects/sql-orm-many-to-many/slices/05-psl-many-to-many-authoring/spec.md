# Slice 5: PSL many-to-many authoring

_Parent project: `projects/sql-orm-many-to-many/`. Linear: [TML-2794](https://linear.app/prisma-company/issue/TML-2794). Status: **in progress** (branch `tml-2794-slice-5-psl-mn-authoring`, stacked on `tml-2790-mn-demo-examples`)._

> **Sizing flag:** this is framework-scoped (the PSL interpreter), not an `sql-orm-client` change. It may fail slice-INVEST *Small* and warrant **promotion to its own project**. Re-check at pickup (`drive-triage-work`); the dispatch plan below is provisional pending PSL-pipeline grounding.

## At a glance

PSL can't author a navigable M:N relation. The PSL relation resolver emits only `cardinality:'N:1'`/`'1:N'`; `'N:M'` + `through` comes only from the TS builder (`rel.manyToMany`). PSL routes M:N to explicit junction models (`PSL_ORPHANED_BACKRELATION`). This slice teaches PSL to lower a junction to a navigable `N:M` + `through`, so PSL-authored schemas get the same M:N ORM API (and the PG demo, slice 6, becomes possible).

## Chosen design (intent — to be firmed at pickup)

Teach the PSL interpreter / lowering to recognise a many-to-many shape and emit a relation with `cardinality:'N:M'` + a `through` descriptor (`{ table, parentColumns, childColumns, targetColumns }`) — the exact shape slice 0 put in the contract and `sql-orm-client`'s `resolveThrough` consumes. Two candidate authoring forms (decide at spec-firm-up):

1. **Explicit junction model** — an `@@id([a, b])` join model with two FK relations (the shape PSL currently emits as three `1:N`/`N:1` relations) is recognised and *additionally* surfaced as a navigable `N:M` on each side. Lowest-magic; matches what the diagnostic already steers authors toward.
2. **Prisma-style implicit list** — `tags Tag[]` / `posts Post[]` with no explicit junction, lowered to an implicit junction table. More ergonomic, more interpreter work.

Primary surface: `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` (today emits `N:1` at ~line 255, `1:N` at ~line 322 — no `N:M`/`through`) + the PSL→RelationNode lowering + the `PSL_ORPHANED_BACKRELATION` diagnostic (relax/replace when the junction is recognised).

## Scope

**In:** PSL relation resolution + lowering to emit `N:M` + `through`; the M:N PSL diagnostic; PSL-authored M:N fixtures/tests; round-trip through `validateContract`.

**Out:** `sql-orm-client` runtime (already done, slices 0–3 — consumes `through` regardless of author); the TS builder (already emits `through`); the PG demo (slice 6).

## Pre-investigated edge cases

| Edge case | Disposition |
|---|---|
| Composite-key junctions | `through.{parentColumns,childColumns,targetColumns}` are arrays — lowering must handle multi-column FKs (parity with the TS builder) |
| Self-referential M:N (e.g. User↔User followers) | confirm the lowering handles same-model both-sides |
| Existing `PSL_ORPHANED_BACKRELATION` consumers | relaxing the diagnostic must not regress schemas that legitimately want explicit-junction 1:N modelling |

## Slice-specific done conditions

- [x] A PSL schema with a junction (form 1: explicit junction + bare lists) emits a relation with `cardinality:'N:M'` + populated `through`, round-tripping `validateContract` (commits `4be25be61`, `89da059ce`; `interpreter.relations.many-to-many.test.ts`, 10 tests).
- [x] ORM-API parity: `include` / `some`/`none`/`every` / nested write work from a PSL-authored M:N contract (`fixtures/mn-psl/` + `mn-psl-parity.test.ts`, 8 integration tests; commits `079093820`, `0166dfa03`).
- [x] `fixtures:check` green with mn-psl wired into the emit pipeline (commit `864b2ad77`); diagnostic correct — orphaned-list kept for unrecognised shapes, ambiguity diagnostic for symmetric self-referential lists.

## Open Questions — RESOLVED at pickup (2026-06-12, unattended; see `wip/unattended-decisions.md` #12)

1. **Authoring form** — **form 1 only** (explicit-junction recognition); implicit-list dropped from this slice (clean follow-up if desired).
2. **Project vs slice** — built as a slice per operator instruction (stacked PR onto slice 4); halt rather than grow if it exceeds the 2-dispatch plan.

## References

- Parent: `projects/sql-orm-many-to-many/spec.md` (§ Follow-on scope). Slice 0's contract `through` shape is the lowering target.
- `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts`; the TS builder's `rel.manyToMany` lowering (`contract-lowering.ts`) as the parity reference.
