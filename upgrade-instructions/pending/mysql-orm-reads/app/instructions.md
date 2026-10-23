---
changes:
  - id: having-integer-aggregate-integer-comparand
    summary: |
      A `having` comparison against an integer aggregate (`count()`, or `min`/`max`/`sum` of an integer field) now refuses a fractional number with `ORM.ARGUMENT_INVALID`. Before, Postgres accepted `h.max('views').gt(15.5)` because the number was written into the SQL; it is now a bound parameter of the aggregate's type. Replace a fractional comparand with the integer that keeps the comparison's meaning: `gt(15.5)` becomes `gt(15)`, `gte(15.5)` becomes `gte(16)`, `lt(15.5)` becomes `lt(16)`, `lte(15.5)` becomes `lte(15)`, and an `eq` or `neq` with a fractional number never matched or always matched, so rewrite or drop that condition. Bigint aggregates also refuse a number past the safe integer range; pass a bigint instead. `avg(...)` comparisons are unchanged.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\.having\([\s\S]*?\.(?:count|min|max|sum)\([^)]*\)\s*\.\s*(?:eq|neq|gt|gte|lt|lte)\(\s*-?\d+\.\d'
---

# A `having` comparand for an integer aggregate is an integer

```ts
// Before: accepted on Postgres
db.orm.Post.groupBy('authorId').having((h) => h.max('views').gt(15.5));

// After: the same rows, without a fractional comparand
db.orm.Post.groupBy('authorId').having((h) => h.max('views').gt(15));
```
