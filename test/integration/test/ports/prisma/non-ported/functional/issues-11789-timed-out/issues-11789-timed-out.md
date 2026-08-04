# Non-ported — issues-11789-timed-out

Every test is SQLite-only. `_matrix.ts` declares `provider: Providers.SQLITE` only, and the `optOut` block excludes `sqlserver`, `mongodb`, `postgresql`, `cockroachdb`, and `mysql` ("Test is made for SQLite only"). The 100-concurrent-creates test is further narrowed by an inline `testIf([Providers.SQLITE].includes(provider))` guard. The SQLite corpus is out of scope per spec § No SQLite corpus.

- `packages/client/tests/functional/issues/11789-timed-out/tests.ts` › `5 concurrent upsert should succeed` — verifies 5 concurrent profile upserts complete without timeout on SQLite — SQLite-only; matrix `provider: Providers.SQLITE` + optOut excludes all other providers; SQLite corpus out of scope
- `packages/client/tests/functional/issues/11789-timed-out/tests.ts` › `5 concurrent delete should succeed` — verifies 5 concurrent user deletes complete without timeout on SQLite — SQLite-only; matrix `provider: Providers.SQLITE` + optOut excludes all other providers; SQLite corpus out of scope
- `packages/client/tests/functional/issues/11789-timed-out/tests.ts` › `100 concurrent creates should succeed` — verifies 100 concurrent user+profile creates complete without timeout on SQLite — SQLite-only; gated by `testIf([Providers.SQLITE].includes(provider))` inline guard + matrix `provider: Providers.SQLITE`; SQLite corpus out of scope
