# Non-ported — issues-20261-group-by-shortcut

- `packages/client/tests/functional/issues/20261-group-by-shortcut/tests.ts` › `works with a scalar in "by" and no other selection` — subject: groupBy with scalar `by` field and no aggregation (result is only the grouped key column); prisma-next's `groupBy().aggregate()` requires at least one aggregation selector — non-ported (groupBy-only without aggregation not expressible in prisma-next public API)
- `packages/client/tests/functional/issues/20261-group-by-shortcut/tests.ts` › `works with extended client` — subject: `prisma.$extends({}).round.groupBy(...)` — `$extends()` client extension has no equivalent in prisma-next — non-ported (no `$extends` API in prisma-next)
