# Brief: S2-D1 — filter EXISTS walks the junction

## Task

Teach the relation-filter accessor to walk the junction for M:N relations. `db.orm.User.filter((u) => u.tags.some/every/none((t) => …))` must emit an EXISTS / NOT EXISTS subquery that goes through the `UserTag` junction. Today `buildJoinWhere` (`packages/3-extensions/sql-orm-client/src/model-accessor.ts`) reads only `relation.on.localFields/targetFields` — for an M:N relation that emits a wrong-shape EXISTS that skips the junction.

When the resolved relation carries `through` (slice 0 added it to `resolveModelRelations`'s output), build the M:N shape in `buildExistsExpr`/`buildJoinWhere`:
- **`some(pred)`** → `EXISTS (SELECT 1 FROM target JOIN junction ON junction.childColumns = target.targetColumns WHERE junction.parentColumns = parent.anchor AND <pred>)`.
- **`none(pred)`** → `NOT EXISTS (… AND <pred>)`.
- **`every(pred)`** → `NOT EXISTS (… AND NOT(<pred>))` — mirror the existing FK `every` shape, just through the junction.

The parent correlation is on the **junction** side; the target is reached via the junction join; composite keys AND-ed across all pairs. The child predicate is unchanged.

**First confirm** the relation reaching `buildJoinWhere` carries `through` — it should, via `resolveModelRelations` (slice 0). If the filter path uses a relation shape that drops `through`, surface it onto that path (one field; mirror how slice 1 surfaced `through` onto `IncludeExpr`).

**Write unit tests first** asserting the compiled EXISTS AST for `some`/`every`/`none` on an M:N relation joins through the junction (composite-key AND-ed), and that FK relation filters are unchanged.

## Scope

**In:** the M:N branch in `buildExistsExpr`/`buildJoinWhere` (`model-accessor.ts`) for some/every/none; surfacing `through` onto the filter relation if dropped; unit tests for the EXISTS AST.

**Out:** integration tests (S2-D2); include reads (slice 1); nested writes (slice 3); the `through` shape (slice 0). Don't regress FK filters.

## Completed when

- [ ] `some`/`every`/`none` on an M:N relation compile to a correctly-shaped EXISTS/NOT EXISTS through the junction (composite-key AND-ed); unit test asserts the AST.
- [ ] FK relation filters unchanged (existing model-accessor unit tests pass).
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `test` green.

## Standing instruction

Stay focused on the junction EXISTS. The judgment site is the junction hop in `buildJoinWhere` and the `every` = `NOT EXISTS(… NOT(pred))` shape; mirror the FK path. No bare `as` casts (use `castAs`/`blindCast` if unavoidable — a sibling slice was bounced for bare casts twice; don't add new ones).

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/02-filter-exists-through-junction/spec.md`.
- `model-accessor.ts`: `createRelationFilterAccessor` (~190), `buildExistsExpr` (~222), `buildJoinWhere` (~331) — the FK path to extend.
- Slice 0 `ResolvedRelation.through` in `collection-contract.ts`.

## Operational metadata

- **Model tier:** sonnet — bounded judgment (the junction EXISTS + every/none shapes).
- **Branch:** `tml-2786-slice-2-filter`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~75 min — implement `some` first + its test, then `none`/`every`, then gate; don't over-explore.
- **Halt + surface to me:** if `buildJoinWhere`'s EXISTS construction can't host the junction join without a structural change beyond the FK path's shape (surface the obstacle); if `through` is genuinely unavailable on the filter relation and surfacing it touches an out-of-scope consumer.
