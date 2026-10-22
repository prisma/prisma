# ADR 280 — Prisma 8 does not batch queries automatically

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 003 — One Query One Statement](ADR%20003%20-%20One%20Query%20One%20Statement.md)

---

## Decision

A query lane call compiles to exactly one statement, with no hidden follow-up reads, and the client does not merge reads behind the scenes. Use instead: load related rows in the same query with `.include(...)`, which lowers to one statement; fetch many rows by key with one query that filters on the list of keys; run several queries together explicitly inside `db.transaction(...)`.

## Context

Prisma 7 batches concurrent `findUnique` calls into one query, and users ask for the same, or for a transparent data loader. [ADR 003](ADR%20003%20-%20One%20Query%20One%20Statement.md) considered "auto-batching and transparent data loaders" and rejected them because they reintroduce non-determinism and complicate budgets and lints. The [scoreboard](../../../scorecard/06-sql-orm-client.md) lists `findUnique` auto-batching as not in 8.0.

## Consequences

Performance stays predictable, and a user who wants batching writes the query that batches. [ADR 003](ADR%20003%20-%20One%20Query%20One%20Statement.md) records no revisit-if condition.
