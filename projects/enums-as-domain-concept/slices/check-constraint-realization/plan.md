# Dispatch plan — check-constraint-realization (TML-2851)

Slice spec: [`./spec.md`](./spec.md). Four sequential dispatches: contract IR + lowering → schema-IR projection + introspection + verification → PG migration DDL + planner → integration + additivity gate. All additive/dark (`checks` optional; native path + fixtures unchanged). Implementer tier: sonnet-mid; reviewer: opus.

### Dispatch 1: `CheckConstraint` IR + lowering + validators

- **Outcome:** The contract can represent and **emit** a check constraint for an enum-restricted column. A frozen `CheckConstraint` IR node (`{ name, column, valueSet: ValueSetRef }`, structured — not raw SQL) exists; `StorageTable` gains an **optional** `checks?: ReadonlyArray<CheckConstraint>` (omitted-when-empty); `build-contract.ts` emits one check (referencing the column's value-set) per enum-restricted column into the owning table's `checks`; an arktype `CheckConstraintSchema` validates it; JSON round-trips. A unit/round-trip test authoring an `enumType` model asserts the emitted table carries the check + it survives serialize→hydrate. `pnpm typecheck` clean; `lint:casts` ≤ 0.
- **Builds on:** Slice 1's `StorageValueSet` + `StorageColumn.valueSet` (merged in `main`); the slice spec's chosen design.
- **Hands to:** Contract-resident check constraints — the input the schema-IR projection (D2) and the planner (D3) consume.
- **Focus:** `packages/2-sql/1-core/contract/src/ir/check-constraint.ts` (new), `storage-table.ts` (optional `checks`), `build-contract.ts` (emit), `validators.ts` (fragment), serializer hydration of the `checks` slot. Out: schema-IR/verify (D2), planner DDL (D3). **Do not** touch the native enum path. Confirm `checks` optional keeps `fixtures:check` clean.

### Dispatch 2: schema-IR projection + introspection + verification

- **Outcome:** `db verify` compares a contract's expected checks against the live database. `contract-to-schema-ir.ts` gains `convertCheck` projecting each `CheckConstraint` into an `SqlCheckConstraintIR` carrying the **resolved permitted values** (looked up from the referenced `valueSet`); the Postgres control adapter introspects live check constraints (`pg_constraint contype='c'` + `pg_get_constraintdef`) into the schema IR; a `verifyCheckConstraints` helper compares them, emitting `check_missing` / `check_removed` / `check_mismatch`. The comparison normalizes Postgres's `col = ANY (ARRAY[…])` rewrite of `IN (…)` — it compares **value sets, not SQL strings**. Family verification unit tests + an introspection round-trip test cover it.
- **Builds on:** Dispatch 1's `CheckConstraint` IR + contract-resident checks.
- **Hands to:** The contract-vs-live check comparison (projection + introspection), reused by `db verify` and by the planner's diff (D3).
- **Focus:** `contract-to-schema-ir.ts` (`convertCheck` + value-set value resolution), `control-adapter.ts` (new `pg_constraint contype='c'` query), `verify-helpers.ts` / `verify-sql-schema.ts` (`verifyCheckConstraints`). `verifyEnumType` is **untouched** (added, not replacing). Out: planner DDL (D3).

### Dispatch 3: Postgres migration DDL + planner strategy

- **Outcome:** The Postgres planner emits check-constraint migration ops, and a member change re-issues the check. Pure factories `addCheckConstraint` / `dropCheckConstraint` (`operations/constraints.ts`, mirroring `addUnique`/`addForeignKey` — `ALTER TABLE … ADD/DROP CONSTRAINT <name> CHECK (<col> IN (<values>))` with pre/exec/postcheck); `AddCheckConstraintCall` / `DropCheckConstraintCall` (`op-factory-call.ts`, extending `PostgresOpFactoryCallNode`); a `checkConstraintPlanCallStrategy` (mirroring `nativeEnumPlanCallStrategy`) diffing expected-vs-live checks → ops, registered in `postgresPlannerStrategies`. A value add/remove ⇒ **drop + recreate** (no recipe/rebuild). Planner unit tests assert the emitted ops for create / value-change / remove.
- **Builds on:** Dispatch 1 (contract checks) **and** Dispatch 2 (the schema-IR projection + introspection the diff consumes — a non-linear dependency: the planner reads D2's `convertCheck` output and introspected checks).
- **Hands to:** A migratable check realization — `db migrate`/`update` create, alter, and drop checks.
- **Focus:** `operations/constraints.ts`, `op-factory-call.ts`, `planner-strategies.ts` (new strategy + registration), `planner-ddl-builders.ts` if a render helper is needed. Deterministic check naming (`<table>_<column>_check`) so plan/verify/introspect agree. Out: integration wiring (D4).

### Dispatch 4: integration (PGlite) + additivity gate (slice wrap)

- **Outcome:** End-to-end against a live database: an `enumType`-authored contract migrates a `CHECK (col IN (…))`, `db verify` passes against it, and adding/removing a member re-issues the check (drop+recreate) — one PGlite integration test covering the round. **Slice-DoD additivity gate:** `pnpm build → pnpm i → pnpm fixtures:check` is **byte-identical, zero diff**; full `pnpm typecheck` clean; `lint:casts` ≤ 0; no new bare casts.
- **Builds on:** Dispatches 1–3 (the whole vertical: contract checks → planner → verify).
- **Hands to:** The slice-DoD — the check realization works end-to-end and regresses nothing. The project's hand-off to the cutover (TML-2853).
- **Focus:** `packages/3-targets/6-adapters/postgres/test/migrations/` (PGlite integration — plan + apply + verify + value-change). The `fixtures:check`-clean gate is the additivity proof for the dark path. Out: anything that changes emitted fixtures (that's the cutover, not here).
