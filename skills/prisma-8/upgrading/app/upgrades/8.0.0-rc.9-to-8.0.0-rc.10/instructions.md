---
from: "8.0.0-rc.9"
to: "8.0.0-rc.10"
# Prisma 8 naming sweep: prose only, no entry required
changes:
  - id: params-only-sql-facade-prepare
    summary: Replace injected SQL-builder preparation callbacks with params-only callbacks and lexical facade SQL access.
  - id: to-one-relations-record-nullable
    summary: |
      Every `1:1` and `N:1` relation in `contract.json` now carries a `nullable` boolean. A
      contract without it still loads, with the flag derived from the foreign-key columns (or
      fields), but its `contract.d.ts` lacks the `Models` namespace. Re-run
      `prisma contract emit` so the emitted `contract.json` / `contract.d.ts` match the installed
      toolchain.
    detection:
      glob: "**/contract.json"
      matches:
        - '"cardinality":\s*"(?:N:1|1:1)",\s*"on":'
  - id: contract-dts-exports-models
    summary: |
      `contract.d.ts` now exports a `Models` namespace and a `models` constant that name every
      model with its fields and relations. The re-emit above produces them; use them with
      `Scalars` and `Shape` to name row types without a client in scope.
---

# 8.0.0-rc.9 → 8.0.0-rc.10 — User upgrade instructions

## `params-only-sql-facade-prepare`

Find calls to `prepare(declaration, callback)` on clients created by the Postgres or SQLite facade (`@prisma/orm-postgres/runtime`, `@prisma/orm-sqlite/runtime`, or their `@internal/postgres/runtime` and `@internal/sqlite/runtime` counterparts). Resolve the receiver and callback rather than rewriting every method named `prepare`: native SQLite `database.prepare(sql)` and SQL runtime's existing params-only preparation are different APIs and must remain unchanged.

Change callbacks from `(sql, params) => ...` to `(params) => ...`. Replace references bound to the removed `sql` callback argument with the same facade receiver's lexical `.sql` property. Preserve the params argument's name, declaration, SQL chain, row selection, filters and invocation target/options. For extracted callbacks, capture the same client in the enclosing scope; do not capture an invocation target or evaluate the callback twice. Update explicit callback type annotations to accept only the placeholder-params argument.

```ts
// Before
const query = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
  sql.public.users.select('id').where((f, fns) => fns.eq(f.id, params.id)).build(),
);

// After
const query = await db.prepare({ id: 'pg/int4@1' }, (params) =>
  db.sql.public.users.select('id').where((f, fns) => fns.eq(f.id, params.id)).build(),
);
```

Apply the same translation to SQLite's flat SQL facade (`sql.users` becomes `db.sql.users`), retaining its existing codec ids. Keep `.query(target, params, options?)` and SQL statistics `.execute(target, params, options?)` calls unchanged. Do not rewrite historical release notes, applied upgrade recipes, generated contracts or tests as part of this source translation.

## `to-one-relations-record-nullable`

For every `contract.json` matched by `detection`, run the project's emit command (`prisma contract emit`, or the project's `contract:emit` script) once after upgrading. The emit reads the `?` on each to-one relation field in the schema and writes `"nullable": true` or `"nullable": false` next to that relation's `"cardinality"`. The emit also fails, rather than emitting, when a required relation field sits over a nullable foreign key or the reverse; fix the schema so the field's `?` matches the key's `?`, then emit again. Until the re-emit, the client and the migration tools still load the old `contract.json`: a to-one relation without the flag is treated as nullable when any of its foreign-key columns (Mongo: fields) is nullable, and as required otherwise. Migration contract snapshots written by earlier versions are never rewritten and load the same way.

## `contract-dts-exports-models`

After the emit, `import type { Models, models } from './prisma/contract'` (the project's contract path) gives `Models.<namespace>_<Model>` for every model, and `Scalars<M>` / `Shape<M, { '+': 'relation' }>` from `@prisma/orm-postgres/family-contract/types` (or the Mongo family package) derive the default row and a data structure with relations from it. Replace hand-written row types that duplicate a model's fields with these when convenient.
