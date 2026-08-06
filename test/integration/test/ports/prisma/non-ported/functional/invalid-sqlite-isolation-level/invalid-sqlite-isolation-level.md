# Non-ported — invalid-sqlite-isolation-level

- `packages/client/tests/functional/invalid-sqlite-isolation-level/tests.ts` › `invalid level generates run- and compile- time error` — passes `ReadUncommitted` to the array-form transaction API on SQLite and asserts both compile-time rejection and the SQLite connector conversion error — non-portable because the test is SQLite-only, prisma-next has no SQLite integration harness in this project, and prisma-next exposes callback transactions rather than Prisma's array-form `$transaction([...], { isolationLevel })` input.
