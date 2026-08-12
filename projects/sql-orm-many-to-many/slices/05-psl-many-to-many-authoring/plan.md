# Slice 5: PSL M:N authoring — Dispatch plan (provisional)

**Spec:** `projects/sql-orm-many-to-many/slices/05-psl-many-to-many-authoring/spec.md`
**Linear:** [TML-2794](https://linear.app/prisma-company/issue/TML-2794)

> **Provisional** — the dispatch breakdown depends on PSL-pipeline grounding not yet done (the PSL interpreter / lowering / diagnostic interaction). Firm up at pickup via `drive-specify-slice` + `drive-plan-slice`; **re-check whether this is a slice or a project** (it's framework-scoped). The breakdown below is the expected shape.

### Dispatch 1: PSL junction → `N:M` + `through` lowering

- **Outcome:** the PSL relation resolver/lowering recognises a junction (explicit `@@id([a,b])` join model — form 1) and emits a relation with `cardinality:'N:M'` + a populated `through` descriptor (composite-key-correct), parity with the TS builder. Unit-tested at the lowering level.
- **Builds on:** slice 0's contract `through` shape (the target); the TS builder's `rel.manyToMany` lowering as the parity reference.
- **Hands to:** PSL emits navigable M:N relations.
- **Focus:** `psl-relation-resolution.ts` + the PSL→RelationNode lowering; the `PSL_ORPHANED_BACKRELATION` diagnostic (relax when a junction is recognised, without regressing legitimate explicit-junction 1:N use).

### Dispatch 2: PSL M:N fixture + ORM-API parity tests

- **Outcome:** a PSL-authored M:N fixture round-trips `validateContract`, and the M:N ORM API (include / `some`/`none`/`every` / nested write) works against it — parity with the TS-authored `User↔Tag` fixture.
- **Builds on:** dispatch 1.
- **Hands to:** proven PSL→ORM M:N parity → unblocks the PG demo (slice 6).
- **Focus:** a PSL fixture mirroring the TS M:N fixture; integration tests (reuse the slice-1/2/3 M:N test patterns); `fixtures:check`.

### Dispatch 3 (conditional): implicit-list authoring

- **Outcome:** Prisma-style implicit `Tag[]`/`Post[]` M:N (no explicit junction) lowers to an implicit junction. **Only if Open Question 1 chooses to include it** — otherwise drop (form 1 alone satisfies the slice).

## Handoff completeness

Slice-DoD reachable: PSL emits `N:M`+`through` (D1) · ORM-API parity from a PSL contract (D2). D2's hand-off (PSL M:N parity) is what slice 6 (PG demo) needs.
