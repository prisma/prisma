# 0007 — No `Unsupported("...")` field type

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Declare a column of a type Prisma does not model with `Unsupported("ltree")`, as in Prisma 7.

## The decision

`Unsupported("...")` is not a Prisma 8 type, and `contract emit` refuses it. A column whose type no data type claims is a raw column instead (ADR 273): its type is kept exactly as the database prints it, values pass through untyped, and migrations and `db verify` handle it.

## What to use instead

Write the column as ``Raw(sql`ltree`)``. A Prisma 7 schema read as a contract source still accepts `Unsupported("...")` and reads each such field as a raw column (ADR 252).

## Revisit if

The ADR records no condition.

## Sources

- [scorecard: PSL schema language, `Unsupported`](../../../scorecard/03-psl-schema-language.md)
- [ADR 273](../../architecture%20docs/adrs/ADR%20273%20-%20A%20column%20of%20a%20type%20no%20data%20type%20claims%20is%20a%20raw%20column.md)
- [ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)
