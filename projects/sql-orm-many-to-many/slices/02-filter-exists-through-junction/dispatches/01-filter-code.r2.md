# Brief: S2-D1 R2 — finish the filter EXISTS (continue from WIP)

## Situation

The R1 implementer ran out of budget mid-work and **did not commit**. Uncommitted WIP is in the tree (`git status` + `git diff`): `src/model-accessor.ts` (+96) and `test/model-accessor.test.ts` (+182). It was mid-fix on the **parent-anchor correlation** — it had just realised the junction→parent side must resolve from `relation.on.localFields` (the parent's anchor columns), not from `through.parentColumns`, and was about to thread `contract` + `parentModelName` into a `buildManyToManyExistsExpr` helper to resolve them.

## Task

**Read the uncommitted diff first.** Then finish:

1. Complete the M:N EXISTS for `some`/`every`/`none` in `model-accessor.ts`. The correlation has two distinct sides — get both right (this is exactly what slice 1's read path established, mirror it for consistency):
   - **junction → parent:** `junction.{through.parentColumns} = parent.{on.localFields resolved to columns}` (e.g. `user_tags.user_id = users.id`). Resolve the parent anchor columns via `resolveFieldToColumn(contract, parentModelName, localField)` — thread `contract`/`parentModelName` into the helper as the WIP was starting to do.
   - **junction → target:** `junction.{through.childColumns} = target.{through.targetColumns}` (e.g. `user_tags.tag_id = tags.id`).
   - Shapes: `some` = `EXISTS(SELECT 1 FROM target JOIN junction ON <j→t> WHERE <j→parent> AND <pred>)`; `none` = `NOT EXISTS(… AND <pred>)`; `every` = `NOT EXISTS(… AND NOT(<pred>))`. Composite-key AND-ed across all pairs.
2. Reconcile R1's WIP unit tests so they pass and assert the AST (junction join + both correlation sides; some/every/none). Fix any incoherent WIP test.
3. Don't regress FK relation filters.

## Completed when

- [ ] `some`/`every`/`none` on M:N compile to the correct junction EXISTS/NOT EXISTS (both correlation sides correct, composite-key AND-ed); unit tests pass.
- [ ] FK filter tests pass.
- [ ] `pnpm --filter @internal/sql-orm-client typecheck` + `test` green.
- [ ] Committed as **one coherent commit** (WIP + completion), explicit staging + `-s` sign-off, **no push**. No bare `as` casts.

## Standing instruction

Finish the goal; keep R1's coherent WIP. Implement → get the targeted test green → run the package gate; don't re-explore.

## References

- R1 brief: `./01-filter-code.md`. Slice spec: `../spec.md`.
- **Slice 1 read path** (`query-plan-select.ts` `buildManyToManyJunctionArtifacts`, commit `e587b433c`) resolved the same two-sided junction correlation — mirror its parent-anchor resolution for consistency.

## Operational metadata

- **Model tier:** sonnet.
- **Branch:** `tml-2786-slice-2-filter` (WIP already on it). Explicit staging + `-s`; **no push**. Don't commit under `projects/`.
- **Time-box:** ~50 min.
- **Halt + surface to me:** if R1's WIP is incoherent in a way you can't reconcile (describe it); if the junction EXISTS needs a structural change beyond the FK EXISTS shape.
