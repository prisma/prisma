# Non-ported — methods-count

- `packages/client/tests/functional/methods/count/tests.ts` › `select mixed where` — `prisma.user.count({ select: { _all, email, age, name } })` — verifies per-field non-null counts — ORM aggregate builder has no `count(field)` — missing API surface
- `packages/client/tests/functional/methods/count/tests.ts` › `select mixed` — `prisma.user.count({ select: { _all, email, age, name } })` — verifies per-field non-null counts — ORM aggregate builder has no `count(field)` — missing API surface
