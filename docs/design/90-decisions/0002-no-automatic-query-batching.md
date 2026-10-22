# 0002 — No automatic batching or data loader

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Batch concurrent `findUnique` calls into one query automatically, as Prisma 7 does, or add a transparent data loader that merges reads behind the scenes.

## The decision

A query lane call compiles to exactly one statement, with no hidden follow-up reads. ADR 003 considered "auto-batching and transparent data loaders" and rejected them because they reintroduce non-determinism and complicate budgets and lints. The scorecard lists `findUnique` auto-batching as not in 8.0.

## What to use instead

Load related rows in the same query with `.include(...)`, which lowers to one statement. Fetch many rows by key with one query that filters on the list of keys. Run several queries together explicitly inside `db.transaction(...)`.

## Revisit if

The ADR records no condition.

## Sources

- [ADR 003](../../architecture%20docs/adrs/ADR%20003%20-%20One%20Query%20One%20Statement.md)
- [scorecard: SQL ORM client, `findUnique` auto-batching](../../../scorecard/06-sql-orm-client.md)
