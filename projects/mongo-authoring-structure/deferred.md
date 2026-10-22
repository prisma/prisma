# Deferred — Mongo authoring follows the Postgres structure

Work found while shaping that this project does not do. Each item is filed in Linear at close-out if it has no ticket yet.

- **TML-3470.** Collection validators list enum values of Int64, Date, Decimal128, Binary and ObjectId, and Double members that are `NaN` or infinite: build each value through the codec (`fromDataTypeValue`, then `toWire`) and carry it as Extended JSON. Depends on slice 1's entries and casts.
- **The Mongo ORM's discriminator filter and variant choice skip the codec** (`orm/src/collection.ts`, the `variant()` filter; `orm/src/model-stored-names.ts`, the read-side variant choice). Writes already use it. No difference shows while `mongo/string` is the only Mongo text type. Fix when an extension adds another. No ticket yet.
- **SQL `defineContract` accepts an optional discriminator column.** PSL refuses it after slice 1; the SQL TypeScript builder does not. No ticket yet.
- **SQL's builder returns refusals as data.** SQL PSL still catches one builder error and matches it to a source position (`relationIndexRefusal`); every other build error is thrown with no position (TML-3653 is one case). The SQL builder should adopt the model the Mongo builder gets in slice 2. No ticket yet.
- **SQL's default reader built on the framework function.** `data-type-default.ts` reads defaults with its own copy of the codec read. It should call the function slice 1 adds, keeping only what is about defaults: `sql` expressions and value-object documents. No ticket yet.
- **SQL polymorphism in `ContractDefinition`.** SQL PSL patches `discriminator`, `variants` and `base` onto the built contract (`2-sql/2-authoring/contract-psl/src/interpreter.ts`, `resolvePolymorphism`). No ticket yet.
- **SQL TypeScript builder does not check the discriminator column's type.** PSL checks it against `textDataTypes`; `defineContract` does not. No ticket yet. The Mongo builder gets the check in slice 2, because the rule moves into the builder.
- **TML-3680.** The type-constructor checks that read codecs run only in the control stack. Slice 2's Mongo builder runs `assembleDataTypeSupport` and would run these too once they move beside it.
- **A Mongo codec conformance test kit**, like `postgres-codec-testkit` and `sqlite-codec-testkit`. No ticket yet.
- **`renderValueLiteral` for `mongo/objectId@1`.** Matters once ObjectId enums are listable (TML-3470). No ticket yet.
- **Reading Mongo enum members through their type when a contract is loaded** (ADR 254, "Loading a contract"). No ticket yet.
- **Mongo `contract infer` and `contract print`.** No ticket yet.
- **PSL features Mongo's builder already supports:** `@@owner` and embedded models (TML-2250), `@@control`, collection options.
- **TML-3659.** Rename `authoring.dataTypes`. Order relative to slice 1 does not matter for correctness; whichever lands second renames Mongo's entries too.
- **`escapePslString` has two homes.** After slice 1's move, `@internal/sql-contract/data-type-support` holds only `escapePslString`, and an unexported copy lives in `packages/1-framework/2-authoring/psl-printer/src/serialize-print-document.ts`. Give it one home both families can import, and rename or remove the SQL entry point. No ticket yet.
- **SQL's default reader reads values into a codec with its own code.** After slice 1 it is the last place besides the framework's codec reader that does. Ticket at close-out (same item as "SQL's default reader built on the framework function" above).
- **Discriminator variants are keyed by the value as written; membership uses the data type's equality.** Only matters once a text data type declares its own `equalityKey`; none does. No ticket yet.
