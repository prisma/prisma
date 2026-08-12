# Non-ported — skip

- `packages/client/tests/functional/skip/test.ts` › `skips arguments` — `where: Prisma.skip` sentinel omits the filter — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` › `skips input fields` — `where: { name: Prisma.skip }` sentinel omits the field — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` › `skips relations in include` — `include: { posts: Prisma.skip }` sentinel omits the relation — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` › `skips relations in select` — `select: { posts: Prisma.skip }` sentinel omits the relation — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` › `skips fields in omit` — `omit: { email: Prisma.skip }` sentinel is a no-op on omit — prisma-next has no skip sentinel and no omit clause
- `packages/client/tests/functional/skip/test.ts` › `skips fields in create` — `data: { content: Prisma.skip }` sentinel omits nullable field — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` › `skips fields in nested create` — `create: { content: Prisma.skip }` sentinel in nested write — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` › `skips fields in create with non-nullable field with default` — `data: { name: Prisma.skip }` falls back to DB default — prisma-next has no skip sentinel
- `packages/client/tests/functional/skip/test.ts` (after extension) › `skips relations in include` — `Prisma.skip` in `$extends({})` client include — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after extension) › `skips relations in select` — `Prisma.skip` in `$extends({})` client select — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after extension) › `skips fields in omit` — `Prisma.skip` in `$extends({})` client omit — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after query extension) › `skips fields in create with query extension` — `Prisma.skip` through `$extends({ query })` — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after query extension) › `skips input fields in findMany with query extension` — `Prisma.skip` through query extension — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after query extension) › `skips arguments in findMany with query extension` — `Prisma.skip` through query extension — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after query extension) › `skips relations in include with query extension` — `Prisma.skip` through query extension — prisma-next has no skip sentinel and no $extends
- `packages/client/tests/functional/skip/test.ts` (after query extension) › `skips relations in select with query extension` — `Prisma.skip` through query extension — prisma-next has no skip sentinel and no $extends
