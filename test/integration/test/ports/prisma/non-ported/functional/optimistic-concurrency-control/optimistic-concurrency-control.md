# Non-ported — optimistic-concurrency-control

- `packages/client/tests/functional/optimistic-concurrency-control/tests.ts` › `updateMany` — concurrent `updateMany` with `{ increment: 1 }` only applies once — `{ occStamp: { increment: 1 } }` atomic field update not in ORM API (`updateAll()` accepts plain values only)
- `packages/client/tests/functional/optimistic-concurrency-control/tests.ts` › `update` — concurrent `update` with `{ increment: 1 }` only applies once — same; `{ occStamp: { increment: 1 } }` not expressible
- `packages/client/tests/functional/optimistic-concurrency-control/tests.ts` › `upsert` — concurrent `upsert` with `{ increment: 1 }` update only applies once — same; `update: { occStamp: { increment: 1 } }` not expressible
- `packages/client/tests/functional/optimistic-concurrency-control/tests.ts` › `update with upsert relation` — `update` with `increment` + nested child `upsert` — `{ increment: 1 }` + nested `child: { upsert: {...} }` both inexpressible
