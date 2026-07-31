# Brief: S1-D2 R2 — finish the read-path correlation (continue from WIP)

## Situation

The first R1 implementer ran out of budget mid-dispatch and **did not commit**. There is **uncommitted WIP** in the working tree (run `git status` + `git diff` to see it):

- `src/types.ts` — `IncludeExpr` gained `through?` (likely done).
- `src/collection-contract.ts` — `resolveIncludeRelation` surfacing `through` (likely done).
- `src/collection.ts` — small change.
- `test/helpers.ts` — a `buildManyToManyContract` helper (was mid-edit when cut off — verify it's coherent).
- `test/query-plan-select.test.ts` — new M:N unit tests (written; the impl they assert is **missing**, so they currently fail).

**What's missing (the core task):** `query-plan-select.ts` (`buildCorrelatedIncludeProjection`) was **not touched** — the M:N junction-correlation branch is not implemented. The include-child decode (`collection-dispatch.ts`) may also be needed.

## Task

**First, read the uncommitted diff** to understand what R1 left. Then finish the dispatch:

1. Implement the M:N branch in `buildCorrelatedIncludeProjection` (`query-plan-select.ts`): when `include.through` is present, compile a **single correlated subquery** — target JOIN junction ON `junction.childColumns = target.targetColumns`, correlated to the parent on `junction.parentColumns = parent` anchor; AND across all column pairs for composite keys; **no `LATERAL`**.
2. Wire whatever include-child decode/graft is needed (`collection-dispatch.ts`) to aggregate `tags: Tag[]` — mirror the FK include path, don't fork it.
3. Reconcile the WIP test helper + unit tests so they pass and assert the AST shape (single correlated subquery through the junction, composite-key AND-ed, no `LATERAL`). If R1's test helper or tests are incoherent/incomplete, fix them.
4. Don't regress the FK include path.

## Completed when

- [ ] An M:N `include` compiles to a single correlated subquery through the junction (composite-key AND-ed); unit test asserts the AST + absence of `LATERAL`, and **passes**.
- [ ] FK include path unchanged (its tests pass).
- [ ] `pnpm --filter @internal/sql-orm-client typecheck` + `test` green.
- [ ] Committed as **one coherent commit** (the WIP + your completion together), explicit staging + `-s` sign-off, **no push**.

## Standing instruction

Finish the goal: the M:N correlated read. Keep R1's coherent WIP; complete the missing builder/decode; make the suite green. No bare `as` casts (use `castAs`/`blindCast` if unavoidable).

## References

- R1 brief: `./02-read-path.md` (full task spec — the correlation shape).
- Slice spec: `projects/sql-orm-many-to-many/slices/01-correlated-read-through-junction/spec.md`.
- Slice 0 `ResolvedRelation.through` in `collection-contract.ts`.

## Operational metadata

- **Model tier:** sonnet.
- **Branch:** `tml-2785-slice-1-correlated-read`. The WIP is already on it (uncommitted). Explicit staging + `-s` sign-off; **do not push**.
- **Time-box:** ~75 min. To reduce truncation risk: implement the builder branch first, get the targeted unit test green, then run the package gate — don't over-explore.
- **Halt + surface to me:** if the correlated builder cannot express the junction join without a new AST primitive / `LATERAL` (falsifies the correlated-only premise); if R1's WIP is in a state you can't reconcile coherently (describe it, don't force it).
