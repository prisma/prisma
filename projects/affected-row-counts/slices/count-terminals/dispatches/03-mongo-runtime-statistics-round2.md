# Brief: D3 Round 2 — restore Mongo public type and decode evidence

## Task

Resolve reviewer F4 by migrating the Mongo runtime public type test to the settled query/statistics contract and restoring one representative query-builder decode test on the row `query` path, such that public typing and result-shape codec behavior are independently proven after the hard cut.

## Scope

**In:** `packages/2-mongo-family/7-runtime/test/mongo-runtime.types.test-d.ts` and the smallest representative result-shape decode test in `decode-via-query-builder.test.ts`; only supporting test-helper edits that are mechanically required by those tests.

**Out:** The remaining broad Mongo runtime test fan-out assigned to D6; production code; new behavior; compatibility aliases; additional cleanup.

## Completed when

- [ ] Public type tests assert `query(plan)` returns `AsyncIterableResult<Row>` and `execute(plan)` returns `Promise<RuntimeStatementStats>` without retaining row-execute claims.
- [ ] A representative query-builder plan passes through `runtime.query`, result-shape codec decoding, and `.toArray()` with the expected decoded row.
- [ ] The two focused tests, Mongo runtime lint, and Mongo runtime production build pass; changes are signed and explicitly staged.

## Operational metadata

- **Model tier:** mid — focused test migration on a settled implementation.
- **Time-box:** 25 minutes.
- **Halt conditions:** The decode path fails for a production reason rather than stale test vocabulary; production edits are required; the public contract differs from D1/D3; destructive git would be required.
