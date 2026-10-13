---
changes:
  - id: typescript-contract-include-row-types
    summary: |
      A contract built with `defineContract` from TypeScript now types each relation with its target model, namespace and cardinality, as an emitted `contract.d.ts` does. Rows from `include(...)`, which were typed `unknown` and always as an array, now have the target model's field types: a has-many or many-to-many relation is an array, a belongs-to relation is one row (or `null` when optional), and a has-one relation is one row or `null`. A cast on an included value that disagrees with this type now fails to typecheck. The detection matches ORM `include` calls.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.include\(\s*[''"`]'
  - id: typescript-contract-aggregates-and-operations
    summary: |
      A contract built with `defineContract` now carries the aggregate types and query operation types of its target and extensions, and the capabilities of its adapter. `count`, `sum`, `max` and the other aggregates, inside `aggregate(...)` and inside include refinements, are typed; field operations such as `ilike` and capability-gated methods such as `distinctOn` and `forUpdate` are available in the types. Casts that dispatched aggregates by name can be removed. The detection matches casts of the aggregate builder to a record of functions.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - 'as\s+Record<string,\s*\(field\?:\s*string\)'
        - 'AggregateSpec\[string\]'
  - id: typescript-contract-parameterized-output-types
    summary: |
      A contract built with `defineContract` now types a column with type parameters as an emitted `contract.d.ts` does: `varchar(50)` reads as `Varchar<50>`, `numeric(10, 2)` as `Numeric<10, 2>`, `char(36)` as `Char<36>`, and the same for `bit`, `varbit`, `timetz`, `interval`, the string time and timestamp codecs, and pgvector's `Vector<N>`. A field written as `field.generated(uuidv4())` or with another id generator reads as the `Char<N>` of the column the generator sizes. These types are branded strings, so reading them as `string` still works; a type assertion or annotation that expects plain `string` for such a field must change. The detection matches the column helpers and generators that carry type parameters.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(charColumn|varcharColumn|numericColumn|bitColumn|varbitColumn|timetzColumn|intervalColumn|timeStringColumn)\(\s*\d'
        - '\btype\.sql\.String\(\s*\d'
        - '\bvector\(\s*\d'
        - '\bfield\.generated\('
---

# A TypeScript contract has the same types as an emitted one

This applies to a contract built with `defineContract` from TypeScript, used without an emitted `contract.d.ts`. Its types now match what `prisma contract emit` would write for it.

## Included rows have precise types

The ORM typed every included relation as an array of `unknown` rows. It now reads each relation's target model and cardinality from the contract:

| Relation | Included value |
| --- | --- |
| `rel.hasMany`, `rel.manyToMany` | An array of the target model's rows |
| `rel.belongsTo` | One row, or the row or `null` when the relation is optional or any `from` field is optional |
| `rel.hasOne` | The row or `null` |

A cast that agrees with the new type still typechecks and can be removed. A cast that disagrees now fails to typecheck, and shows a real mismatch. A to-one relation was never an array at runtime, so fix the code that read it as one:

```diff
  const post = await db.orm.Post.include('author').first();
- const author = (post?.author as User[])[0];
+ const author = post?.author;
```

Include refinements now see the target model's fields, so `where`, `select` and `orderBy` inside them need no cast.

A relation to a model in another contract space keeps the general type, as before.

## Aggregates, operations and capabilities are typed

Aggregates, field operations and adapter capabilities were missing from the types, so code dispatched aggregates by name through a cast. Call them directly:

```diff
- const stats = await db.orm.Post.aggregate((aggregate) => {
-   const dynamic = aggregate as Record<string, (field?: string) => AggregateSpec[string]>;
-   return { total: dynamic['sum']!('views') };
- });
+ const stats = await db.orm.Post.aggregate((aggregate) => ({ total: aggregate.sum('views') }));
```

The same holds for reducers inside `include(...)`, such as `posts.count()`. Aggregates contributed only by the execution stack, not by a pack in the contract, are still not in the contract's types and still need the cast.

## Columns with type parameters keep them

A field whose column has type parameters now has the parameterized output type:

```ts
const contract = defineContract({}, ({ field, model, type }) => ({
  models: {
    Reading: model('Reading', {
      fields: { id: field.id.uuidv4String(), label: field.column(type.sql.String(50)) },
    }),
  },
}));
// row.label: Varchar<50> (was string)
```

`Varchar<N>`, `Char<N>`, `Numeric<P, S>` and the others are branded strings exported from `@prisma/orm-postgres/target/codec-types`, so code that reads them as `string` keeps working. Update a type assertion or an annotation that expects plain `string` for such a field to the branded type, or widen the value with `String(value)`.
