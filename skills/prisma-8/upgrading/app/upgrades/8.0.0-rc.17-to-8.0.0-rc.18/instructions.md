---
from: "8.0.0-rc.17"
to: "8.0.0-rc.18"
changes:
  - id: postgres-alter-column-type-plain-options
    summary: |
      `this.alterColumnType(...)` in a Postgres `migration.ts` now takes `{ schema, table, column, type, using?, operationClass? }`. The `options` object with `qualifiedTargetType`, `formatTypeExpected`, `rawTargetTypeForLabel` and `using` is gone. Move `options.qualifiedTargetType` to `type` and `options.using` to `using`, drop the other two, and run the `migration.ts` again to re-emit its `ops.json`.
    detection:
      glob: "**/migration.ts"
      matches:
        - '\bqualifiedTargetType\s*:'
---

## `postgres-alter-column-type-plain-options`

A hand-written Postgres migration that changes a column's type called `alterColumnType` with an `options` object that carried internal names:

```ts
this.alterColumnType({
  schema: 'public',
  table: 'user',
  column: 'age',
  options: {
    qualifiedTargetType: 'int4',
    formatTypeExpected: 'integer',
    rawTargetTypeForLabel: 'int4',
    using: '"age"::integer',
  },
  operationClass: 'destructive',
}),
```

It now takes the new type and the conversion directly:

```ts
this.alterColumnType({
  schema: 'public',
  table: 'user',
  column: 'age',
  type: 'int4',
  using: '"age"::integer',
}),
```

For each `migration.ts` the detection matches:

1. Replace `options: { ... }` with `type: <the value of qualifiedTargetType>`, and `using: <the value of options.using>` when the old call had one.
2. Delete `formatTypeExpected` and `rawTargetTypeForLabel`. The operation now works out the type the database prints from `type`, through the data types of the configured stack. A type it cannot read fails with `MIGRATION.COLUMN_TYPE_UNREADABLE`, which names the call; write the type as a migration writes it (`int4`, `varchar(20)`, `"Mood"` for an enum), or add the extension that provides it to the configuration.
3. Keep `operationClass` if the call had one. A call with a `using` that converts values may now say `operationClass: 'data'`.
4. If the migration has not been applied to any database, run it (`node migration.ts`) to re-emit `ops.json` and `migration.json`. If it has been applied, leave those two files as they are: the operation's label now names the type as written in `type`, so re-emitting would change the migration's hash.
