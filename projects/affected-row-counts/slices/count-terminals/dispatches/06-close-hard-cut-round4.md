# Brief: D6 Round 4 — remove residual row-execute surfaces

## Task

Resolve review findings F5–F7 and complete the compatibility-free hard cut: remove the Mongo facade's row-returning `execute` alias, migrate its row callers through the existing runtime `query` operation despite the facade's static-builder `query` property, correct remaining row/statistics classifications and fakes, and clean inaccurate retired terminology.

## Scope

**In:**

- Remove `MongoClient.execute(plan): AsyncIterableResult<Row>` and `execute: queryRows` from `packages/3-extensions/mongo/src/runtime/mongo.ts`. Keep `db.query` as the static builder. Facade callers that execute built plans must obtain the existing `db.runtime()` and invoke `runtime.query(plan)`; do not add another facade alias.
- Migrate all affected Mongo facade tests, type tests, examples, and direct callers. Add discriminating public type evidence that the facade no longer exposes row `execute` and that connected runtime `query` returns rows.
- Correct `packages/2-sql/4-lanes/relational-core/test/ast/driver-types.types.test-d.ts` so query is the row stream and execute returns `SqlStatementStats`, without a whole-object cast concealing the contract.
- Route the two SELECT plans in `test/integration/test/sql-builder/raw-sql.integration.test.ts` through `runtime.query` and consume their results.
- Resolve F6's listed stale test names/prose. Describe cache query identity through `prepareExecution`, not `executeStatisticsAgainstQueryable`.

**Out:** Renaming the Mongo static builder, adding `queryRows`/`run`/other facade compatibility methods, changing runtime semantics, fixing unrelated CLI infrastructure, broad architecture documentation owned by Slice 3.

## Completed when

- [ ] Expanded scans find no row-returning facade `execute`, no Mongo facade caller using it, no swapped row/statistics fake, and no D6-owned retired row/prepared execute wording from F6.
- [ ] Mongo facade and examples build/typecheck/test with rows executed through runtime `query`; the PostgreSQL raw-SQL focused integration tests consume query results and pass.
- [ ] Touched package tests/lint/build, workspace typecheck, dependency lint, and independent integration/e2e gates preserve prior evidence. Known CLI executable/timeouts remain recorded rather than fixed.

## Operational metadata

- **Model tier:** mid — the API resolution is settled above; implementation is hard-cut fan-out.
- **Time-box:** 90 minutes.
- **Halt conditions:** A caller cannot use the existing runtime query without a new public API; removing facade execute breaks a documented product requirement not superseded by this slice; a new semantic decision appears; unrelated production code would need change.
