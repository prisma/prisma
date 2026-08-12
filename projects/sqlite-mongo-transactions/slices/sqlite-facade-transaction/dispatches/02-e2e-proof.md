# Brief: D2 — e2e behavior proof through the facade

## Task

Add `test/e2e/framework/test/sqlite/transaction.test.ts` exercising the `sqlite()` facade directly (`sqlite({ contractJson, path })` against the existing generated fixture contract), **such that** every behavioral acceptance criterion of the slice is pinned by a test that runs the real `node:sqlite` driver end-to-end: (1) commit on success — multiple writes visible after the transaction; (2) rollback on error — callback throw rethrows and no writes are visible; (3) ORM write then read inside one transaction uses the transaction scope (read-your-own-write through `tx.orm`); (4) an escaped transaction-scoped result rejects after the transaction has ended (`RUNTIME.TRANSACTION_CLOSED` guard). Tests must discriminate (a rollback test that would also pass under commit is not a test — verify state from *outside* the transaction).

## Scope

**In:**

- `test/e2e/framework/test/sqlite/transaction.test.ts` — new. Reuse `createSchema`/`seedData`/fixture helpers from `test/e2e/framework/test/sqlite/utils.ts` where applicable, but construct the client via the `sqlite()` facade (facade behavior is what this slice delivers). Use `timeouts` from `@repo/test-utils`, omit "should" in test names.
- `test/e2e/framework/test/sqlite/utils.ts` — only if a small schema/seed helper needs exporting; no changes to its existing runtime-construction path.

**Out:**

- `packages/**` — D1's facade surface is frozen for this dispatch. If e2e reveals a behavior gap in it, HALT and surface (spec amendment per invariant I12); do not patch the facade.
- Other e2e suites, docs.

## Completed when

- [ ] The four behavioral scenarios above each have a discriminating test; suite passes via `pnpm --filter e2e-tests test -- test/sqlite/transaction.test.ts` (adjust invocation to the harness's actual filter form).
- [ ] Full sqlite e2e directory still green: `pnpm --filter e2e-tests test -- test/sqlite`.
- [ ] Gates from `drive/calibration/dod.md`: e2e package lint green for the new file.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## References

- Slice spec: `projects/sqlite-mongo-transactions/slices/sqlite-facade-transaction/spec.md` — § Pre-investigated edge cases: contract verification may acquire its own connection; on a single-connection database, verification inside a transaction deadlocks. Mirror the warm-up pattern from `test/e2e/framework/test/transaction-orm.test.ts:40-45` (one query before the first transaction) if the SQLite driver shares the constraint — verify rather than assume.
- SQL e2e precedents: `test/e2e/framework/test/transaction.test.ts`, `transaction-orm.test.ts` (Postgres/PGlite equivalents of the same scenarios).
- Calibration: `drive/calibration/failure-modes.md` F13 — regression test for a boundary property must discriminate (verify rollback via an outside read, not via the callback's own state); F5 — destructive git ops forbidden.

## Edge cases

| Edge case | Disposition |
| --------- | ----------- |
| Contract verification connection inside transaction may deadlock on single-connection SQLite | Warm up the runtime with one query before the first transaction if needed; note in test if applied |
| Escaped-result test must not await the result inside the callback | Capture the `AsyncIterableResult` without awaiting, end the transaction, then assert rejection |

## Operational metadata

- **Model tier:** mid (Sonnet) — precedent-mirroring test authoring against an established harness.
- **Time-box:** 40 min. Overrun → halt and surface.
- **Halt conditions:** facade behavior gap discovered (I12 — do not patch `packages/**`); e2e harness cannot construct the facade client from the existing fixture contract without harness changes beyond `utils.ts` helper exports.
- **Affected packages:** `e2e-tests` only. Fixtures: reuse existing generated fixtures; regeneration out of scope.
- **Commit:** explicit staging, sign-off, message referencing TML-2843.
