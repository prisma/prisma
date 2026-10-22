# 0005 — `@default` does not call client-side generators

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Write `@default(uuid())`, `@default(cuid())` or another client-side function in `@default`, as in Prisma 7.

## The decision

`@default` means a database default. A value the client generates is written with `@onCreate(...)` or `@onUpdate(...)`. ADR 275 rejected letting `@default(fn())` choose database or client by the function, because a reader of the schema cannot tell from `@default(uuid())` which one writes the value. The schema parser refuses a generator in `@default` and names `@onCreate(...)`.

## What to use instead

`@onCreate(uuid())` for a client-generated id. `@onCreate(now()) @onUpdate(now())` in place of `@updatedAt`. A type alias in a `types` block to reuse a column type with its generators.

## Revisit if

The ADR records no condition.

## Sources

- [ADR 275](../../architecture%20docs/adrs/ADR%20275%20-%20Client%20generators%20are%20field%20attributes,%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md)
- [scorecard: PSL schema language, `@default(uuid())`](../../../scorecard/03-psl-schema-language.md)
