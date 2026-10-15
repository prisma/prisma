# Slice 1: raw columns in Prisma 8

_Project: [`projects/raw-columns/`](../../spec.md). Linear: TML-3585. Design: ADR 273._

## Outcome

A Prisma 8 schema declares a raw column with `Raw("...")`, or the TypeScript builder does the same. The column is created, verified, read and written like any other column, with values typed `unknown`.

```prisma
model Category {
  id     Int           @id
  path   Raw("tsvector")
  area   Raw("circle") @default(sql`'<(0,0),1>'::circle`)
  net    Raw("cidr")?
}
```

## Chosen design

### The data type

`sql/raw` is defined once, in `packages/2-sql/1-core/contract/src/sql-raw.ts` beside `sql-expression.ts`. Its parameters are `{ sql: string }`. It declares no texts and no `claimsKind`, so it claims no reported type: introspection and `contract infer` never produce it. Its `render` returns `params.sql`.

Two rules in `sql-data-type.ts` change, for every data type, not for `sql/raw` by id:

- A data type may declare `render` without `claimsKind` when it declares no texts (`checkKindClaim`). `fromReported` stays tied to `claimsKind`.
- `renderSqlCatalogText` returns `render(params)` for a data type that renders and claims no kind.

Postgres and SQLite each register it with their data types (`postgresDataTypes`, and SQLite's equivalent).

### The codec

`sql/raw@1` is a codec template in `packages/2-sql/4-lanes/relational-core/src/ast/sql-codecs.ts`, adapted by each target as the `sql/char@1` template is. It encodes and decodes by identity, is typed `unknown` for input and output, and declares no traits. `encodeJson` and `decodeJson` refuse every value, so every literal path refuses: a raw column has no literal default, enum members or JSON projection. It is listed in Postgres's and SQLite's codec lists and in `codecDescriptorMap`, so the emitted `CodecTypes` give `unknown`.

On Postgres, `sql/raw` joins the data types whose parameters are sent without a cast (`POSTGRES_INFERRABLE_DATA_TYPES` in the SQL renderer), so a value reaches the column's own input function. An explicit cast such as `$1::character varying(10)` would silently truncate.

### Schemas and the TypeScript builder

`Raw` is a type constructor with one string argument, `sql`, contributed by the SQL family so both targets have it. It is not marked as inferred, so `contract infer` keeps refusing types no data type claims. The TypeScript builder gets the same column through its type helpers. A literal `@default` on a raw field is refused at emit with a message that says a raw column's default is written `sql\`...\``; a `sql` default is accepted.

### Verify and migrations

DDL already renders a column's type through its data type, so a raw column's DDL is its `sql` text. Verify compares a raw column's text with the type the database reports (the catalog's text, with no schema for a base type, as introspection's reported type gives it). It must not compare through the alias table that rewrites `integer` to `int4`: `Raw("integer")` verifies and `Raw("int4")` does not, as ADR 273 says.

A change from one raw text to another plans `ALTER COLUMN ... TYPE`. The check that runs after it takes the expected text from the column's data type instead of reading the new text back through `resolveWrittenSqlTypes`, which no data type reads. Without a cast between the two types, Postgres refuses the alter; `--convert` is the answer, as for any lossy type change.

### `contract print`

`contract print` writes a raw field as `Raw("...")`, and the printed schema reads back as the same contract. A text `contract print` cannot write as a PSL string is refused, as today.

## Scope

In: the data type and codec, both targets' registration, the type constructor and the TypeScript helper, defaults, verify, the planner's type-change check, `contract print`, tests, ADR 273 corrections, package READMEs and the prisma-8 skill reference where they list column types, the error reference for any new message, the upgrade-coverage declaration (additive, so `changes: []` where required).

Out: the Prisma 7 reader (slice 2).

## Done conditions

- Against a real Postgres database (dev database), a contract with raw `tsvector`, `circle` and `cidr` columns plans, migrates, and verifies strictly with no findings; the ORM creates and reads a row through those fields; the values are typed `unknown` in the emitted `contract.d.ts`.
- A `sql` default on a raw column is created and verified; a literal default is refused at emit with the message above.
- `Raw("integer")` verifies against an `integer` column; `Raw("int4")` reports a type mismatch naming `integer`.
- A raw type installed outside `public`, found through the `search_path`, verifies with the text that names no schema.
- Changing `Raw("tsvector")` to `Raw("text")` plans an `ALTER COLUMN ... TYPE` and the post-check passes after it runs.
- `contract print` round-trips a schema with raw fields.
- `contract infer` still refuses a type no data type claims.
- SQLite registers the data type and codec; a SQLite contract with a raw column plans and verifies.

## Dispatch plan

| # | Outcome |
|---|---|
| 1 | The data type and codec, registration on both targets, untyped parameters, verify by reported type, the planner's post-check; unit tests and a Postgres plan, migrate and verify integration test |
| 2 | `Raw(...)` in schemas and the TypeScript builder, defaults, `contract print`, ORM read and write test, docs, ADR 273 corrections |
