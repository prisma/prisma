# Slice 2: relation filters (some/every/none) through the junction

_Parent project: `projects/sql-orm-many-to-many/`. Outcome: `.filter(u => u.tags.some/every/none(...))` emits an EXISTS that walks the junction._

## At a glance

`db.orm.User.filter((u) => u.tags.some((t) => t.name.eq('x')))` (and `.every` / `.none`) must produce an EXISTS subquery that walks the **junction** for M:N relations. Today `buildJoinWhere` (`model-accessor.ts`) reads only `relation.on.localFields/targetFields`, so an M:N filter would emit a wrong-shape EXISTS that skips the junction. This slice adds the junction hop, reusing slice 0's `through` descriptor.

## Chosen design

**Add an M:N branch to the EXISTS builder.** `createRelationFilterAccessor` → `buildExistsExpr` → `buildJoinWhere` (`model-accessor.ts`). When the resolved relation carries `through`:

- **`some(pred)`** → `EXISTS (SELECT 1 FROM target JOIN junction ON junction.childColumns = target.targetColumns WHERE junction.parentColumns = parent.anchor AND <pred>)`.
- **`none(pred)`** → `NOT EXISTS (… AND <pred>)`.
- **`every(pred)`** → `NOT EXISTS (… AND NOT (<pred>))` (no related row that fails the predicate), mirroring the existing FK `every` shape.

The parent correlation moves to the **junction** side (`junction.parentColumns = parent.anchor`); the target is reached via the junction join (`junction.childColumns = target.targetColumns`); composite keys AND-ed. The child predicate (`<pred>`) is unchanged — it still applies to the target columns.

The relation passed to `buildJoinWhere` comes from `resolveModelRelations`, which slice 0 extended with `through`; **confirm** the filter path's relation type carries `through` (if it uses a relation shape that drops it, plumb it through — same one-field surfacing slice 1 did for `IncludeExpr`).

## Coherence rationale

One reviewable story: "M:N relation filters walk the junction." The `some`/`every`/`none` cases share the single junction-EXISTS shape; they're one coherent change to `buildJoinWhere`/`buildExistsExpr`, not separable.

## Scope

**In:** the M:N branch in `buildExistsExpr`/`buildJoinWhere` (`model-accessor.ts`) for `some`/`every`/`none`; surfacing `through` onto the filter path's relation if needed; unit tests (EXISTS AST through junction); integration tests per the standard.

**Out:** include reads (slice 1, done); nested writes (slice 3); non-relation filters; any `through` shape change (slice 0 owns it). No fixture change — reuse slice 1's `User ↔ Tag`.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Composite-key junction | AND across all column pairs in both the junction→parent correlation and junction→target join | slice 0 arrays |
| `every` semantics | `NOT EXISTS (… junction … AND NOT(pred))` — mirror the existing FK `every`, just through the junction | don't invent a new shape |
| Relation type may drop `through` | If the filter path's resolved-relation type doesn't carry `through`, surface/plumb it (one field), don't approximate | grounding for the implementer |

## Slice-specific done conditions

- [ ] `.some/.every/.none` on an M:N relation emit a correctly-shaped EXISTS/NOT EXISTS that joins through the junction (composite-key AND-ed); unit test asserts the AST.
- [ ] Integration tests (PGlite) per the standard: whole-row `toEqual` on the filtered result set; explicit `.select` in most; **≥1** implicit/default-selection case; cover `some`, `every`, `none`, and an empty-match edge.
- [ ] FK relation filters unchanged (existing tests pass).

## Open Questions

1. **`through` availability on the filter relation.** Working position: `resolveModelRelations` already carries `through` (slice 0); the filter path reuses it directly. If grounding shows otherwise, plumb the one field (no design change).

## References

- Parent project: `projects/sql-orm-many-to-many/spec.md` (§ Cross-cutting — integration-test standard).
- Slice 0 `ResolvedRelation.through`; slice 1 fixture (`User ↔ Tag`).
- Linear: [TML-2786](https://linear.app/prisma-company/issue/TML-2786)
