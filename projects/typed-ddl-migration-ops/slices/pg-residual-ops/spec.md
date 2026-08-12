# Slice — `pg-residual-ops` (spec)

**Project:** typed-ddl-migration-ops · **Linear:** TML-2919 · **Branch:** `tml-2919-pg-typed-ddl-residual-ops` (off `main`).

## Purpose

Convert the last Postgres migration ops still emitting raw SQL onto the typed `*Call.toOp(lowerer)` → adapter-lowering path, and delete the dead raw builders. After this slice the only PG op left on raw SQL is `CreateExtension` (its own slice, TML-2920, because it's an entity-kind modeling change).

## In scope

1. **Not-null-with-temporary-default recipe.** `buildAddNotNullColumnWithTemporaryDefaultOperation` (`planner-recipes.ts:34`) builds a multi-step op whose ADD COLUMN execute step comes from the raw `buildAddColumnSql` (`planner-ddl-builders.ts:196`). Convert that ADD COLUMN step to the **same typed `AddColumn` DDL node** the already-converted `AddColumnCall` uses (`contractFreeDdl.alterTable(...)` → `lowerer.lowerToExecuteRequest`). The recipe's other steps (SET NOT NULL, DROP DEFAULT) already have typed equivalents (`SetNotNullCall`/`DropDefaultCall` are converted) — compose those typed nodes rather than raw fragments. Thread the lowerer through (the recipe is already `async`). Consumers: `AddNotNullColumnDirectCall` (`op-factory-call.ts:695`) and `AddNotNullColumnWithTempDefaultCall` (`:748`).
2. **Delete dead raw builders.** Once the recipe is converted, `buildAddColumnSql` (and any `planner-ddl-builders.ts` / `operations/*.ts` PG builder left with no callers) is deleted.
3. **Data-transform `EXISTS(<user sql>)` wrapper** (`operations/data-transform.ts:120,132`) — `SELECT EXISTS (${checkPlan.sql}) AS ok` / `NOT EXISTS`. **Assessed (TML-2919 spike verdict: HALT — sanctioned remnant).** `cfExpr.exists()` accepts `CfExprSelectQuery` → `SelectAst`. The data-transform check closure is lowered to `{sql: string, params}` via `adapter.lowerToExecuteRequest(plan.ast, { contract })` before the wrapper is built — there is no pre-lowering `SelectAst` available to pass to `cfExpr.exists()`. Wrapping the already-lowered SQL string requires a new raw-subquery-as-exists-source primitive (substrate growth), which is out of scope for this slice. Left as-is with a comment marking it a sanctioned user-SQL-adjacent remnant.

## Out of scope

- `CreateExtension` (TML-2920). SQLite (TML-2921/2922). Docs (TML-2923).
- Growing the AST for the data-transform wrapper (HALT instead).
- **Typed `PostgresTableRef` end-to-end (TML-2927).** This slice keeps the
  schema/table coordinate as two separate string fields (`schema?: string` +
  `table: string`) on the contract-free DDL builders and `*Call` IR, and maps
  the unbound sentinel to `undefined` via the small `bound-schema.ts` helper
  (`boundSchema(schemaId)`). During review we spiked tightening this — first a
  `PostgresSchema.schemaForBuilder()` accessor, then a polymorphic
  `PostgresSchema.qualify(name)` that collapsed the builder/AST shape to a
  single composed `table` string — and **reverted both** (commits `cadcc53e0`
  + `a174ecbe7`, recoverable from the merge-base reflog): they were a half-step
  (string-typed refs end-to-end, the schema IR reconstituted in `*Call.toOp()`
  just to call `qualify()` once) and the proper fix is its own slice.
  **Exit condition:** when TML-2927 lands a typed `PostgresTableRef` carried
  end-to-end, `bound-schema.ts` is deleted and every call site composes the
  qualified reference through the ref instead of the `boundSchema` string map.

## Done conditions

- The not-null-temp-default recipe's ADD COLUMN (and the other steps) build typed nodes lowered through the adapter; `buildAddColumnSql` is gone (`git grep buildAddColumnSql` empty).
- Data-transform wrapper: either converted to a typed EXISTS projection, or left as-is with a one-line comment marking it the sanctioned user-SQL-adjacent remnant + a follow-up note (per the HALT outcome).
- No new raw-SQL PG Op-builder; any `operations/*.ts` / `planner-ddl-builders.ts` left callerless is deleted.
- Gates: fresh workspace typecheck, `pnpm test:packages`, `pnpm test:integration` (the recipe runs against PGlite — the lane that's caught regressions), `pnpm fixtures:check` (byte-parity — the recipe's emitted SQL should be byte-identical), `pnpm lint:deps`, cast ratchet delta 0.

## Notes

- **Byte-parity matters here** (unlike the verification checks): the recipe emits execute-step SQL that's serialized into `ops.json` fixtures. The typed path must produce byte-identical ADD COLUMN SQL. `fixtures:check` is the guard.
- Mirror the proven `AddColumnCall.toOp` (PG slice 7) pattern for the typed ADD COLUMN node + lowering.
