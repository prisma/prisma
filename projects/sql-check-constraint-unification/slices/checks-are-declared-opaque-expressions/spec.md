# Slice 1 — `checks-are-declared-opaque-expressions`

**Project:** [sql-check-constraint-unification](../../spec.md) · **Status:** in build

## At a glance

Every physical `CHECK` constraint becomes a contract-declared, wire-named, opaque SQL expression. Authoring emits enum-membership checks (scalar `IN`, array `<@`) and scalar-list element-non-null checks into `table.checks`; Postgres introspection captures every live check verbatim; the planner reconciles diff issues and nothing else — the element-non-null synthesis, the direct-walk check strategy, and the predicate reverse-parser are deleted in the same cut.

## Chosen design

Decisions are locked in the [project spec § Locked decisions](../../spec.md#locked-decisions); this section pins the slice-level shape against shipped code. Executors: re-verify every snippet against the code at dispatch time, not against this sketch.

1. **Contract IR.** `CheckConstraint` (`packages/2-sql/1-core/contract/src/ir/check-constraint.ts`) → `{ name, prefix?, expression }`. `prefix` presence is the naming-mode discriminator, matching `Index` (`sql-index.ts`): constructor takes `naming: SqlObjectNaming` + `expression`, stores flat `name` + optional `prefix`. Arktype `CheckConstraintSchema` (`storage-entry-schemas.ts:115`) updated, `'+': 'reject'` kept. Canonicalization sorts `table.checks[]` by physical name; table-wide constraint-name uniqueness validation preserved.
2. **Naming.** New `computeCheckContentHash(expression)` in `packages/2-sql/1-core/schema-ir/src/naming.ts` beside `computeIndexContentHash`: `sha256(JSON.stringify([normalizeSqlBody(expression)])).slice(0, 8)`. Prefixes `${table}_${column}_check` / `${table}_${column}_elem_not_null`, guarded by `assertWireNamePrefixLength` (throws over 54 chars, same stance as indexes).
3. **Authoring.** A duck-typed hook on the Postgres pack's `AuthoringContributions` (pattern: `qualifyColumnType`, consumed via a `hasX` type predicate in `build-contract.ts:240-300`), called where checks are emitted today (`build-contract.ts:806-833`). It renders, per column:
   - text-backed domain enum, scalar: `"col" IN ('a', 'b')`
   - text-backed domain enum, array: `"col" <@ ARRAY['a', 'b']::text[]`
   - every `many` column: `array_position("col", NULL) IS NULL`
   Emission conditions are unchanged: membership checks only when `storageValueSetRef !== undefined` (the `enumType()` handle path; `pg.enum` entity-ref columns get none); element-non-null for every `many` column. Non-string value-set members throw at render time (the `CONTRACT.ENUM_INVALID` guard relocated from `resolveValueSetValues`). Quoting via the target's own helpers — no quoting utilities lifted into 2-sql.
4. **Schema IR.** `SqlCheckConstraintIR` → `{ name, prefix?, expression }` with `naming` constructor input (the `SqlIndexIR` pattern), `id` stays `check:${name}`. `isEqualTo`: wire-named receiver → id equality; exact receiver → verbatim `expression` compare (mirrors `PostgresPolicySchemaNode.isEqualTo`). `classifySqlDiffIssue` (`schema-verify.ts:116-118`) drops the check → `valueDrift` branch; granularity stays `auxiliary`.
5. **Projection.** `convertCheck` (`contract-to-schema-ir.ts:289`) passes `{ naming, expression }` through; `resolveValueSetValues` and its check-side callers are deleted (the emitter/ORDER BY consumers of `column.valueSet` are untouched).
6. **Introspection** (`packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts:926-961, 1206-1219, 1664-1712`). Query selects `pg_get_expr(c.conbin, c.conrelid) AS check_expression` (bare predicate — no `CHECK (…)` wrapper, no `NOT VALID`/`NO INHERIT` suffixes), adds `AND c.conislocal AND c.conrelid <> 0`. Every row becomes a check node: body stored verbatim, naming via `namingOfLiveName`. `parseCheckConstraintDef` deleted.
7. **Planner** (`packages/3-targets/3-targets/postgres/src/core/migrations/`). Delete `checkConstraintPlanCallStrategy` (`planner-strategies.ts:448-520`) and `elementNonNullCheckName`/`elementNonNullCheckExpression`/`isManyColumn` (`issue-planner.ts:92-110, 386-388, 479-487`). `mapCheckNodeIssue` (`issue-planner.ts:878-900`) handles all three outcomes: `not-found` → `AddCheckConstraintCall`, `not-expected` → `DropCheckConstraintCall`, `not-equal` → `unsupportedOperation` conflict (the index treatment; reachable only for exact-named expected checks, which emitted contracts no longer produce). `buildCreateTableCallsFromNode` (`issue-planner.ts:463`) renders the table node's check children inline as `CheckExpressionConstraint`s — enum checks move from follow-up `ALTER TABLE` to inline-at-create.
8. **Ops.** `AddCheckConstraintCall` (`op-factory-call.ts:1049`) → `(schemaName, tableName, constraintName, expression)`; DDL renders `ADD CONSTRAINT "x" CHECK (<expression>)` (`operations/constraints.ts:133`). `DropCheckConstraintCall` unchanged. `renderTypeScript`/migration-class signatures follow; no compat shims.
9. **SQLite:** mechanical follow-through on the shared IR shape only; its planner keeps refusing check DDL.

Rename pairing is **not** in this slice (slice 2). Interim behavior — a prefix-only change plans as drop + add — is correct and gets a pinning test.

## Coherence rationale (slice-INVEST Small)

One outcome reviewed as one concept: "checks are declared opaquely; the planner only reconciles." The layers (contract → authoring → IR → adapter → planner) are the same vertical, not unrelated areas. The cut cannot split into smaller green PRs: complete introspection with the old planner live would start dropping newly visible constraints (the strategy's live-but-not-in-contract drop loop), and the old value-set planner cannot plan the new node shape. Fixture churn is expected and mechanical (contract shape change).

## Scope

**In:** everything under Chosen design; lifecycle integration tests (below); fixture regen; removal of stale `verifyCheckConstraints` doc references (`contract-to-schema-ir.ts:221`, `sql-check-constraint-ir.ts:57`); the strategy-deletion note in [contract-free-migration-planning/plan.md](../../../contract-free-migration-planning/plan.md).

**Deliberately out:** `RenameCheckConstraintCall` + pairing pass (slice 2); `@@check` user authoring; `contract infer` check adoption; numeric-enum support; SQLite check support; any differ/framework interface change.

## Pre-investigated edge cases

Findings from shaping research that dispatch-time grep would not surface:

| Edge case | Behavior to implement / pin |
| --- | --- |
| Postgres reprints `varchar`-column enum checks as `((col)::text = ANY ((ARRAY[…])::text[]))` | No drift: comparison is by name, body never parsed. Integration test must use a `varchar`-typed enum column, not just `text`. |
| Array domain-enum DDL is invalid today (`"roles" IN (…)` vs `text[]`) | The `<@` form must be proven live: migration applies, out-of-set element INSERT rejected, NULL element INSERT rejected (`<@` never matches NULL elements). |
| `NOT VALID` / `NO INHERIT` constraints | `pg_get_expr(conbin)` yields the bare predicate — no suffix contamination. Introspection test creates a `NOT VALID` check via raw SQL. |
| Partitioned / inheriting tables | `AND c.conislocal` — one node per constraint, not per child. |
| Domain checks (`contype='c'`, `conrelid=0`) | Excluded by `c.conrelid <> 0` (today only excluded by join accident). |
| Existing deployed names are unsuffixed (`User_role_check`, `User_tags_elem_not_null`) | Adoption is drop+add: full plan converges in one migration; additive-only installs the new check and strict verify reports the stale one. Pin both. |
| Two schemas, same table+check names | Plan independently (the deleted strategy's single-namespace defect). Multi-namespace test required. |
| Generated prefix over 54 chars | ~~Throw at authoring~~ **Amended during D5** (falsified by shipped content: the Supabase extension's `custom_oauth_providers.acceptable_client_ids` derives a 58-char prefix — legal exact name, 67-char wire name). Derived check prefixes truncate deterministically to the 54-char cap; identity lives in the content hash (every check expression embeds its column name, so truncation-colliding prefixes still yield distinct physical names). The index throw-stance assumed an author-controlled `name:` escape hatch that derived names lack. `assertWireNamePrefixLength` remains for author-supplied prefixes (none exist for checks yet). |
| Native `pg.enum` array columns | No membership check (native type enforces), but they are `many` → element-non-null check still emitted. |
| Coalescing | A whole-table create coalesces child check issues; inline rendering from node children is what keeps them alive (`buildCreateTableCallsFromNode`). |
| Old planner tests | `planner.check-constraints.test.ts`, `control-adapter.check-constraints.test.ts` assert the deleted machinery; rewritten against the new shape, not deleted wholesale. |

## Slice Definition of Done

Beyond CI-green + reviewer-accept + the team DoD floor:

- [ ] SDoD1 — Grep-clean: `elementNonNullCheckName|elementNonNullCheckExpression|isManyColumn|checkConstraintPlanCallStrategy|parseCheckConstraintDef|valueSet` each return zero hits under `packages/3-targets/3-targets/postgres/src/core/migrations/` (last pattern scoped to check-planning files).
- [ ] SDoD2 — Lifecycle integration suite green against real Postgres: create / raw-SQL introspect / no-drift (incl. `varchar` shape) / expression change → drop+add / add-list-column installs check / manual loss repaired / adoption converges / multi-namespace / array-enum element rejection.
- [ ] SDoD3 — `pnpm fixtures:check` clean after regen; no unrelated fixture drift.
- [ ] SDoD4 — Project-spec DoD items owned by this slice hold (all except the rename items).

## Open questions

None — settled at project shaping.

## References

- [Project spec](../../spec.md) (locked decisions) · [Project plan](../../plan.md)
- Test templates: `packages/3-targets/6-adapters/postgres/test/migrations/rls-lifecycle-e2e.integration.test.ts`, `rls-introspection.integration.test.ts`, `enum-check-constraint.integration.test.ts` (existing enum lifecycle, to be evolved)
- Naming convention: `packages/2-sql/1-core/schema-ir/src/naming.ts` + ADR 234
