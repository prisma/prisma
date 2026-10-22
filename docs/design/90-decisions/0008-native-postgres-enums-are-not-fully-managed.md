# 0008 — Prisma 8 does not fully manage native Postgres enums

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Create native Postgres enum types from the contract and manage every change to them in migrations: rename, remove and reorder values.

## The decision

An `enum` declared in the contract is stored in a column with a `CHECK` constraint, not a native enum type. Prisma 8 supports native enums that something else manages, such as Supabase's. When a user manages a native enum through Prisma 8, `migration plan` only appends new values, because that is the one change Postgres allows without rewriting the table. Removing or reordering a value needs a new type and a full-table rewrite, and adding a value cannot be used in the same transaction, which breaks the atomic migrations Prisma 8 relies on.

## What to use instead

Declare an `enum` in the contract and let Prisma 8 store it with a `CHECK` constraint. For a native enum you rename, remove or reorder values in, write that migration by hand.

## Revisit if

Not recorded.

## Sources

- [Why Prisma 8 only supports externally-managed native Postgres enums](../../reference/postgres-native-enums.md)
