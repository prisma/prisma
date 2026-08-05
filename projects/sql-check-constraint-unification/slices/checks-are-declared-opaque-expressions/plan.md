# Slice 1 plan — dispatch decomposition

**Spec:** [`spec.md`](./spec.md). Dispatches are sequential; each brief is assembled at dispatch time from the spec + the entry below. Workspace-wide green is a slice-end property (D5), not a per-dispatch gate — per-dispatch gates are package-scoped.

| # | Dispatch | Outcome (one sentence) |
| --- | --- | --- |
| 1 | `substrate-opaque-check-nodes` | The core IR alphabet holds opaque wire-named checks end to end: contract `CheckConstraint` and `SqlCheckConstraintIR` are `{ name, prefix?, expression }`, `computeCheckContentHash` exists, projection passes naming+expression through, and the `valueDrift` classification branch is gone. |
| 2 | `authoring-emits-checks` | Emitted contracts carry wire-named expression checks — scalar-enum `IN`, array-enum `<@` (the DDL bug fix), element-non-null for every `many` column — rendered by a duck-typed Postgres authoring hook. |
| 3 | `introspection-captures-all-checks` | Postgres introspection returns every `contype='c'` constraint as an opaque check node via `pg_get_expr(conbin)` (+ `conislocal`, `conrelid <> 0`); `parseCheckConstraintDef` is deleted. |
| 4 | `planner-reconciles-checks` | Check planning is diff-driven only: strategy + element-non-null synthesis deleted, `mapCheckNodeIssue` handles add/drop/conflict, CREATE TABLE renders checks inline from node children, `AddCheckConstraintCall` takes an expression. |
| 5 | `lifecycle-proof-and-close` | The lifecycle integration suite proves the slice DoD against real Postgres; fixtures regenerated; grep gates clean; docs touched; branch synced with main and workspace-wide gates green. |

## Dispatch detail

### 1 — `substrate-opaque-check-nodes`

Packages: `2-sql/1-core/contract`, `2-sql/1-core/schema-ir`, `2-sql/9-family`. Tests first in each package.

- `naming.ts`: `computeCheckContentHash(expression)` = `sha256(JSON.stringify([normalizeSqlBody(expression)])).slice(0,8)` + unit tests (stability, whitespace-normalization).
- `check-constraint.ts`: `{ naming: SqlObjectNaming, expression }` input → flat `{ name, prefix?, expression }` node (the `Index` pattern incl. `parseNaming` on deserialization); arktype schema updated with `'+': 'reject'`; canonicalization sorts `table.checks[]` by `name`; name-uniqueness validation preserved.
- `sql-check-constraint-ir.ts`: same shape; `id = check:${name}`; `isEqualTo` wire→id equality / exact→verbatim expression; doc rewritten (drop the stale `verifyCheckConstraints` reference).
- `contract-to-schema-ir.ts`: `convertCheck` passes through; delete `resolveValueSetValues` + its check-side callers and the stale doc reference; `schema-verify.ts`: remove the check→`valueDrift` branch.
- Rewrite `check-constraint.test.ts`, `sql-check-constraint-ir.test.ts` and the family projection/verify tests for the new shape.

Gates: package-scoped typecheck + lint + tests for the three packages. **Builds on:** main. **Hands to:** the node shape every later dispatch compiles against; hash + naming helpers.

### 2 — `authoring-emits-checks`

Packages: `2-sql/2-authoring/contract-ts`, `3-targets/3-targets/postgres` (descriptor-meta / authoring contribution). Tests first.

- Duck-typed hook (pattern: `qualifyColumnType`, `build-contract.ts:240-300`) contributed by the Postgres pack; renders the three expression forms with target-side quoting; throws `CONTRACT.ENUM_INVALID` on non-string members; `assertWireNamePrefixLength` on generated prefixes.
- `build-contract.ts` check emission (`:806-833`) calls the hook; emission conditions unchanged (handle-path enums only; every `many` column gets element-non-null).
- Rewrite `check-constraint.authoring.test.ts`: scalar, array (`<@` form asserted), `many` non-enum, native `pg.enum` array (no membership check, element-non-null present), non-pg codec, prefix-overflow throw, JSON round-trip.

Gates: package-scoped typecheck + lint + tests (contract-ts, postgres target). **Builds on:** D1. **Hands to:** contracts/fixtures carrying wire-named checks for D4/D5 tests.

### 3 — `introspection-captures-all-checks`

Package: `3-targets/6-adapters/postgres`. Tests first.

- Query rewrite (`control-adapter.ts:926-961`): `pg_get_expr(c.conbin, c.conrelid)`, `AND c.conislocal AND c.conrelid <> 0`; node construction stores body verbatim + `namingOfLiveName`; delete `parseCheckConstraintDef` and its silent-skip block.
- Rewrite `control-adapter.check-constraints.test.ts` (mocked-driver shape) for opaque capture; add raw-SQL introspection integration test (template: `rls-introspection.integration.test.ts`) covering free-form predicate, composite `AND`, `NOT VALID`, wire-shaped name → wire naming claim.

Gates: package-scoped typecheck + lint + tests incl. the new integration test. **Builds on:** D1 (node shape). **Hands to:** a complete live side of the check diff.

### 4 — `planner-reconciles-checks`

Package: `3-targets/3-targets/postgres` (+ sqlite mechanical follow-through if the shared shape reaches it). Tests first.

- Delete `checkConstraintPlanCallStrategy`, `collectContractChecks`, `checkValueSetsEqual`, `elementNonNullCheck*`, `isManyColumn`; remove strategy registration.
- `mapCheckNodeIssue`: `not-found` → add, `not-expected` → drop, `not-equal` → `unsupportedOperation` conflict.
- `buildCreateTableCallsFromNode`: render node's check children inline (replaces synthesis; enum checks move inline-at-create).
- `AddCheckConstraintCall` → `(schemaName, tableName, constraintName, expression)`; DDL `ADD CONSTRAINT "x" CHECK (<expr>)`; `renderTypeScript` + migration-class method updated; no compat shims.
- Rewrite `planner.check-constraints.test.ts` (issue-driven add/drop/conflict, multi-namespace independence), create-table inline-check unit tests, `native-array-columns` test updated for contract-declared element checks.

Gates: package-scoped typecheck + lint + tests; grep gates for the deleted symbols. **Builds on:** D1 (shape), D2 (fixtures for end-to-end planner tests). **Hands to:** a planner that only reconciles.

### 5 — `lifecycle-proof-and-close`

Workspace-wide. Test-first is the point: this dispatch *is* the proof.

- Lifecycle integration suite (template: `rls-lifecycle-e2e`): evolve `enum-check-constraint.integration.test.ts` + new list-check lifecycle — every SDoD2 scenario from the spec (varchar no-drift, array-enum element rejection incl. NULL element, add-list-column, manual loss repair, adoption drop+add under full and additive-only policies, multi-namespace).
- Fixture regen (`pnpm fixtures:check`); investigate any unrelated drift.
- Docs: strategy-deletion note in `contract-free-migration-planning/plan.md`; confirm no stale `verifyCheckConstraints` references remain (grep).
- Merge `origin/main`, then full gates: `pnpm typecheck`, `pnpm lint:deps`, `pnpm test:packages`, `pnpm test:integration`, `pnpm fixtures:check`, per-package lint on touched packages.
- Walk the slice-DoD checklist verbatim (slice-close ritual).

Gates: the full conditional set + SDoD1 grep gates. **Builds on:** D1–D4. **Hands to:** slice-DoD met; PR-open.

## Non-linear dependencies

D3 depends only on D1 (not D2). D4 needs D2's emitted fixtures for its end-to-end tests. D5 consumes everything.

## Model routing

Implementer dispatches: Opus (operator's standing instruction). Reviewer rounds: Opus (the operator's preferred mid-tier reviewer model is not exposed in this session's harness).
