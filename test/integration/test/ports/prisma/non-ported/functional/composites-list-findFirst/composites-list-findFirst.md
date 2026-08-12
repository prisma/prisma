# Non-ported — composites-list-findFirst

- `packages/client/tests/functional/composites/list/findFirst.ts` › `select` — projects a composite subfield (`contents: { select: { text: true } }`) — prisma-next `select()` projects only top-level model fields, not embedded value-object subfields.
- `packages/client/tests/functional/composites/list/findFirst.ts` › `orderBy` — `orderBy: { contents: { _count: 'asc' } }` (order by embedded-list count) — prisma-next `orderBy` accepts only scalar model fields with `1 | -1`.
