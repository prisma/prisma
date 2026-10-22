---
changes:
  - id: sql-builder-insert-required-columns
    summary: |
      A SQL builder insert, `db.sql.<namespace>.<table>.insert([...])`, must now include every column that is not nullable and has no default. Leaving one out is a type error that names the column, and so is a value typed `T | undefined` for such a column under `exactOptionalPropertyTypes`. Add a real value, narrowed to `T`.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '\.insert\(\['
  - id: orm-create-on-update-only-field
    summary: |
      In ORM `create` and `upsert`, a field that is not nullable, has no default and has only `@onUpdate(...)` (or `.onUpdate(...)` in a TypeScript contract) is now required. Pass a value for it on create, or give it `@onCreate(...)` too.
    detection:
      glob: "**/*.{prisma,ts}"
      matches:
        - '@onUpdate\('
        - '\.onUpdate\(gen\.'
---

# Inserts must include the columns the database requires

The SQL builder's `insert` used to accept a row that left out any column. A row without a value for a column that is not nullable and has no default compiled, and then the database rejected it with a not-null error. The row type now requires those columns:

```typescript
// User.displayName is `String` with no default
db.sql.public.user.insert([{ email: 'admin@example.com', kind: 'admin' }]);
// error: Property 'displayName' is missing

db.sql.public.user.insert([{ email: 'admin@example.com', kind: 'admin', displayName: 'Admin' }]);
```

A column is still optional when it is nullable, when it has a default (`@default(...)`, including `now()` and `autoincrement()`), or when the client generates its value on create with `@onCreate(...)`. Rows in one `insert` call are checked one by one, so they may set different optional columns.

For each insert that stops compiling, add a real value for each column the error names. Do not cast the row. If a value is typed `T | undefined`, check it before the insert, because `exactOptionalPropertyTypes` does not let `undefined` stand for a required column.

## ORM create with `@onUpdate` only

`@onUpdate(...)` generates a value only when a row is updated. A field that is not nullable, has no default and has only `@onUpdate(...)` was optional in ORM `create` input, and the create then failed in the database. It is now required. Pass a value for it on create, or add `@onCreate(...)` so the client generates one.
