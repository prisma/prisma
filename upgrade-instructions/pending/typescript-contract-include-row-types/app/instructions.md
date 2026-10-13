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
      A contract built with `defineContract` now carries the aggregate types and query operation types of its target, adapter and extensions, and the capabilities of its adapter, in its type and in its value. `count`, `sum`, `max` and the other aggregates, inside `aggregate(...)` and inside include refinements, are typed; field operations such as `ilike` and capability-gated methods such as `distinctOn` and `forUpdate` are available in the types; `contract.capabilities.postgres.distinctOn` is `true` at run time. Casts that dispatched aggregates by name can be removed. The detection matches casts of the aggregate builder to a record of functions.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - 'as\s+Record<string,\s*\(field\?:\s*string\)'
        - 'AggregateSpec\[string\]'
  - id: typescript-contract-parameterized-output-types
    summary: |
      A contract built with `defineContract` now types a column with type parameters as an emitted `contract.d.ts` does: `varchar(50)` reads as `Varchar<50>`, `numeric(10, 2)` as `Numeric<10, 2>`, `char(36)` as `Char<36>`, and the same for `bit`, `varbit`, `timetz`, `interval`, the string time and timestamp codecs, and pgvector's `Vector<N>`. The field presets read as the column they create: `field.id.uuidv4String()`, `field.id.uuidv7String()` and `field.uuidString()` as `Char<36>`, `field.ulid()` as `Char<26>`, `field.nanoid()` as `Char<21>` or the given size, `field.cuid2()` as `Char<24>`, `field.ksuid()` as `Char<27>`; so does a field written as `field.generated(uuidv4())` or with another id generator. These types are branded strings, so reading them as `string` still works, and filters and writes take plain strings (see `orm-filters-and-writes-take-input-types`). A type assertion or annotation that expects plain `string` for such a field when reading it must change. The detection matches the presets, column helpers and generators that carry type parameters.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bfield\.(id\.)?(uuidv4String|uuidv7String|uuidString|ulid|nanoid|cuid2|ksuid)\('
        - '\bfield\.temporal\.(timestampString|timestamptzString)\(\s*\d'
        - '\b(charColumn|varcharColumn|numericColumn|bitColumn|varbitColumn|timetzColumn|intervalColumn|timeStringColumn)\(\s*\d'
        - '\btype\.sql\.String\(\s*\d'
        - '\bvector\(\s*\d'
        - '\bfield\.generated\('
  - id: orm-filters-and-writes-take-input-types
    summary: |
      ORM filters and writes take each field's input type instead of its read type, for emitted contracts and for contracts built with `defineContract`: the `where` shorthand, field predicates (`eq`, `in`, `gt` and the rest), `whereUnique`, `create`, `createAll`, `update`, `updateAll`, `upsert` and nested writes. A field read as `Char<36>`, `Varchar<255>` or `Numeric<10, 2>` now accepts a plain string in these positions, so casts such as `'abc' as Char<36>` there are no longer needed. A `CodecField` fragment checks values against the codec's input type, as the model's own fields do. The detection matches casts to the branded string types.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - 'as\s+(unknown\s+as\s+)?(Char|Varchar|Numeric|Bit|VarBit|Timetz|Interval|TimeString|TimestampString|TimestamptzString)<'
  - id: typescript-contract-storage-and-domain-types
    summary: |
      A contract built with `defineContract` now types its unique constraints with their columns, so `whereUnique` accepts only the fields of the primary key or of one unique constraint, as with an emitted contract; it no longer accepts any record. `db.enums` lists only the enums the contract declares; a contract without enums no longer offers an accessor under any name. A many-to-many relation whose target has no primary key types its junction columns from the target's unique key. The detection matches `whereUnique` and `db.enums` reads.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.whereUnique\('
        - '\.enums\.'
---

# A TypeScript contract has the same types as an emitted one

This applies to a contract built with `defineContract` from TypeScript, used without an emitted `contract.d.ts`. Its types now match what `prisma contract emit` would write for it. One change, filters and writes taking input types, applies to emitted contracts too.

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

The same holds for reducers inside `include(...)`, such as `posts.count()`. The aggregates come from the aggregate descriptors of the target, the adapter and every extension, as `prisma contract emit` collects them. Aggregates contributed only by the execution stack, not by a pack in the contract, are still not in the contract's types and still need the cast.

The contract's `capabilities` now include the adapter's in its value as well as in its type, and record only enabled capabilities, as an emitted `contract.json` does. Code that read `contract.capabilities` before an execution context existed now sees the adapter's capabilities.

## Columns with type parameters keep them

A field whose column has type parameters now has the parameterized output type. This includes the field presets:

```ts
const contract = defineContract({}, ({ field, model, type }) => ({
  models: {
    Reading: model('Reading', {
      fields: { id: field.id.uuidv4String(), label: field.column(type.sql.String(50)) },
    }),
  },
}));
// row.id: Char<36> (was string)
// row.label: Varchar<50> (was string)
```

`Varchar<N>`, `Char<N>`, `Numeric<P, S>` and the others are branded strings exported from `@prisma/orm-postgres/contract-builder` and `@prisma/orm-postgres/target/codec-types`, so code that reads them as `string` keeps working. Update a type assertion or an annotation that expects plain `string` for such a value read from a row to the branded type, or widen the value with `String(value)`.

## Filters and writes take plain strings

For emitted contracts and contracts built with `defineContract`, the ORM types filters and writes with each field's input type. A field read as `Char<36>` takes a plain `string` in `where`, in field predicates, in `whereUnique`, and in `create`, `update` and `upsert`. Remove the casts that made a plain string fit:

```diff
- await db.orm.User.where({ id: idFromRequest as Char<36> }).first();
- await db.orm.User.create({ id: '123e4567-e89b-12d3-a456-426614174000' as Char<36>, email });
+ await db.orm.User.where({ id: idFromRequest }).first();
+ await db.orm.User.create({ id: '123e4567-e89b-12d3-a456-426614174000', email });
```

A field whose codec accepts more forms on input than it returns on output, such as a temporal codec that takes a string or a `Date`, now accepts those forms in filters too. A `CodecField` fragment checks values against the codec's input type, as the model's own fields do.

## Unique criteria, enums and junction columns

`whereUnique` on a contract built with `defineContract` now accepts only the fields of the primary key or of one unique constraint, from `.unique()` fields and the `uniques` attribute. Before, any record typechecked. A criterion that named a field outside every unique key now fails to typecheck; it failed at run time before.

`db.enums` lists only the enums the contract declares. A contract without enums offered an accessor under any name before.

A many-to-many relation whose target has no primary key now types its junction's target columns from the target's unique key, as the build does.

## Exporting a contract with declaration emit

An application that exports a contract built with `defineContract` and builds with `declaration: true` no longer gets TS2742, TS4023 or TS4094 errors when the contract uses pgvector, PostGIS or ParadeDB, or a field preset. Remove type annotations or workarounds added only to make declaration emit pass, such as a `import type {} from '@prisma/orm-extension-postgis/geojson'` line.
