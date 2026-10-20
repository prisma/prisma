# Dispatch d: discriminator values are values of the discriminator column's type

Read `common-rules.md` first. Plan decision 3; design 14.7; the deferred item about stored values used with no codec (`projects/data-types-completion/deferred.md`), for discriminators only.

## Today

`@@base(Model, value)`'s spec (`packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts`) takes `value` as `str()`; `interpreter.ts` reads it without checking it against the discriminator column's type; the duplicate check (`PSL_DUPLICATE_DISCRIMINATOR_VALUE`) compares strings. At runtime `packages/3-extensions/sql-orm-client/src/collection-runtime.ts` compares raw row values with the variants' string keys, and `collection.ts` writes the variant's value straight into the column. Mongo's `derive-json-schema.ts` writes `{ enum: [variant.discriminatorValue] }` as stored.

## Build

1. `@@base(Model, value)` takes a value of the discriminator column's data type, read and cast like a default (`readWrittenValue`, then the cast to the column's type, then the column's codec's own check), resolved when the attribute is interpreted because the column is known only then. A value the cast rule refuses is reported at the value, with the diagnostics of a default. Stored as the column's type stores it.
2. The duplicate check compares the stored values.
3. Runtime: the ORM reads a row's discriminator with the column's codec (`fromWire`) and compares it with each variant's value as the codec gives it (`fromDataTypeValue`); writing a variant encodes the value with the column's codec (`toWire`).
4. Mongo: the `$jsonSchema` discriminator enum holds the value as the column's codec writes it for the database.
5. The Mongo PSL `@@base` gets the same rule if it shares the spec; if it has its own, apply the same rule there.
6. Update `deferred.md`: the discriminator part of the stored-values item is done.

## Tests

Ruled after the implementer stopped (plan decision 3): discriminator columns stay text-typed and the contract keeps keying variants by text; no integer discriminators. On Postgres and SQLite: a `String` discriminator works as today; `@@base(Shape, 4)` is refused at the value (a number is not text); on a `VarChar(5)` discriminator `@@base(Shape, "circle")` is refused as too long; duplicates (`"a"` and `"a"`) are refused; a `Char(6)` discriminator round-trips through `create` and a polymorphic read on PGlite and SQLite, which needs the runtime to read the row through the codec (padding). Mongo: the validator enum holds the value as the codec writes it.

## Done when

Every committed schema with `@@base` emits unchanged (`fixtures:check:agent`). Touched packages' tests, the ORM's polymorphism integration tests, root `typecheck:agent`, `lint:deps`.
