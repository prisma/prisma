# ADR 283 — `@default` does not call client-side generators

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 275 — Client generators are field attributes, and a type alias is expanded into each column](ADR%20275%20-%20Client%20generators%20are%20field%20attributes,%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md)

---

## Decision

`@default` means a database default. A value the client generates is written with `@onCreate(...)` or `@onUpdate(...)`, and the schema parser refuses a generator in `@default` and names `@onCreate(...)`. Use instead: `@onCreate(uuid())` for a client-generated id; `@onCreate(now()) @onUpdate(now())` in place of `@updatedAt`; a type alias in a `types` block to reuse a column type with its generators.

## Context

Prisma 7 accepts `@default(uuid())`, `@default(cuid())` and other client-side functions, and users write the same in Prisma 8. [ADR 275](ADR%20275%20-%20Client%20generators%20are%20field%20attributes,%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md) rejected letting `@default(fn())` choose database or client by the function, because a reader of the schema cannot tell from `@default(uuid())` which one writes the value. The [scoreboard](../../../scorecard/03-psl-schema-language.md) records the change.

## Consequences

A reader of the schema can tell which side writes each value. [ADR 275](ADR%20275%20-%20Client%20generators%20are%20field%20attributes,%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md) records no revisit-if condition.
