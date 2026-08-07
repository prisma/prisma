# Non-ported — unsupported-action

- `packages/client/tests/functional/unsupported-action/tests.ts` › `unsupported method` — calling `prisma.user.aggregateRaw()` on a SQL provider rejects with an inline-snapshotted "does not match any query" Prisma error [providers: exclude:mongodb] — the SQL ORM collection does not expose `aggregateRaw`; forcing a call would produce a JavaScript missing-method `TypeError`, not Prisma’s structured runtime rejection from dispatching an unsupported model action, so the exact error behavior cannot be expressed
