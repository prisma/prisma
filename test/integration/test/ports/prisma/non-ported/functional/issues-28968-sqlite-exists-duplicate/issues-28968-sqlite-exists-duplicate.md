# Non-ported — issues-28968-sqlite-exists-duplicate

- `packages/client/tests/functional/issues/28968-sqlite-exists-duplicate/tests.ts` › `should not duplicate rows for a nested "some ... in" query` — SQLite nested `some { type: { in: [...] } }` relation filter does not return duplicate parent rows — SQLite-only (`_matrix.ts`: `[[{ provider: Providers.SQLITE }]]`; `optOut.from: ['mongodb', 'sqlserver', 'postgresql', 'mysql', 'cockroachdb']`). SQLite target is pre-GA with no integration harness per spec.
