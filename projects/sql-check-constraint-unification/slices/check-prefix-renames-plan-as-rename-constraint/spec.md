# Slice 2 — `check-prefix-renames-plan-as-rename-constraint`

**Project:** [sql-check-constraint-unification](../../spec.md) · **Builds on:** slice 1 ([#29892](https://github.com/prisma/prisma/pull/29892))

## At a glance

A prefix-only change to a wire-named check constraint plans as a single `ALTER TABLE … RENAME CONSTRAINT` under the `widening` operation class, instead of drop + add. Pairing is by content hash, cloned from `pairIndexRenames` pass 1. No adoption/content pass exists for checks — the project spec locks drop + add for exact-named live checks (content cannot be compared: live bodies are Postgres-reprinted).

## Chosen design

All decisions locked at project shaping; the mechanics mirror the index precedent, verified in this session's research:

1. **`RenameCheckConstraintCall`** in `op-factory-call.ts`, beside `DropCheckConstraintCall`: `factoryName = 'renameCheckConstraint'`, `operationClass = 'widening'` (copy `RenameIndexCall`'s typology comment), constructor `(schemaName, tableName, oldConstraintName, newConstraintName)`, `toOp` with the `MIGRATION.POSTGRES_CONTROL_STACK_MISSING` guard, `renderTypeScript` → `this.renameCheckConstraint({ schema?, table, from, to })` (omit schema for `UNBOUND_NAMESPACE_ID`, matching `constraintCallOptions`' stance). Union membership + export barrel + migration-class method in `postgres-migration.ts`.
2. **DDL op** `renameCheckConstraint` in `operations/constraints.ts`, raw-SQL style of the constraint family: id `checkConstraint.${schema}.${table}.${old}.rename`, `ALTER TABLE <qualified> RENAME CONSTRAINT <old> TO <new>`, prechecks old-present + new-absent via `constraintCheckSteps` (call twice — it's kind-agnostic), postcheck new-present, target details on the NEW name (the `renameIndex` convention).
3. **`pairCheckRenames`** planner post-pass in `planner.ts`, cloned from `pairIndexRenames` **pass 1 only**: policy check first (`widening` required, else no-op); group `not-found`/`not-expected` check-node issues by `(ddlSchema, tableName, parseWireName(name).hash)` with coordinates from the issue path; both sides sorted by name for determinism; non-wire-shaped names skipped; consumed issues removed by identity before `planIssues`. Call it beside `pairIndexRenames` in `planSql`; run the rename calls through the same call-side control-policy partition.
4. **`classifyCall`**: `renameCheckConstraint` joins the bucket containing `addCheckConstraint`; `locationForCall` reads the new name (index convention); `conflictKindForCall` per siblings.

## Coherence rationale

One outcome, one reviewer sitting: "prefix-only rename is one widening op." Small slice — the op class, the DDL op, the pass, tests.

## Scope

**In:** the four items above + tests. **Deliberately out:** any content/adoption pairing (locked out at project level); RLS/index pass changes; any IR/contract change.

## Pre-investigated edge cases

| Edge case | Behavior |
| --- | --- |
| Same hash, multiple candidates (two identical-expression checks on one table under different prefixes) | Deterministic pairing: buckets sorted by name, `shift()` consumption — mirror the index pass exactly. |
| Expression change + prefix change together | Different hash → no pairing → drop + add (slice 1 behavior preserved; pin it). |
| Policy without `widening` | Pass no-ops; drop + add under destructive, add-only otherwise (slice 1 pins remain green). |
| Exact-named live check with matching prefix | Never paired (non-wire names skipped) — adoption stays drop + add. |
| Wire-shaped live name whose hash matches no expected | Falls through to `not-expected` → drop under destructive (unchanged). |

## Slice Definition of Done

- [ ] S2-1 — Unit: `pairCheckRenames` mirrors `index-rename-planner.test.ts` coverage (pairing, determinism with multiple candidates, non-wire skip, policy no-op, cross-schema/table isolation).
- [ ] S2-2 — Integration: a prefix-only PSL/TS rename plans exactly one `RENAME CONSTRAINT` (no drop, no add), applies, verifies clean; the renamed constraint enforces afterward.
- [ ] S2-3 — Slice 1's drop+add-for-rename pin updated to reflect the new behavior (it pinned interim behavior by design) — under `widening` it now pairs; without `widening` the old pin holds.
- [ ] S2-4 — Full package gates for target-postgres + adapter-postgres; workspace gates before PR.

## Dispatch plan

Single dispatch: `rename-op-and-pairing`. The op without the pass is preparation (fails INVEST-Valuable); the pass without tests is unverifiable. One outcome: "a prefix-only rename is one widening op, proven live." Gates: S2-1 through S2-4. Builds on: slice 1 head. Hands to: slice-DoD / PR.

## References

[Project spec](../../spec.md) · `planner.ts` `pairIndexRenames` (the clone source) · `operations/indexes.ts` `renameIndex` · `index-rename-planner.test.ts`
