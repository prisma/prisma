# Dispatch c: generators name the data types they apply to

Read `common-rules.md` first. Design 14.5. Dispatches a and b are done.

## Today

`packages/1-framework/2-authoring/ids/src/index.ts` gives each generator `applicableCodecIds`: `ulid`, `nanoid`, `cuid2`, `ksuid` list `pg/text@1` and `sql/char@1`; `uuidv4` and `uuidv7` add `pg/uuid@1`. The same list is used on both targets, and `psl-column-resolution.ts` compares it with the column's codec id. So `String @default(uuid())` is refused on SQLite.

## Build

1. `applicableCodecIds` becomes `applicableDataTypes`, passed by each target rather than written in the framework: text generators apply to `pg/text`, `pg/char`, `pg/varchar` on Postgres and `sqlite/text`, `sqlite/character`, `sqlite/character-varying` on SQLite; the UUID generators add `pg/uuid` on Postgres.
2. The check compares the column's data type (the codec's data type) with the list. The message for a column it does not apply to names the column's data type.
3. Every other reader of `applicableCodecIds` (the TypeScript builder's presets, the language server, Mongo) moves to the data type list or is shown not to need it.

## Tests

`String @default(uuid())` and `@default(nanoid())` emit on SQLite; `Char(36) @default(uuid())` and `VarChar(36) @default(uuid())` emit on both targets; `Uuid @default(uuid())` on Postgres; `Int @default(uuid())` refused on both, naming `pg/int4` or `sqlite/integer`. A codec of a text data type from another pack is accepted without the framework knowing its id.

## Done when

The slice's grep `git grep -n "applicableCodecIds\|FUNCTION_ARGUMENT_KEYS" -- packages` returns nothing. Touched packages' tests, root `typecheck:agent`, `lint:deps`, `fixtures:check:agent`.
