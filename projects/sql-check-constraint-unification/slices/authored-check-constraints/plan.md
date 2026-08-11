# Slice 4 — `authored-check-constraints` — Dispatch plan

**Spec:** [`spec.md`](./spec.md) · **Branch:** `slice/authored-check-constraints`

Eight sequential dispatches. Each names one outcome; later dispatches consume earlier hand-offs. Implementer tier per [`drive/calibration/model-tier.md`](../../../../drive/calibration/model-tier.md) and the operator's standing instruction: Fable for implementers, Opus for reviewers.

Validation gates per dispatch are the team DoD floor ([`drive/calibration/dod.md`](../../../../drive/calibration/dod.md)): `pnpm typecheck`, `pnpm --filter <pkg> lint`, plus the conditional gates each dispatch's surface triggers.

| # | Outcome | Builds on | Hands to |
| --- | --- | --- | --- |
| D1 | An authored check input lowers to a correctly named `CheckConstraint` — wire from `name:`, exact from `map:` — with the body warning on the `map:`-with-body path. | — | D3, D6 |
| D2 | Derived-ness is computed from the prefix-shape rule in one shared place; the specifier strip no longer keys on wire-naming, so a non-derived wire-named check survives it. | — | D3, D6 |
| D3 | `CheckNode` exists in the definition tree and the TypeScript `check()` surface produces contracts end to end, validated. | D1, D2 | D4, D5, D6, D7 |
| D4 | `@@check` parses, validates span-anchored, and produces contracts byte-identical to the TS surface. | D3 | D5, D6, D7 |
| D5 | `sql.checkConstraint` gates the surface; SQLite rejects at authoring instead of dropping at DDL. | D3, D4 | D7 |
| D6 | `contract infer` emits `@@check(expression, map:)` for every live check that is not derived. | D1, D2, D4 | D7 |
| D7 | The defect is closed against a real database: a hand-written constraint survives infer → emit → destructive plan. | D1–D6 | D8 |
| D8 | ADR 244/243 and the user-facing docs record the surface and the closed consequence. | D1–D7 | PR |

## D1 — Authored-check naming and lowering

**Outcome.** `lowerAuthoredCheck` turns an authored check input into a `CheckConstraint`: `name:` → wire-named (`name` is the prefix, hash over the expression, `assertWireNamePrefixLength` throws when over budget), `map:` → exact-named verbatim, `map:`-with-body mints `exactNameBodyWarning('check', …)`.

**Files.** New `packages/2-sql/1-core/contract/src/authored-check-naming.ts` mirroring `index-naming.ts:101-177`; extend `EXACT_NAME_FEATURE` / `EXACT_NAME_BODY_REMEDIATION` / the `subject` union at `index-naming.ts:56-92` with `'check'`; new `packages/2-sql/1-core/contract/test/authored-check-naming.test.ts` (spec tests 1–5).

**Completed when.** Wire name is `name_<8hex>` and `parseNaming` round-trips it; expression edit changes the hash, prefix edit does not; `map:` yields the verbatim name; over-budget authored prefix throws while a derived prefix still truncates (both pinned in one test); the warning fires only on `map:`-with-body.

## D2 — The derived-check predicate

**Outcome.** One exported helper answers "is this check derived?" using the prefix-shape rule, and `stripDerivedChecksFromNonManagedTables` consumes it instead of `check.prefix === undefined`.

**Files.** Helper beside `composeCheckWirePrefix` in `packages/2-sql/1-core/schema-ir/src/naming.ts` (or a sibling in `contract-ts` if the table shape makes that cleaner — the constraint is no new package edge); rewire `packages/2-sql/2-authoring/contract-ts/src/derived-checks.ts:141-173`; update its `:44-50` comment.

**Completed when.** A wire-named check whose prefix matches no derived shape for its table survives the strip on a non-`managed` table; a derived one is still stripped; the storage-hash recompute still fires only when something was stripped; existing strip tests pass, with `check-constraint.authoring.test.ts:954-999` renamed to describe the new rule.

## D3 — Definition tree and the TypeScript surface

**Outcome.** `check({ expression, name? , map? })` on a model's `.sql({ checks: [...] })` produces a contract carrying the authored check, with every Validation-table row enforced.

**Files.** `CheckNode` + `ModelNode.checks` in `contract-definition.ts` (beside `IndexNode` `:81-90` / `:196`); `check()` in `contract-dsl.ts` (beside `index()` `:1051-1076`); call `lowerAuthoredCheck` from `build-contract.ts` near `:1133-1151`, merging into `checksForTable` before `:1182` **outside** the `derivesChecks` guard; new error subcodes `CONTRACT.CHECK_NAME_RESERVED` (+ reuse `CONTRACT.CONSTRAINT_INVALID` for arity/empty-expression) in `contract-errors.ts`; **add the matching `docs/reference/error-reference.md` entry in this dispatch** — `pnpm check:error-reference` is a Lint-job gate.

**Completed when.** Every Validation row is covered by a test; an authored check reaches `table.checks` on both `managed` and `external` tables; `pnpm fixtures:check` clean (no contract shape change).

## D4 — The PSL surface

**Outcome.** `@@check(expression: "…", name: "…" | map: "…")` parses, validates with span-anchored diagnostics, and lowers to D3's `CheckNode`.

**Files.** `checkModelSpec` in `sql-attribute-specs.ts` beside `indexModelSpec:228-280` with a `refine` for name-xor-map and required-one-of; diagnostic codes beside `:222-226`; interpretation branch in `interpreter.ts` beside `:972-1022`.

**Completed when.** Each valid form produces a contract byte-identical to its TS equivalent including `storageHash`; each invalid form is a span-anchored diagnostic.

## D5 — Capability gate and SQLite

**Outcome.** `@@check` / `check()` on a target without `sql.checkConstraint` is an authoring error, and SQLite can no longer silently drop a declared check.

**Files.** Capability in the matrix + `packages/3-targets/6-adapters/postgres/src/core/adapter.ts:33-39` and `descriptor-meta.ts:188`; gate mirroring `psl-field-resolution.ts:499-507`; `check` branch in `packages/3-targets/3-targets/sqlite/src/core/migrations/column-ddl-rendering.ts:150-179` that throws.

**Completed when.** A SQLite contract declaring a check fails at authoring with a span-anchored diagnostic naming the target; the DDL renderer throws rather than dropping if one ever reaches it.

## D6 — Infer emission

**Outcome.** Pulling a database emits `@@check(expression: <reprint>, map: <physical name>)` for every live check that is not derived.

**Files.** `buildCheckAttribute` in `psl-infer/infer-index-attributes.ts` beside `buildIndexAttribute`; wire into `buildModel`'s `modelAttributes` between `@@index` (`infer-model-blocks.ts:116-121`) and `@@map` (`:123-125`); lift the derived-name computation out of the per-column branch (`:274-304`) so both the `@noCheck` decision and the `@@check` exclusion read one set.

**Completed when.** A live derived check emits no `@@check`; a live hand-written check emits one carrying the reprinted body; a table with both emits exactly one; existing `print-psl` byte assertions updated deliberately.

## D7 — Lifecycle and the defect regression

**Outcome.** The reported defect is closed, proven against a real database.

**Files.** `packages/3-targets/6-adapters/postgres/test/migrations/check-lifecycle-e2e.integration.test.ts` (spec tests 6–7); the end-to-end journey (spec test 8) in the same suite or `test/integration/test/cli-journeys/`.

**Completed when.** An authored `name:` check installs at `CREATE TABLE`, rejects a violating insert, verifies clean; expression edit plans one drop + one add, prefix edit plans one `RENAME CONSTRAINT`; **and the regression journey — raw-SQL constraint → infer → emit → destructive plan carries no `dropCheckConstraint` — passes here and fails on `main`.**

## D8 — Documentation

**Outcome.** The decision and the closed consequence are recorded where the next reader will look.

**Files.** ADR 244 (§ derived marker now prefix-shape; § equivalence covers authored checks; the known-cost entry is closed), ADR 243 cross-reference, `skills/prisma-8/references/contract.md`, `skills/prisma-8/references/quickstart.md`, the `derived-checks.ts` comment.

**Completed when.** No doc still states that hand-written checks cannot be declared; the `map:`-warning-on-infer-output behaviour is documented as known rather than reading as a defect.

## Risks carried into the loop

- **D2's prefix rule is weaker than infer's hash rule.** Closed by the `CHECK_NAME_RESERVED` authoring error (spec § The derived-check marker). If D2 finds that error impractical to raise where the table's columns are in hand, stop and re-decide — do not silently accept misclassification.
- **D6 moves byte-asserted infer fixtures.** Expected; the diff must be reviewed as intent, not accepted wholesale.
- **D7 is the only dispatch that can prove the slice.** If it cannot be made to fail on `main`, the regression test is not testing the defect.
