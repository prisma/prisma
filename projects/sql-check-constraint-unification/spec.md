# Unified SQL CHECK constraint representation — Spec

**Branch:** `worktree/sql-check-constraint-unify-41b068`

## Purpose

Represent every physical `CHECK` constraint as a contract-declared, wire-named, opaque SQL expression, and reduce the planner to pure reconciliation of that declaration against the live database.

Today checks travel two paths. Domain-enum membership checks are structured contract entries (`{ name, column, valueSet }`) with enum-shaped planning, DDL, and introspection. Postgres scalar-list element-non-null checks are raw SQL synthesized inside the planner at `CREATE TABLE` only — the planner invents schema objects the contract never declared, which violates the framework's design: the migration planner materializes the contract, nothing more. Every downstream symptom follows from that violation: the list check is invisible to introspection, cannot be diffed, is not installed when a list column is added later, and cannot be repaired or dropped.

After this project, both check kinds are emitted by the authoring surface into `table.checks`, named by the content-addressed wire-name convention indexes and RLS policies already use, introspected opaquely (no predicate parsing), and planned exclusively from diff issues. The planner contains zero schema-object synthesis and zero contract reads for check planning — deleting `checkConstraintPlanCallStrategy` also removes one of the remaining direct-walk behaviors tracked by [contract-free-migration-planning](../contract-free-migration-planning/spec.md).

## At a glance

```prisma
enum Role {
  user
  admin
}

model User {
  id    Int      @id
  role  Role     // text-backed domain enum
  roles Role[]   // domain-enum scalar list
  tags  String[] // plain scalar list
}
```

Authoring emits three checks into the contract's `User` table, each an opaque predicate with a wire name:

```jsonc
"checks": [
  { "name": "User_role_check_a1b2c3d4",  "prefix": "User_role_check",  "expression": "\"role\" IN ('user', 'admin')" },
  { "name": "User_roles_check_5e6f7a8b", "prefix": "User_roles_check", "expression": "\"roles\" <@ ARRAY['user', 'admin']::text[]" },
  { "name": "User_tags_elem_not_null_9c0d1e2f", "prefix": "User_tags_elem_not_null", "expression": "array_position(\"tags\", NULL) IS NULL" }
]
```

The hash suffix commits to the normalized expression. Changing an expression re-suffixes the name and diffs as missing + extra (drop/add); changing only the prefix pairs by hash and becomes `ALTER TABLE … RENAME CONSTRAINT`. Introspection captures every live check verbatim; managed checks compare by physical name, so Postgres reformatting the predicate never causes drift.

The `roles` check is also a bug fix: today authoring emits a check for enum array columns but the only DDL renderer produces `CHECK ("roles" IN (…))`, which Postgres rejects for an array column (`operator does not exist: text[] = text`) — and no test covers it. The `<@` containment form enforces that every element is an enum member (containment also rejects NULL elements).

## Locked decisions

- **Authoring declares, the planner reconciles.** The rules "a text-backed domain enum needs a membership check" and "a Postgres scalar-list column needs an element-non-null check" are applied at contract build time, emitting entries into `table.checks`. The planner's `elementNonNullCheckName` / `elementNonNullCheckExpression` / `isManyColumn` synthesis is deleted. After this project the planner never creates a schema object absent from the contract.
- **Contract shape: `{ name, prefix?, expression }`.** `name` is the full physical name including the hash suffix; `prefix` presence marks a managed wire-named check (the flat-storage discriminator convention `Index` uses); `expression` is the predicate body without the surrounding `CHECK (…)`. `column` and `valueSet` leave the check node. `column.valueSet` itself is untouched — it still drives generated union types, `ReadonlyArray` element typing, declaration-order `ORDER BY`, and `db.enums`.
- **Wire naming reuses the index/RLS convention unchanged.** Hash = first 8 hex chars of `sha256(JSON.stringify([normalizeSqlBody(expression)]))`; prefixes are `${table}_${column}_check` and `${table}_${column}_elem_not_null`, guarded by `assertWireNamePrefixLength` (54-char cap). The hash is never recomputed from an introspected body (`namingOfLiveName` makes a shape-only wire claim), so the database's reprinted predicate form is irrelevant to equality.
- **Expression text is rendered by a duck-typed Postgres authoring hook.** A hook contributed by the Postgres pack and consumed by `build-contract` beside the existing `qualifyColumnType` precedent renders the target-specific SQL (quoting included) at emit time. The PSL interpreter already delegates to `build-contract`, so one site serves both authoring surfaces. Scalar enum → `"col" IN (…)`; array enum → `"col" <@ ARRAY[…]::text[]`; every `many` column → `array_position("col", NULL) IS NULL`. Non-string value sets remain unsupported and now fail at render time (the `ENUM_INVALID` guard moves from schema-IR projection to authoring).
- **Equality is identical in strategy to indexes.** `SqlCheckConstraintIR` becomes `{ name, prefix?, expression }` with `naming` as constructor input and flat `name` + `prefix` storage; `id` stays `check:${name}`. A wire-named expected node compares by name (the hash already commits to content); an exact-named expected node compares the expression verbatim. The `classifySqlDiffIssue` special case mapping check `not-equal` to `valueDrift` is removed — check drift classifies as `declaredIncompatible` like every other paired divergence. (`valueDrift` had one consumer: `external` control policy suppressed it. Post-change, `not-equal` is reachable only for exact-named expected checks, which no longer exist in emitted contracts.)
- **Introspection is opaque and complete.** The catalog query keeps `contype = 'c'` and reads the body via `pg_get_expr(c.conbin, c.conrelid)` — the bare predicate, no `CHECK (…)` wrapper, no `NOT VALID` / `NO INHERIT` suffixes — deleting `parseCheckConstraintDef` and its unbalanced-paren stripping. Add `AND c.conislocal` (one row per constraint, not per inheritance/partition child) and `AND c.conrelid <> 0` (domain checks stay excluded by intent, not by join accident). Bodies are stored verbatim; naming derives via `namingOfLiveName`.
- **Planning is diff-driven with an index-shaped rename pass.** `checkConstraintPlanCallStrategy` is deleted (with it: single-namespace probing, schema-less issue-consumption keys, and a drop rule that disagreed with the fallback mapper). `mapCheckNodeIssue` handles `not-found` → add, `not-expected` → drop, `not-equal` → conflict (the index treatment). A `pairCheckRenames` post-pass clones `pairIndexRenames` pass 1 only — wire-hash pairing scoped per `(schema, table, hash)`, requiring `widening`, emitting the new `RenameCheckConstraintCall` and consuming both issues.
- **No exact→wire adoption pass; migration of existing names is drop + add.** Databases deployed from the old model carry unsuffixed names (`User_role_check`, `User_tags_elem_not_null`). Content pairing (the index pass 2 mechanism) is impossible for checks — the live body is Postgres-reformatted and never byte-matches the authored text — and a prefix-based rename would silently bless whatever predicate is actually live, which name-based comparison would then trust forever. So the old exact-named check surfaces as an extra (dropped under `destructive`) and the new wire-named check is added (`additive`). A full plan converges in one migration; under additive-only the stale check lingers and strict verify reports it, which is accurate. The cost is one revalidation scan per adopted check; soundness wins.
- **`CREATE TABLE` renders checks inline from the table node's children.** The create-table builder emits every declared check as an inline `CONSTRAINT … CHECK (…)`, replacing the element-non-null synthesis. Enum checks move from follow-up `ALTER TABLE` to inline-at-create as a side effect. Adding a column later needs no special casing: the diff produces a check `not-found` issue alongside the column issue, and the mapper adds it.
- **Ops.** `AddCheckConstraintCall` becomes `(schemaName, tableName, constraintName, expression)` rendering `ADD CONSTRAINT … CHECK (<expression>)`. `DropCheckConstraintCall` is unchanged. New `RenameCheckConstraintCall` (`widening`, raw-SQL style consistent with the constraint family, prechecks from the existing kind-agnostic `constraintExistsAst`: old present + new absent, postcheck new present), registered in the op union, migration-class methods, `classifyCall` bucket, and export barrel. No backward-compatible signatures.
- **Unmanaged live checks keep the index stance.** Granularity stays `auxiliary`: extras fail verify only under `--strict`, and plans drop them only when the policy allows `destructive`. No wire-suffix-based ownership test — verify ignores naming, and checks have no storage coordinate so the ownership oracle retains them. Hand-written or platform-installed checks become *visible* without being punished outside strict/destructive modes.
- **Canonicalization sorts `table.checks[]` by physical name**, and table-wide constraint-name uniqueness validation is preserved.

## Non-goals

- **A user-facing authoring surface for arbitrary checks** (e.g. `@@check` in PSL). Only generated checks (enum membership, element-non-null) are emitted; the representation is deliberately general so such a surface can be added later without another contract change.
- **`contract infer` adoption of checks into PSL.** Inference continues not to emit check attributes; generated checks are derived from column shape, so round-tripping a pulled schema re-emits them. (Pre-existing gap: a live enum-membership check does not infer back into `enumType()`; unchanged here.)
- **SQLite checks.** SQLite's planner continues to refuse check DDL as a capability decision; the Postgres authoring hook is the only check emitter, so SQLite contracts carry no checks.
- **Numeric-enum membership checks.** Still unsupported; the guard moves to authoring-time expression rendering.
- **Rename detection in the differ itself.** Rename pairing stays a planner post-pass, matching indexes and RLS.

## Definition of Done

Inherits the team-DoD floor. Project-specific close conditions:

- `elementNonNullCheckName`, `elementNonNullCheckExpression`, `isManyColumn`, `checkConstraintPlanCallStrategy`, and `parseCheckConstraintDef` are deleted. The Postgres planner contains no schema-object synthesis and no contract reads for check planning (grep-clean for `toContract` in the check path).
- A domain-enum **array** column migrates end-to-end against a real database: the check installs, an `INSERT` with an out-of-set element is rejected, an `INSERT` with a NULL element is rejected, and `db verify` is clean after apply. (This is the latent-bug fix; it currently fails at DDL time.)
- Scalar-list lifecycle: creating a table with a list column installs the element-non-null check; **adding a list column to an existing table installs it too**; dropping the column removes it; manually dropping the constraint is detected and repaired by the next plan.
- Introspection captures every `contype = 'c'` constraint — including free-form hand-written predicates, `NOT VALID` constraints (body captured without the suffix), and composite `AND` predicates — as opaque expression nodes; nothing is silently skipped. One row per constraint on partitioned/inheriting tables.
- No-drift stability: emit → migrate → introspect → verify is clean for scalar enum, array enum, and list checks, including on `varchar`-typed enum columns (the shape Postgres reprints as `((col)::text = ANY ((ARRAY[…])::text[]))`, which defeated the old parser).
- A prefix-only change plans as a single `RENAME CONSTRAINT` under `widening`; an expression change plans as drop + add; the rename pass is deterministic (sorted pairing, mirroring `pairIndexRenames`).
- Adoption: a database carrying old-model unsuffixed check names converges under a widening + destructive plan to wire-named checks via drop + add; under additive-only, the new check installs, and strict verify reports the stale one.
- Multi-namespace correctness: tables with identically named checks in two schemas plan independently (the defect class the deleted strategy had).
- `table.checks[]` canonicalizes sorted by physical name; duplicate constraint names within a table still fail validation.
- The check-constraint entry in [contract-free-migration-planning/plan.md](../contract-free-migration-planning/plan.md) is updated to record the strategy deletion delivered here.
- The ADR below is authored and promoted at close-out.

## Contract-impact

- `CheckConstraint` (contract IR) and `CheckConstraintSchema` (arktype wire schema) change shape: `{ name, column, valueSet }` → `{ name, prefix?, expression }`. This is a breaking contract change; emitted fixtures regenerate.
- `SqlCheckConstraintIR` changes shape accordingly; `resolveValueSetValues` and `convertCheck`'s value-set resolution leave the schema-IR projection (resolution now happens at authoring).
- Stale doc references to the nonexistent `verifyCheckConstraints` are removed while touching those files.

## Adapter-impact

- **Postgres** (primary): authoring hook, introspection query rewrite, planner strategy deletion + mapper extension + rename pass, op signature changes, new rename op, inline create-table checks.
- **SQLite**: mechanical follow-through on the shared IR shape change only; behavior unchanged (still refuses check DDL).
- **Mongo**: untouched.

## ADR pointer

One durable decision, authored during slice 1 as [ADR 244 — Check constraints are opaque wire-named expressions](../../docs/architecture%20docs/adrs/ADR%20244%20-%20Check%20constraints%20are%20opaque%20wire-named%20expressions.md) and amended with the rename-pairing account when slice 2 merges — extends [ADR 234](../../docs/architecture%20docs/adrs/ADR%20234%20-%20Content-addressed%20wire%20names%20for%20Postgres-normalized%20objects.md) to a third object kind; records the reversal of the check node's "structured, never raw SQL" promise, the name-based-comparison tradeoff (live tampering under an unchanged name is not detected — accepted twice already for indexes and RLS), the removal of the `valueDrift` classification, and the drop+add adoption decision.

## References

- [ADR 234 — Content-addressed wire names for Postgres-normalized objects](../../docs/architecture%20docs/adrs/ADR%20234%20-%20Content-addressed%20wire%20names%20for%20Postgres-normalized%20objects.md) — the naming convention this project extends to checks.
- [ADR 235 — The schema differ walks two derived schema IRs](../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md) — the one-differ thesis the planner change serves.
- [contract-free-migration-planning](../contract-free-migration-planning/spec.md) — the sibling project whose direct-walk inventory shrinks by one here.
- Test templates: `packages/3-targets/6-adapters/postgres/test/migrations/rls-lifecycle-e2e.integration.test.ts` (full PSL→plan→run→catalog lifecycle), `packages/3-targets/3-targets/postgres/test/migrations/index-rename-planner.test.ts` (rename-pass unit shape), `packages/3-targets/6-adapters/postgres/test/migrations/rls-introspection.integration.test.ts` (raw-SQL-then-introspect).
