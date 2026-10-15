# ADR 273 — A column of a type no data type claims is a raw column

## Decision

A column whose database type no data type in the stack claims is a raw column. Its data type is `sql/raw`, with one parameter, `sql`: the column's type exactly as the database catalog prints it. Its codec, `sql/raw@1`, passes values through unchanged, and the ORM types them `unknown`. Migrations create the column from the `sql` text, and `db verify` compares that text with the catalog's.

In a Prisma 8 schema, a field declares one with `Raw(...)`:

```prisma
model Category {
  id        Int           @id @default(autoincrement())
  name      String
  path      Raw("ltree")
  search    Raw("tsvector")?
  area      Raw("circle") @default(sql`'<(0,0),1>'::circle`)
  embedding Vector(1536)?

  @@map("categories")
}
```

The contract stores each raw column like any other:

```json
"path": {
  "dataType": "sql/raw",
  "typeParams": { "sql": "ltree" },
  "codecId": "sql/raw@1",
  "nullable": false
}
```

A Prisma 7 schema's `Unsupported("ltree")` field is read as a raw column with no field (ADR 267), because Prisma 7's client never shows such a field.

## Why

A Prisma 7 project may have columns of types Prisma does not model: `ltree`, `hstore`, `tsvector`, the geometric and range types, a domain or composite type of its own. Prisma 7 declares them with `Unsupported("<type>")`. Prisma 8 must be able to describe them, or such a project cannot adopt it; and a Prisma 8 project may need such a column too.

Every Prisma 8 contract must be verifiable: `db verify` must be able to tell whether the database matches it. A raw column meets that rule. The contract records the column's type as text, and verify compares it with the text the catalog prints. What Prisma 8 gives up is interpreting the values, not knowing the column.

Every part of the system already works through a column's data type and codec. The planner renders a column's type in DDL from its data type (`buildColumnTypeSql` calls `renderSqlTypeName`). Verify derives the expected type text from the data type (`schemaTypeText` in `contract-to-schema-ir.ts`). The runtime encodes and decodes through the codec, and the emitted types come from it. A raw column supplies a data type and a codec like any other column, so none of these needs a special case.

## The data type and the codec

`sql/raw` is a SQL data type (ADR 254) whose name in SQL is its `sql` parameter, written as given. Every other data type writes its name from a fixed pattern such as `vector({length})`; `sql/raw` renders the parameter itself. Its catalog text is the parameter too, so verify's expected text is exactly what the author wrote. The data type claims no reported type: introspection never reads a column as `sql/raw` on its own, and `contract infer` refuses a type no data type claims.

The `sql` text must be the type as the catalog prints it: `integer`, not `int4`; `character varying(10)`, not `varchar(10)`. Verify compares exactly, so a text in any other form reports a mismatch, and the finding shows the catalog's text to write instead.

`sql/raw@1` encodes and decodes by identity. Its values are typed `unknown` in memory, which promises nothing about the representation a driver returns. The Postgres driver returns a type it does not know as text, and a text parameter is sent untyped, so Postgres parses it with the column's own input function. The codec declares no traits, so the ORM offers no filters or ordering on a raw column; a query that needs them uses SQL.

A raw column's default is a `sql` expression (ADR 268), written as given. A literal default is refused: the codec cannot encode a value of a type it does not know.

## The Prisma 7 reader

The reader (ADR 252) turns `Unsupported("X")` into a raw column with `sql: "X"`, and gives the model no field for it. Prisma 7's generated client leaves such a field out of the model's rows and inputs, and leaves out `create`, `createMany` and `upsert` when the field is required and has no default. So the Prisma 8 ORM shows the model with the shape the Prisma 7 client had.

The reader reads `Unsupported` as written. It does not substitute a data type an extension pack provides, even where one claims the text, as pgvector claims `vector(1536)`. Moving such a column to its real type is a choice the author makes when converting to a Prisma 8 schema.

Prisma 7 accepts only `@default(dbgenerated("..."))` on an `Unsupported` field. The reader already lowers it to a `sql` expression default, so a raw column read from Prisma 7 needs nothing more.

Prisma 7 never compares an `Unsupported` type with the database: its migrations write the text into DDL as given, and its diff plans nothing when the text changes, even from `tsvector` to `circle`. So a Prisma 7 schema may hold an `Unsupported` text that does not match the database, and Prisma 8's `db verify` is the first to report it. Correcting the text in the Prisma 7 schema makes Prisma 7 plan nothing.

## Consequences

- A Prisma 7 project with `Unsupported` fields can adopt Prisma 8. Its raw columns are created, verified and kept, and its query code sees the models it saw before.
- A Prisma 8 schema can declare any column type the database has, without waiting for a data type.
- `contract print` writes a raw column as `Raw("...")`, so a converted Prisma 7 project keeps its raw columns.
- A required raw column with no default and no field makes every ORM insert into its table fail. The lowering warns about it (`PN_COLUMN_REQUIRED_UNMAPPED`), as it does for any such column (ADR 267). Prisma 7 left `create` out of the client instead.
- After Prisma 8 owns a project's migrations, changing a raw column's text changes the column's type, and the planner must plan it. Under Prisma 7 the same edit did nothing.
- Choosing `Raw(...)` over a data type the stack has is the author's call. Nothing refuses `Raw("vector(1536)")` when pgvector is installed.

## Alternatives considered

**Keep refusing such columns.** A Prisma 7 project with one `ltree` column could not adopt Prisma 8 until someone wrote a data type and codec for `ltree`, and the only way to add one is an extension pack.

**A column with no data type or codec.** Every consumer reads a column through its data type and codec: the planner, verify, the runtime and the emitter. A column without them needs a special case in each.

**Read `Unsupported` as a field.** Prisma 7's client never had the field, so reading a Prisma 7 schema would change the model's shape in the Prisma 8 ORM.

**Substitute a data type the stack provides.** `Unsupported("vector(1536)")` could become pgvector's vector type when pgvector is installed. The author wrote that Prisma should not interpret the column; the real type is theirs to choose when they convert.

**Refuse `Raw(...)` for a type a data type claims.** It would keep raw columns to types Prisma 8 cannot model, but it takes the choice away from the author for no gain in safety: the column is verified either way.

**Normalize the `sql` text through the database before comparing.** `'int4'::regtype` would let authors write any alias. It needs a database round trip wherever the text is compared, and requiring the catalog's form is simpler and explicit.

**Call it `opaque`, `passthrough`, `untyped` or `native`.** `opaque` and `passthrough` describe the codec, not the column. `untyped` is wrong: the column has a type. `native` fits every column. A raw `hstore` column, set with raw SQL, names what it is.
