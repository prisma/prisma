# Brief: S1-D2 — read path correlates through the junction

## Task

Teach the correlated include read path to walk an M:N relation through its junction. When the resolved include relation carries `through` (surfaced by slice 0 on `ResolvedRelation`), `db.orm.User.include('tags')` must resolve to `tags: Tag[]` via a **single correlated subquery**: the child subquery selects from the **target** (`tags`) joined to the **junction** (`user_tags`) on `junction.childColumns = target.targetColumns`, correlated to the parent on `junction.parentColumns = parent`'s anchor key — i.e. the target rows whose PK appears in junction rows pointing at the current parent row. No `LATERAL`, no second query.

Concretely:
1. `resolveIncludeRelation` (`collection-contract.ts`) surfaces the `through` descriptor onto its `ResolvedIncludeRelation` result.
2. `IncludeExpr` (`types.ts`) gains an optional `through?` mirroring the descriptor.
3. `buildCorrelatedIncludeProjection` (`query-plan-select.ts`) — today it correlates `child.targetColumn = parent.localColumn` for FK relations. Add the M:N branch: when `include.through` is present, build the child subquery against the target joined to the junction, with the parent correlation on the junction side. AND across all column pairs for composite keys.
4. Whatever include-child **decode / graft** is needed (`collection-dispatch.ts` / the include decode path) to assemble the aggregated `tags: Tag[]` under the relation key — mirror the existing FK include child handling.

**Write unit tests first** (`query-plan-select.test.ts` or the nearest existing suite): assert the compiled AST for an M:N include is a single correlated subquery joining through the junction, with the composite-key correlation AND-ed, and **no `LATERAL`** node. Use a hand-built M:N contract (mirror slice 0's `buildManyToManyContract` resolver test, or the fixture).

## Scope

**In:** `resolveIncludeRelation` + `IncludeExpr.through` (`collection-contract.ts`, `types.ts`); the M:N branch in `buildCorrelatedIncludeProjection` + include-child decode (`query-plan-select.ts`, `collection-dispatch.ts`); unit tests for the compiled AST.

**Out:** integration tests (S1-D3 — those run against the fixture/DB); filter EXISTS (slice 2); nested write (slice 3); any `IncludeExpr` change beyond carrying `through`; the FK include path (don't regress it).

## Completed when

- [ ] An M:N `include` compiles to a **single correlated subquery** walking parent → junction → target (composite-key correlation AND-ed); unit test asserts the AST shape and the **absence of any `LATERAL`** node.
- [ ] The FK (non-M:N) include path is unchanged (its existing unit tests still pass).
- [ ] Gate: `pnpm --filter @internal/sql-orm-client typecheck` + `pnpm --filter @internal/sql-orm-client test` green.

## Standing instruction

Stay focused on the M:N read correlation. The judgment site is the junction-join in the correlated builder — get it right; mirror the FK path's decode/aggregation rather than inventing a parallel one.

## References

- Slice spec: `projects/sql-orm-many-to-many/slices/01-correlated-read-through-junction/spec.md` (the parent→junction→target correlation shape).
- Slice 0: `ResolvedRelation.through` in `collection-contract.ts` (`{ table, parentColumns[], childColumns[], targetColumns[], requiredPayloadColumns[] }`).
- The FK correlated path in `buildCorrelatedIncludeProjection` (`query-plan-select.ts`) is the pattern to extend — find the `child.targetColumn = parent.localColumn` correlation site.

## Operational metadata

- **Model tier:** mid→orchestrator (sonnet) — this is the slice's design-judgment dispatch (correlated junction subquery). Take care; the AST mechanics are the hard part.
- **Branch:** `tml-2785-slice-1-correlated-read`. Explicit staging + `-s` sign-off. **Do not push.**
- **Time-box:** ~90 min.
- **Halt conditions (surface, don't work around):** the correlated builder cannot express the junction join without a **new AST primitive / a LATERAL** (would falsify the slice's "correlated-only through the junction" premise — surface to me); composite-key correlation needs data not present on `through`; surfacing `through` onto `IncludeExpr` forces touching an out-of-scope consumer.
