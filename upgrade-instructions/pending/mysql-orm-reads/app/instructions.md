---
changes:
  - id: having-integer-aggregate-integer-comparand
    summary: |
      A `having` comparand is now a bound parameter of the aggregate's type, where Postgres and SQLite used to write the number into the SQL. Two comparands that worked before now fail. First, against an integer aggregate (`count()`, or `min`/`max`/`sum` of an integer field), a number that is not a safe integer, such as `h.max('views').gt(15.5)`, is refused with `ORM.ARGUMENT_INVALID`. Rewrite it with the integer that keeps its meaning: `gt(x)` becomes `gt(Math.floor(x))`, `gte(x)` becomes `gte(Math.ceil(x))`, `lt(x)` becomes `lt(Math.ceil(x))` and `lte(x)` becomes `lte(Math.floor(x))`, which also holds for negative numbers. A fractional `eq` matched no group, so that query always returned no groups: replace it with an empty result. A fractional `neq` matched every group whose aggregate is not NULL: for `count()`, which is never NULL, remove the condition; otherwise use `gte` with the smallest value the aggregate's type holds, such as `gte(-2147483648)` for `max` of a 4-byte integer column. Second, on Postgres, a comparand outside the range of the aggregate's type, such as `h.max('views').gt(3_000_000_000)` on a 4-byte integer column, now fails with the database's "out of range" error. On a non-NULL group such a comparison was always false for `gt`, `gte` and `eq`, and always true for `lt`, `lte` and `neq`; rewrite it the same way. Against a bigint aggregate, pass a number past the safe integer range as a bigint. `avg(...)` comparisons are unchanged.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\.having\([\s\S]*?\.(?:count|min|max|sum)\([^)]*\)\s*\.\s*(?:eq|neq|gt|gte|lt|lte)\(\s*-?(?:\d+\.\d|\d{10})'
---

# A `having` comparand is a parameter of the aggregate's type

```ts
// Before: accepted on Postgres and SQLite
db.orm.Post.groupBy('authorId').having((h) => h.max('views').gt(15.5));

// After: the same groups
db.orm.Post.groupBy('authorId').having((h) => h.max('views').gt(15));
```
