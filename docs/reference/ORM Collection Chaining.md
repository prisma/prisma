# ORM collection chaining

The SQL ORM client (`packages/3-extensions/sql-orm-client`) builds queries from a chain of method calls on a `Collection` — `db.orm.<Model>.where(...).orderBy(...).take(...)`. Where a clause sits in that chain, not just which clause it is, decides what it does. This page covers the one place that distinction matters most: pagination around `aggregate()` and `groupBy()`.

## Position decides scope

```ts
// Pagination BEFORE groupBy() → scope the rows, then group them
await db.orm.Post.orderBy((p) => p.views.desc()).take(10).groupBy('userId')
  .aggregate((agg) => ({ total: agg.sum('views') }));
// Sums the top 10 posts by views, then groups those 10 rows by user.

// Pagination AFTER groupBy() → page the groups themselves
await db.orm.Post.groupBy('userId').orderBy((g) => g.userId.asc()).take(10)
  .aggregate((agg) => ({ total: agg.sum('views') }));
// Groups every post by user, sums each group, then returns the first 10 groups.

// No groupBy() at all → scope the rows, then reduce to one row
await db.orm.Post.orderBy((p) => p.views.desc()).take(10)
  .aggregate((agg) => ({ total: agg.sum('views') }));
// Sums the top 10 posts by views, full stop — one row back, not one per user.
```

`take`, `skip`, `cursor`, `distinct`, `distinctOn`, and `orderBy` all read this way: written before `groupBy()`, they narrow which rows exist to be grouped; written after, they apply to the grouped rows themselves. Both readings are real, well-defined SQL — a derived table doing the row-scoping in the first case, `GROUP BY … ORDER BY … LIMIT` directly in the second — so nothing about either chain is rejected. The two forms simply answer different questions, and only the position of the clause tells you which one you asked.

This mirrors Prisma's own `aggregate()` (rows-in, row-scoping pagination) and `groupBy()` (pages the groups, when `take`/`skip` are given), which is where the position rule comes from: a chain migrated from Prisma keeps its shape and its meaning.

## What each side supports

**Before `groupBy()`** (on `Collection`): `where`, `orderBy`, `cursor`, `distinct`, `distinctOn`, `take`, `skip` all scope the row set that either `aggregate()` reduces directly or `groupBy()` groups.

**After `groupBy()`** (on `GroupedCollection`): `orderBy`, `take`, `skip` page the grouped rows. `orderBy` here only accepts the fields named in `groupBy(...)` — a grouped query can order by a group key or an aggregate, and this surface covers the former; ordering by an aggregate alias (`orderBy: { _sum: … }` in Prisma) needs its own builder and isn't available yet. `having(...)` is unaffected by position — it always filters groups, after grouping and before any post-group page.

**Post-group `take`/`skip` require a prior post-group `orderBy`.** `groupBy('userId').take(10)` with no `orderBy` is a compile error, not a runtime one — the parameter type narrows to `never`. A database can return groups in any order, so "the first 10 groups" is meaningless without one. This mirrors `cursor()`'s existing requirement for a prior `orderBy()` on the un-grouped chain.

## See also

- [ADR 201 — State-machine pattern for typed DSL builders](../architecture%20docs/adrs/ADR%20201%20-%20State-machine%20pattern%20for%20typed%20DSL%20builders.md) — the pattern `GroupedCollection` follows; the pre-/post-group split is a state transition, not a new mechanism.
- [`docs/releases/`](../releases/) — the release note for the version this shipped in describes the behaviour change for chains written before it landed.
