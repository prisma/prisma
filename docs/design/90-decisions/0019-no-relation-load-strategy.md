# 0019 — No `relationLoadStrategy`

**Status:** `never`
**Decided by:** Will Madden, 2026-10-22

## The request

Choose how a query loads relations, as Prisma 7's `relationLoadStrategy: 'join' | 'query'` option does: one statement with database joins, or one query per relation.

## The decision

Never. Will Madden: "relationLoadStrategy was a hack in old versions of prisma which performed in-memory joins and relationLoadStrategy was the feature flag to get newer behavior using DB joins. there's no use case to support it in prisma 8."

Prisma 8 does not need the switch. A query plan lowers to one SQL statement, and relations are loaded by the database in that statement (ADR 003). Where the ORM client runs several queries for one call, it does so as a client that orchestrates queries, and the middleware sees them as a tree of activities. In Will's words: "one query is one SQL statement but the ORM is a client, not a query builder, it orchestrates multiple queries. the middleware activity representation allows us to express this as a tree similar to otel." (ADR 271).

## What to use instead

Nothing is needed: include the relation, and the database joins it. To see what a call ran, observe its activities with middleware (ADR 271).

## Sources

- [ADR 003](../../architecture%20docs/adrs/ADR%20003%20-%20One%20Query%20One%20Statement.md)
- [ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)
