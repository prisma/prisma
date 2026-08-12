# Slice B — dispatch evidence (for the reviewer pass)

## D1 — append lowering + refusal message + op + docs page

**Gate:** `target-postgres` typecheck ✓ · `target-postgres` test ✓ (67 files / 924 tests, 0 fail).

**Orchestrator spot-checks (verified in-tree, not just report):**
- `isNativeEnumSuffixAppend` = strict prefix (`actual.length < expected.length && actual.every((m,i)=>m===expected[i])`). Correctly refuses all four classes: rename, removal (expected shorter), reorder (equal length), DB-ahead (actual longer). `issue-planner.ts`.
- `not-equal` tail: suffix-append → one `AddNativeEnumValueCall` per `expected.members.slice(actual.members.length)`, declaration order; else refusal (`unsupportedOperation`, same location).
- Refusal string matches spec §2 verbatim incl. `https://pris.ly/d/postgres-native-enums` (`issue-planner.ts:572-575`).
- `AddNativeEnumValueCall` renders `ALTER TYPE <qualified> ADD VALUE '<escapeLiteral(value)>'`; `validateEnumValueLength` at construction; typed prechecks (type-exists, value-absent) + postcheck (value-present); `summary` carries the non-transactional caveat (`op-factory-call.ts:1449,1483`). `additive` op class. Each value its own op.
- Hand-authored `addNativeEnumValue` via `controlAdapterFor('addNativeEnumValue')`.
- Docs: explainer moved to `docs/reference/postgres-native-enums.md`; `projects/.../why-native-postgres-enums.md` is now a pointer.
- New typed check builders `nativeEnumTypeExistsAst` / `nativeEnumValueExistsAst` in `contract-free/checks.ts`.

**Tests added:** `native-enum-planner.add-value.test.ts` (16) — single/multi append, 4 refusal classes (exact diagnostic asserted), op SQL/escape/qualification/prechecks/postcheck/caveat/length-throw. Reorder-diagnostic regex in `native-enum-planner.test.ts` updated to new wording.

**Reviewer focus:** the `additive` op-class choice for `addNativeEnumValue` (does `tolerated`/`external` grading treat an append correctly under the control-policy partition?); the `qualifiedNativeEnumTypeName` unbound-namespace path.

## D2 — live proof (PGlite)

**Gate:** `target-postgres` typecheck ✓ · `target-postgres` test ✓ (67 files / 924) · `adapter-postgres` typecheck ✓ · `adapter-postgres` test ✓ — the native-enum lifecycle suite is green; the one red in that run, `rls-migration-plan.integration.test.ts` ("timed out in 100ms"), is a pre-existing parallel-load flake (its per-test budget is 100 ms), green in isolation and untouched by this slice.

**Verified live (PGlite), in `native-enum-lifecycle-e2e.integration.test.ts`:**
- R8 single append → one `addNativeEnumValue.order_status.done` op whose rendered description carries the non-transactional caveat; applied; introspection shows `[draft, review, done]`; strict verify green.
- R8 multi append → three ops in declaration order (`archived`, `cancelled`, `refunded`); applied; introspected in order; verify green.
- R9 rename / removal / reorder → each `planDirect` returns `failure` carrying the exact operator-worded refusal (verbatim `orderStatusRefusalMessage`), zero ops, and the live member list is unchanged after the attempt (DB untouched).
- R5 external enum carrying a live-appended fourth value → zero `addNativeEnumValue` / `createNativeEnumType` / `dropNativeEnumType` ops under the external grade; the extra live value is left in place.

**Verified live (real PostgreSQL), in `native-enum-add-value.real-postgres.integration.test.ts`:** against a genuine Postgres server (throwaway database created/dropped on a maintenance connection, availability-gated so a bare checkout skips, and matching the `postgres:15` service CI already provisions on `localhost:5432`), the append applies and the new value is usable for CRUD in statements after the migration commits — INSERT `'done'` → SELECT; INSERT `'draft'` → UPDATE to `'done'` → SELECT; DELETE — plus strict verify clean. This is the cross-transaction usability PGlite's single-connection model can't fully stand in for.

**Enums-only namespace pulled from scope (Option A):** whether a model-less, enums-only namespace reaches verify/plan is an authoring-surface limitation (`buildSqlContractFromDefinition` derives a namespace's existence from its models), not a planner one — moved to the generic contract-builder follow-up slice. D2's `pruneTableLessNamespaces` widening and its enums-only tests were reverted; Slice A's prune stands unchanged. Reviewer focus for this dispatch is carried by D1 above (the `additive` op-class grading and the `qualifiedNativeEnumTypeName` unbound path).
