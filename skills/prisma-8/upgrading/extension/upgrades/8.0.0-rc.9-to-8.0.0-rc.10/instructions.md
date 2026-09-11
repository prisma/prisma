---
from: "8.0.0-rc.9"
to: "8.0.0-rc.10"
# Prisma 8 naming sweep: prose only, no entry required
# sql-orm-client doc-comment sweep: reviewed, no entry required
changes:
  - id: params-only-sql-facade-prepare
    summary: Replace injected SQL-builder preparation callbacks with params-only callbacks and lexical facade SQL access.
  - id: preserve-prepared-reference-nullability
    summary: Preserve declaration nullability when constructing or cloning PreparedParamRef AST nodes.
  - id: preserve-orm-pagination-expressions
    summary: Preserve expression-valued limit and offset when consuming ORM CollectionState.
  - id: to-one-relations-record-nullable
    summary: |
      `ContractNonJunctionRelation`'s `'1:1'` and `'N:1'` members now require `nullable: boolean`,
      and contract validation rejects a `contract.json` whose to-one relations lack it. Set
      `nullable` on every to-one relation the extension constructs, and rebuild the extension's
      contract space so its emitted `contract.json` / `contract.d.ts` carry the flag.
    detection:
      glob: "**/*.ts"
      matches:
        - '(?<!\bnullable\b(?:[^{}]|\{[^{}]*\})*)(?:(?<=\bon\s*:(?:[^{}]|\{[^{}]*\})*)|(?=(?:[^{}]|\{[^{}]*\})*\bon\s*:))\bcardinality:\s*[''"](?:N:1|1:1)[''"](?!(?:[^{}]|\{[^{}]*\})*\bnullable\b)'
  - id: contract-space-re-emit-nullable
    summary: |
      The extension's emitted `contract.json` must carry `nullable` on every `1:1` and `N:1`
      relation. Rebuild the contract space (the package's `build:contract-space` script) once
      after upgrading.
    detection:
      glob: "**/contract.json"
      matches:
        - '"cardinality":\s*"(?:N:1|1:1)",\s*"on":'
---

# 8.0.0-rc.9 → 8.0.0-rc.10 — Extension upgrade instructions

## `preserve-orm-pagination-expressions`

Update extension code that reads or mirrors ORM `CollectionState.limit` and `offset`: these fields now contain relational-core `LimitOffsetValue | undefined` (`number | AnyExpression | undefined`), not just numbers. Forward them unchanged to the existing `SelectAst.withLimit` and `withOffset` methods. If processing numeric literals separately, narrow with `typeof value === 'number'`; preserve expression nodes rather than coercing, serializing or boxing them as literal parameters. Test presence against `undefined`, not truthiness, so zero limits and offsets survive. Keep grouped post-aggregation paging's separate numeric state unchanged.

## `preserve-prepared-reference-nullability`

Find code that constructs or clones `PreparedParamRef` from SQL relational-core's AST exports. When constructing a reference from a nullable declaration, pass its declared boolean nullability as the third argument to `PreparedParamRef.of(name, codec, nullable)` or `new PreparedParamRef(name, codec, nullable)`. When cloning an existing reference, preserve `ref.nullable`: `PreparedParamRef.of(ref.name, ref.codec, ref.nullable)`. Keep the name and complete codec reference unchanged, and keep constructing frozen class instances rather than spreading nodes into plain objects. Do not derive this flag from a column's nullability or an invocation's bound value.

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

For every TypeScript file matched by `detection`, find each object literal that builds a to-one contract relation (`cardinality: 'N:1'` or `'1:1'` together with an `on` join) and add `nullable: <boolean>` to it: `true` when the relation field is optional (the local foreign-key columns are nullable), `false` when it is required. The side of a one-to-one relation that does not own the foreign key is always `nullable: true`. Contract builders and PSL authoring set the flag from the field's `?`, so only code that assembles `ContractRelation` values by hand needs the edit.

## `contract-space-re-emit-nullable`

For every `contract.json` matched by `detection`, run the extension package's `build:contract-space` script (or its emit command) once after upgrading. The expected diff is one `"nullable"` boolean per to-one relation in `contract.json`, plus the `Models` namespace, `models` constant, and `RelationKeys` import in `contract.d.ts`.
