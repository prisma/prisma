---
changes:
  - id: having-integer-aggregate-integer-comparand
    summary: |
      A `having` comparison against an integer aggregate (`count()`, or `min`/`max`/`sum` of an integer field) now refuses a number that is not a safe integer, such as a fraction, with `ORM.ARGUMENT_INVALID`. Before, Postgres and SQLite accepted `h.max('views').gt(15.5)` because the number was written into the SQL; it is now a bound parameter of the aggregate's type. Replace a fractional comparand with the integer that keeps the comparison's meaning: `gt(15.5)` becomes `gt(15)`, `gte(15.5)` becomes `gte(16)`, `lt(15.5)` becomes `lt(16)`, `lte(15.5)` becomes `lte(15)`. An `eq` with a fractional number matched no group, so that query always returned no groups: replace it with an empty result. A `neq` with a fractional number matched every group whose aggregate is not NULL: keep that with `gte(Number.MIN_SAFE_INTEGER)`, or `gte(-(2n ** 63n))` for a bigint aggregate; for `count()`, which is never NULL, remove the condition. For a number past the safe integer range against a bigint aggregate, pass a bigint instead. `avg(...)` comparisons are unchanged.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\.having\([\s\S]*?\.(?:count|min|max|sum)\([^)]*\)\s*\.\s*(?:eq|neq|gt|gte|lt|lte)\(\s*-?\d+\.\d'
---

# A `having` comparand for an integer aggregate is an integer

```ts
// Before: accepted on Postgres and SQLite
db.orm.Post.groupBy('authorId').having((h) => h.max('views').gt(15.5));

// After: the same rows, without a fractional comparand
db.orm.Post.groupBy('authorId').having((h) => h.max('views').gt(15));
```
