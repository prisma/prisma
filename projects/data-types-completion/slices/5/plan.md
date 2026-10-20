# Slice 5 plan: default function arguments and discriminator values are checked like defaults (TML-3389)

Design: `projects/data-types-completion/design.md` section 14, items 1 to 5 and 7. Branch `tml-3389-typed-written-values`, from `main` at `ac108237aa`. Ticket TML-3389. The last slice of the "Data types own column types" project.

**Excluded at Will's request (2026-10-20):** enum member values (design 14.6), which another agent is solving. With them go the deferred items that follow from how members are read: an enum member written as a number no cast admits, enum CHECK constraint literals, and Mongo validator enums.

## Outcome

```prisma
model Token {
  id   String @id @default(nanoid(8.5))
  kind String @default(uuid(5))
}

model Shape {
  id   Int @id
  kind Int
  @@discriminator(kind)
}

model Circle {
  radius Int
  @@base(Shape, "circle")
}
```

Today: `nanoid(8.5)` says `Expected an integer literal`, `uuid(5)` says `Expected one of: 4 | 7`, both with the generic code `PSL_INVALID_ATTRIBUTE_SYNTAX`; the same `uuid(5)` read from a Prisma 7 schema silently becomes a version 4 UUID; and `@@base(Shape, "circle")` is accepted although `kind` is an integer column.

After: each function argument is a value of the integer data type, read and cast like a default, then checked by the function itself: `nanoid(8.5)` reports the missing cast from a decimal to an integer, `uuid(5)` says `uuid: version must be 4 or 7, got 5`, both with `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` at the argument, and the Prisma 7 reader gives the same message. `@@base(Shape, "circle")` is refused at the value because a string is not a value of `kind`'s type; `@@base(Shape, 1)` is accepted.

## What the code does today

From an inventory of `main` on 2026-10-20:

- The six default function signatures (`autoincrement`, `now`, `ulid`, `uuid`, `cuid`, `nanoid`) are declared twice, once in each adapter's `control-mutation-defaults.ts`; the copies differ only in Postgres's `printArguments`. Lowering sits in the same files.
- Arguments use the PSL parser's shape combinators (`oneOf(num(4), num(7))`, `num(2)`, `int({ min: 2, max: 255 })`), so their messages are generic and their code is `PSL_INVALID_ATTRIBUTE_SYNTAX`. The limits 4/7, 2 and 2 to 255 are written in both adapters, the TypeScript `nanoid` helper, the field presets and a test mirror.
- `@default`'s `oneOf` already keeps only the arm that claims a call, so a registered function's diagnostics already come through alone. Arity messages say `Attribute "nanoid"`.
- The Prisma 7 reader binds arguments by position through its own `FUNCTION_ARGUMENT_KEYS` table with no checks, so `uuid(5)` lowers to version 4 and `nanoid(1)` passes through.
- Generators list the codec ids they apply to (`applicableCodecIds`: `pg/text@1`, `sql/char@1`, and `pg/uuid@1` for the UUID generators), the same list on both targets, compared with the column's codec id.
- `@@base`'s value is a plain string, not checked against the discriminator column's type; the duplicate check compares strings. At runtime the ORM compares raw row values with the variants' string keys and writes the string into the column, and Mongo's `$jsonSchema` copies the value as stored.
- `dataTypeValue`, the combinator that reads one written value of a data type, is used today only for `sql/expression` positions. Its rule that it is never a bare `oneOf` arm is a doc comment only.

## Decisions taken in this plan

1. **No check for a generator on an optional field.** Design item 14.3 gives such a check its own code, but no such check exists in Prisma 8 PSL today, and adding one would refuse schemas that work now. Out of scope; the Prisma 7 reader's own behaviour is unchanged.
2. **A Prisma 7 schema with an out-of-range argument is now refused** (`uuid(5)`, `nanoid(1)`), with `PSL.PRISMA7_UNKNOWN_DEFAULT` and the function's message, instead of being lowered to something else. An upgrade note says so.
3. **Discriminator values meet the database through the column's codec**: the runtime decodes the row's discriminator with `fromWire` and compares values; writes encode with `toWire`; Mongo's `$jsonSchema` writes the value as the column's codec writes it. This closes the deferred item for discriminators.
4. **`oneOf` refuses a `dataTypeValue` arm** at construction, an `InternalError`, so the rule is enforced rather than documented.

## Dispatches

| | What | Done when |
| --- | --- | --- |
| a | One set of signatures in the SQL family, `sqlDefaultFunctionSignatures({ integer })`, which Postgres calls with `pg/int4` and SQLite with `sqlite/integer`; the adapters' copies go, lowering stays. The limits live in `@internal/ids` and every other copy imports them. `uuid`, `cuid` and `nanoid` take one `dataTypeValue` of the integer type, then the function's own check, with the design's messages and `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` at the argument. Arity messages say `Default function "nanoid"`. `oneOf` refuses a `dataTypeValue` arm. | Each message tested on Postgres and SQLite; `nanoid(8.5)` reports the missing cast; the limits are written in one file (grep). |
| b | The Prisma 7 reader binds arguments through the same signatures; `FUNCTION_ARGUMENT_KEYS` is deleted; a refusal keeps `PSL.PRISMA7_UNKNOWN_DEFAULT` with the function's message. | Prisma 7 tests for each message; expected-contract fixtures unchanged. |
| c | Generators declare the data types they apply to (`applicableDataTypes`), passed by each target: text generators `pg/text`, `pg/char`, `pg/varchar` and `sqlite/text`, `sqlite/character`, `sqlite/character-varying`; the UUID generators add `pg/uuid`. The check compares the column's data type. | `String @default(uuid())` emits on SQLite; a `Char(36)` column takes `uuid()` on both targets; an `Int` column is refused as today. |
| d | `@@base(Model, value)` takes a value of the discriminator column's data type, read and cast like a default when the attribute is interpreted; the duplicate check compares values. The runtime and Mongo's `$jsonSchema` use the column's codec (decision 3). | A string on an integer discriminator refused at the value; an integer discriminator round-trips through `create` and a polymorphic read on PGlite and SQLite; Mongo's validator holds the codec's value. |
| e | Error reference (`PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`), ADR 254's sections on function arguments and discriminators, the upgrade note (decision 2, and any published name the slice removes), the slice's grep check, full checks. | All checks; manual QA below. |

## Must not change

Committed `contract.json`, `contract.d.ts`, migrations and snapshots; DDL. Every committed schema still emits.

## Manual QA

With the CLI built from the branch, on Postgres and SQLite: a schema with each default function and its arguments, valid and invalid, emitted and migrated; a polymorphic model with an integer and a string discriminator, created and read back through the ORM; a Prisma 7 schema with `uuid(7)`, `uuid(5)` and `nanoid(1)` read by the Prisma 7 reader.

## Halt conditions

- A committed contract or any DDL changes.
- A committed schema stops emitting.

## Not in this slice

- Enum member values, enum CHECK literals and Mongo validator enums (excluded above).
- Problems found in earlier slices' QA: TML-3586, TML-3637, TML-3638, TML-3639.
- Project close-out, which follows this slice (project plan, "Close-out").
