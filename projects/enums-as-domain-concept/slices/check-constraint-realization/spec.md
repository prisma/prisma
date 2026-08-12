# Slice: check-constraint-realization

Parent project: `projects/enums-as-domain-concept/`. Contributes the project's **server-side realization**: an enum's value-set is enforced in Postgres by a check constraint, end-to-end (emit → plan → migrate → verify), additively.

## At a glance

A column authored with an `enumType` carries a `valueSet` reference (slice 1). This slice makes that restriction **real in the database**: the emitter adds a table-level check constraint referencing the value-set, the Postgres migration planner emits `ADD/DROP CONSTRAINT … CHECK (col IN (…))`, schema verification compares the contract's expected check against the live database, and changing the enum's members re-issues the check (a cheap `ALTER TABLE`, no native-type rebuild). All **additive/dark**: the native Postgres enum path, PSL `enum`, and every emitted fixture stay unchanged; the new behavior is exercised only by `enumType`-authored contracts.

## Chosen design

Full design context: project spec components 4–5, 10 + R7; `design-notes.md`. Grounded surfaces in `## References`.

**`CheckConstraint` IR — structured, references the value-set.** New frozen IR node (`packages/2-sql/1-core/contract/src/ir/check-constraint.ts`, mirroring the `StorageValueSet`/`StorageTable` frozen-node + `*Input` pattern):

```ts
interface CheckConstraint { readonly name: string; readonly column: string; readonly valueSet: ValueSetRef }
```

It is **structured** (a column restricted to the value-set), **not** a raw SQL `expression` — the contract stays target-agnostic and each target renders its own DDL. It references the value-set by the slice-1 `ValueSetRef` coordinate (`{ plane, namespaceId, entityKind, name, spaceId? }`).

**`StorageTable.checks?` — optional (the load-bearing additivity constraint).** Add `readonly checks?: ReadonlyArray<CheckConstraint>` to `StorageTable` / `StorageTableInput`. Unlike `uniques`/`indexes`/`foreignKeys` (always-present arrays), `checks` is **omitted when empty** — otherwise every existing table fixture gains `"checks": []` and the dark guarantee breaks.

**Emit (lowering).** Extend `build-contract.ts`: for each column carrying a `valueSet` (an enum-restricted column), emit one `CheckConstraint` into the owning table's `checks`, referencing the same value-set. The column's `valueSet` stays (notional restriction, for slice-3 typing); the check is the *enforcement* of the same set. (No enum-restricted columns ⇒ no `checks` ⇒ omitted ⇒ no fixture change.)

**Schema-IR projection + DDL.** `contract-to-schema-ir.ts` gains `convertCheck` → an `SqlCheckConstraintIR` carrying the resolved permitted values (looked up from `storage.namespaces[ns].entries.valueSet[name]`). The Postgres adapter renders DDL mirroring the existing `addUnique`/`addForeignKey` pattern (`operations/constraints.ts`): `addCheckConstraint` / `dropCheckConstraint` emit `ALTER TABLE … ADD/DROP CONSTRAINT <name> CHECK (<col> IN (<values>))` with precheck/execute/postcheck steps.

**Planner strategy.** A `checkConstraintPlanCallStrategy` mirroring `nativeEnumPlanCallStrategy`, registered in `postgresPlannerStrategies`: diff contract-expected checks vs live → issues (`check_missing` / `check_removed` / `check_values_changed`) → `AddCheckConstraintCall` / `DropCheckConstraintCall` (extend `PostgresOpFactoryCallNode`). A member add/remove changes the value-set's values ⇒ the check diff ⇒ **drop + recreate** the check (no recipe/rebuild dance — a check is not a type).

**Introspection.** New query in the Postgres control adapter reading `pg_constraint` `contype = 'c'` (+ `pg_get_constraintdef`), projected into the schema IR's table checks. (No check-constraint introspection exists today.)

**Verification.** A `verifyCheckConstraints` helper (`verify-helpers.ts`) comparing the contract's expected check (resolved value set) against the introspected live check; issues `check_missing` / `check_removed` / `check_mismatch`. **Added, not replacing** — the native `verifyEnumType` stays (it's deleted at the slice-4 cutover). The comparison must normalize: Postgres stores `col IN (a,b)` as `col = ANY (ARRAY[a,b])` in `pg_get_constraintdef`, so compare the *value sets*, not the SQL strings.

## Coherence rationale

One outcome a single reviewer holds in one sitting: *"an enum's value-set is enforced server-side by a check constraint, end to end — emitted into the contract, planned, migrated, introspected, and verified."* It's a vertical realization slice (contract IR → lowering → PG adapter → verification), but one coherent story, and purely additive (a new optional field + new PG ops/queries; no existing path changes). Member **defaults** are deliberately a *separate* outcome (a sibling slice) — bundling them would force the reviewer to re-orient from "constraint enforcement" to "default values."

## Scope

**In:** `CheckConstraint` IR + optional `StorageTable.checks`; lowering emits checks for enum-restricted columns; `convertCheck` schema-IR projection (resolving value-set values); Postgres `addCheckConstraint`/`dropCheckConstraint` DDL + the `*Call` ops; `checkConstraintPlanCallStrategy`; `pg_constraint contype='c'` introspection; `verifyCheckConstraints`. Tests: PGlite integration (migrate a check, verify, value-change re-issues) + family-level verification unit tests.

**Out:**
- **Member defaults** (`enumMember` `ColumnDefault` variant + `.default(...)` / PSL `@default` + DDL rendering) → **sibling slice** (split from this one).
- Read/write typing, `db.enums`, `ORDER BY` → **TML-2852**.
- Deleting the native enum path / `verifyEnumType`, repointing PSL `enum` → **TML-2853 (cutover)**. The native path is untouched here.
- Non-Postgres targets (MySQL/SQLite checks) — out; the structured `in` check is dialect-agnostic but only the Postgres realization ships now.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| `checks` always-present vs optional | **Optional, omitted-when-empty** | `uniques`/`indexes`/`foreignKeys` are required arrays; matching them adds `"checks": []` to every table fixture and breaks dark. `checks` must be optional. |
| Introspected check text ≠ `IN (…)` | Normalize, compare sets | Postgres rewrites `col IN (a,b)` to `col = ANY (ARRAY[a,b])` in `pg_get_constraintdef`. Verification compares the *value set*, not the SQL string. |
| Member removal with violating data | Migration fails (expected) | Dropping a permitted value while rows hold it is a constraint tightening that fails — correct behavior; surfaced as a migration error, not silently dropped. |
| In-place check alter | Not possible — drop+recreate | Postgres can't alter a check predicate in place; a value change drops and re-adds the constraint (cheap `ALTER TABLE`, unlike the native enum rebuild). |

## Slice-specific done conditions

- [ ] **Additivity:** `pnpm build → pnpm i → pnpm fixtures:check` is **byte-identical, zero diff** (checks optional + dark; the native path and all fixtures unchanged).
- [ ] **End-to-end (PGlite):** an `enumType`-authored contract migrates a `CHECK (col IN (…))`, `db verify` passes against it, and adding/removing a member re-issues the check (drop+recreate) — one integration test covering the round.

## Open Questions

1. **Where the check is emitted** — at lowering into `storage.tables.checks` (planner reads it, like other constraints) vs derived at plan-time from the column's `valueSet`. Working position: emit into the contract at lowering, consistent with how `uniques`/`foreignKeys` are contract-resident.
2. **Does `SqlColumnIR` need the `valueSet`** for verification, or is the table-level check sufficient? Working position: the table-level check is the unit of enforcement and verification; the column `valueSet` is informational (slice-3 typing). Don't extend `SqlColumnIR` unless a verification gap forces it.
3. **Check naming** — deterministic name (e.g. `<table>_<column>_check`) so plan/verify/introspect agree. Working position: derive deterministically from table+column; confirm no collision with the existing constraint-naming scheme.

## References

- Parent: `projects/enums-as-domain-concept/spec.md` (components 4–5, 10, R7) + `design-notes.md`; `plan.md` (slice 2).
- Linear: [TML-2851](https://linear.app/prisma-company/issue/TML-2851)
- Surfaces (current shapes): `storage-table.ts`, `check-constraint.ts` (new), `build-contract.ts`, `contract-to-schema-ir.ts`, `operations/constraints.ts`, `planner-strategies.ts` (`nativeEnumPlanCallStrategy` template), `op-factory-call.ts`, `control-adapter.ts` (introspection), `verify-sql-schema.ts` + `verify-helpers.ts`.
- Native-path templates to mirror (not modify): the unique/foreign-key constraint planning + the native enum strategy.
