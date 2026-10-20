# Slice 2: the Prisma 7 reader reads `Unsupported("...")` as a raw column with no field

_Project: [`projects/raw-columns/`](../../spec.md). Linear: TML-3596. Design: ADR 273, section "The Prisma 7 reader". Builds on slice 1 (TML-3585, #30745)._

## Outcome

A Prisma 7 schema with `Unsupported("...")` fields loads through `prisma7Schema(...)`. Each such field becomes a raw column on its model's table, and the model gets no field for it. Strict `db verify` against the database Prisma 7 built reports nothing.

```prisma
model Post {
  id     Int                      @id
  title  String
  search Unsupported("tsvector")?
  area   Unsupported("circle")    @default(dbgenerated("'<(0,0),1>'::circle"))
  net    Unsupported("cidr")      @unique
  tags   Unsupported("text")[]

  @@index([search], type: Gin)
}
```

The contract holds:

| Storage plane: table `Post` | Domain plane: model `Post` |
|---|---|
| `id`, `title` as today | fields `id`, `title` |
| `search`: `sql/raw` `{ sql: "tsvector" }`, codec `sql/raw@1`, nullable | none |
| `area`: `sql/raw` `{ sql: "circle" }`, not nullable, default `` sql`'<(0,0),1>'::circle` `` | none |
| `net`: `sql/raw` `{ sql: "cidr" }`, unique index `Post_net_key` | none |
| `tags`: `sql/raw` `{ sql: "text" }`, a list, nullable, elements nullable | none |
| index `Post_search_idx` using `gin` | |

The ORM shows `Post` as `{ id, title }`, as the Prisma 7 client did.

## Chosen design

### What Prisma 7 does

Checked with `prisma@7.10.0 validate` and `migrate diff --from-empty --script` on 2026-10-20:

- DDL writes the text as given: `Unsupported("INT4")` becomes `"x" INT4 NOT NULL`, and `Unsupported("varchar(10)")` becomes `varchar(10)`. A list `Unsupported("text")[]` becomes `text[]` with no `NOT NULL`, as every Prisma 7 list does.
- A change of text plans nothing: a diff from `Unsupported("INT4")` to `Unsupported("integer")`, and from `tsvector` to `circle`, is an empty migration. ADR 273 says the same.
- `@default` takes only `dbgenerated("...")` or `dbgenerated()`. Literals, `autoincrement()`, `now()` and `sequence()` are refused ("Only @default(dbgenerated("...")) can be used for Unsupported types").
- `@ignore` on an `Unsupported` field is refused ("They are already treated as ignored by the client due to their type"). `@@ignore` on a model with one is accepted.
- `@db.*` on an `Unsupported` field is refused ("Attribute not known"). `@updatedAt` is refused.
- `@unique`, `@@unique`, `@@index` (with `type: Gin` and others) over an `Unsupported` field are accepted.
- `@id` or `@@id` over an `Unsupported` field is accepted when the model has another unique criterion with only required fields, and on an `@@ignore` model.
- A relation joining on `Unsupported` fields is accepted when both sides are `Unsupported`. Against a scalar it is refused as a type mismatch.

### The reader

Today `readField` refuses every field with a type constructor (`packages/2-sql/2-authoring/contract-prisma7/src/interpreter.ts:1033-1042`, `PSL.PRISMA7_UNSUPPORTED_TYPE`). After this slice, a field typed `Unsupported(...)` is read as the SQL family's `Raw` constructor with the same arguments: `{ ...field.typeConstructor, path: ['Raw'] }`. It then goes through the path every other column takes (`getAuthoringTypeConstructor`, `instantiateFieldTypeConstructor`, `lowerPrisma7Default`, `interpreter.ts:1142-1222`). So the text is checked by `sql/raw`'s parameter schema (`checkRawTypeText`, `packages/2-sql/1-core/contract/src/sql-raw.ts`), and a text it refuses is reported with that schema's message, as other type constructor refusals are. A type constructor with any other name is still `PSL.PRISMA7_UNSUPPORTED_TYPE`.

The column goes where an `@ignore` field's column goes: `build.ignoredColumns` (`interpreter.ts:1223-1226`). That gives it no field and puts it on the model's table as a column node (ADR 267), or on the table of an `@@ignore` model. Indexes and uniques keep it, because `keyColumns` already looks in `ignoredColumns` (`interpreter.ts:667-676`). No new storage path is added.

The reader reads the text as written. It does not substitute a data type an extension pack provides, such as pgvector's for `vector(1536)` (ADR 273).

### Attributes on an `Unsupported` field

- `@default(dbgenerated("..."))` becomes a `sql` expression default, through the existing `dbgeneratedDefault` (`packages/2-sql/2-authoring/contract-prisma7/src/defaults.ts:386-405`). `dbgenerated()` means no default. A literal or another function reaches `sql/raw`'s reader, which refuses it (`CONTRACT.LITERAL_VALUES_ABSENT`), reported as today's default refusals are. Prisma 7 refuses these too.
- `@map`, `@unique`, `@@unique` and `@@index` work as on any field.
- `@ignore` changes nothing: the column already has no field. Prisma 7 refuses it, but the meaning is not in doubt, so the reader accepts it.
- `@db.*` is refused with `PSL.PRISMA7_UNKNOWN_ATTRIBUTE`. Today `readField` would record it and then skip it on this path, so the refusal needs code. `@updatedAt` is refused by the existing check (`PSL.PRISMA7_UPDATED_AT_FIELD_INVALID`).

### Primary keys and relations over an `Unsupported` field

ADR 267 refuses a primary key over a column with no field, because the model then has no field that identifies a row. The same holds here. On a model that is not `@@ignore`, `@id` or `@@id` over an `Unsupported` field is `PSL.PRISMA7_IGNORED_FIELD_REFERENCED`. The message names `Unsupported`, not `@ignore`, and gives the Prisma 7 edit: `@@ignore` on the model, which keeps its table and primary key in Prisma 8. On an `@@ignore` model the primary key is kept, as today.

A relation that is not `@ignore` and joins on an `Unsupported` field through `fields:` or `references:` is `PSL.PRISMA7_IGNORED_FIELD_REFERENCED` too, with the edit: mark the relation field `@ignore`, and Prisma 8 keeps its foreign key. The reader records `Unsupported` fields so the checks at `interpreter.ts:440-454`, `interpreter.ts:989-1003` and `relations.ts:442` and `:852` see them, with their own wording. The messages in `diagnostics.ts` (`ignoredFieldInPrimaryKey`, `ignoredFieldJoined`) take the reason as input instead of assuming `@ignore`.

### A text not in catalog form

Strict verify compares the text with the catalog's text exactly (`sqlColumnTypesEqual`, `packages/2-sql/1-core/schema-ir/src/ir/sql-column-ir.ts:280-306`). Prisma 7 writes the text into DDL as given, and Postgres stores the type under its catalog name. So `Unsupported("INT4")`, `Unsupported("int4")` or `Unsupported("varchar(10)")` loads, and `db verify` then reports the column: `The column type is "INT4", but the database reports "integer".` The reader cannot know the catalog form without a database, and it does not guess. The user corrects the text in the Prisma 7 schema. Prisma 7 plans nothing for that edit, so the change touches only Prisma 8. ADR 273 says this already; the reader adds no warning of its own.

A text with a schema, such as `Unsupported("public.ltree")`, is the same case: Postgres prints a base type with no schema, so verify reports it.

### A required column with no default

A required `Unsupported` field with no default makes every ORM insert into its table fail. The lowering already warns `PN_COLUMN_REQUIRED_UNMAPPED` for any such column node (`packages/2-sql/2-authoring/contract-ts/src/unmapped-column-warnings.ts`). Prisma 7 left `create` out of the client instead. The package README tells the user the Prisma 7 edits that clear the warning: make the field optional, or give it `@default(dbgenerated("..."))`.

### `contract print`

`contract print` keeps refusing a contract with a column no field maps (`CONTRACT.PRINT_UNSUPPORTED`, `packages/3-targets/3-targets/postgres/src/core/psl-print/refusals.ts:467-488`), until TML-3469. A converted Prisma 7 schema with `Unsupported` fields stays on `prisma7Schema(...)` until then. No change to the printer.

### Order with slice 0

Slice 0 (TML-3615) changes `Raw`'s argument to a `sql` value. Whichever slice lands second changes how the reader passes the text to `Raw`. The done conditions below test the contract, not the call, so they hold either way.

## Scope

In:

- The reader change, the attribute rules, and the primary key and relation refusals above.
- Package fixtures under `packages/2-sql/2-authoring/contract-prisma7/test/fixtures/`: `unsupported-type` and `unsupported-type-model-ignored` become cases that interpret to a contract, each with a `migration.sql` from `prisma@7.10.0` (the README there says how). `multi-file-errors` replaces its `Unsupported` field with another refused construct, such as `@db.Money`, so it still reports one error per file. New error cases for a primary key over an `Unsupported` field, a relation joining on one, `@db.*` on one, and a text `sql/raw` refuses.
- The integration fixture `test/integration/test/fixtures/prisma7-source/supported/`: put `Post.search Unsupported("tsvector")?` back and regenerate `migration.sql`. The reference README's list of refused constructs loses it ("eight" becomes "seven"). The zero-findings test (`supported.integration.test.ts`) and the CLI journey (`cli-journeys/prisma7-source.e2e.test.ts`) then cover it with no further change.
- `cli-journeys/contract-print.e2e.test.ts`: `withoutIgnoredStorage` also removes `Unsupported` fields, since print refuses them.
- Docs: the package README (the mapping table row for `Unsupported`, the hard-error row and the `PSL.PRISMA7_UNSUPPORTED_TYPE` and `PSL.PRISMA7_IGNORED_FIELD_REFERENCED` rows); `packages/3-extensions/postgres/README.md:138` and `:145`; `docs/reference/error-reference.md` entries for `PSL.PRISMA7_UNSUPPORTED_TYPE` (`:826-828`, now an unknown type name or a type constructor other than `Unsupported`) and `PSL.PRISMA7_IGNORED_FIELD_REFERENCED`; `examples/prisma7-adoption/README.md:100` (a schema with `Unsupported` fields cannot be printed yet either).
- ADRs: ADR 273 drops "This section records the design of the reader's part, which arrives in a later change" and the sentence after it, and records the primary key and relation rules if the build confirms them. ADR 267 (`:73`) says a column with no codec is refused only for `@db.*` types, and points to ADR 273 for `Unsupported`. ADR 252 (`:164`) notes that `Unsupported` is now read, by ADR 273.
- Upgrade coverage: `changes: []` declarations where `pnpm check:upgrade-coverage` asks for them (the example README, and the Postgres extension README if it counts). No app or extension instructions: no schema with `Unsupported` loaded before, so no existing contract or storage hash changes.
- A release note, not an upgrade instruction. The pull request description says "Prisma 7 schemas with `Unsupported(...)` fields now load", so `draft-release-notes` picks it up.

Out:

- A warning or a correction for a text not in catalog form. Verify reports it (ADR 273).
- Substituting an extension pack's data type.
- Printing unmapped raw columns (TML-3469).
- Adding an `Unsupported` column to `examples/prisma7-adoption`.
- MongoDB's Prisma 6 reader, which has no SQL types.

## Done conditions

- Against a real Postgres database built by Prisma 7's own DDL, every new package fixture that interprets to a contract verifies with no lenient and no strict findings (`interpreter-fixtures.integration.test.ts` runs them). Together they cover: an optional `tsvector`, a required `circle` with a `dbgenerated` default, a `cidr` with `@unique`, an `inet` in `@@index` and one in `@@unique`, a `gin` index over a `tsvector`, a list `Unsupported("text")[]`, a field `Unsupported("text[]")`, an `@map`, an `@@ignore` model with an `Unsupported` `@id`, and an `Unsupported` field that also has `@ignore`.
- The `supported` fixture, with `Post.search` back, verifies strictly with no findings, through `supported.integration.test.ts` and through `contract emit`, `db sign` and `db verify --strict` in the CLI journey.
- In each such contract the raw columns have data type `sql/raw`, codec `sql/raw@1` and the text as written, and no model has a field for them. The emitted `contract.d.ts` has no field for them in the model's row or input types.
- A database built from `Unsupported("INT4")` and `Unsupported("varchar(10)")` loads, and `db verify` reports each column with the text the database reports (`integer`, `character varying(10)`). One integration test.
- A required `Unsupported` field with no default warns `PN_COLUMN_REQUIRED_UNMAPPED`; an optional one and one with a `dbgenerated` default do not.
- `@id` over an `Unsupported` field on a model that is not `@@ignore`, a relation joining on one, `@db.*` on one, and a text `sql/raw` refuses (`Unsupported("tsvector; drop")`) are each refused with the code and message the fixture pins.
- `contract print` on a Prisma 7 schema with an `Unsupported` field exits 2 with `CONTRACT.PRINT_UNSUPPORTED` naming the column, and writes nothing.
- The error reference, both READMEs, the example README and ADRs 252, 267 and 273 match the code.

## Dispatch plan

| # | Outcome |
|---|---|
| 1 | The reader change, attribute rules, primary key and relation refusals, package fixtures and their `migration.sql`, unit tests |
| 2 | The `supported` fixture and its `migration.sql`, the catalog-form integration test, the print journey helper, docs, ADR edits, upgrade-coverage declarations |

Implementers run only the integration test files this slice touches, never the full `test:integration` or `test:e2e` suites.
