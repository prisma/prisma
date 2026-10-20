# Slice 5 manual QA (TML-3389)

Run 2026-10-20 on branch `tml-3389-typed-written-values` at `09d928f06d`, with the CLI built from the branch (`mise exec -- pnpm build`, exit 0). Postgres is a local `postgres:17-alpine` container (`s5-qa-pg`, removed afterwards); SQLite is a file. Working projects live under `wip/s5/qa/` (`pg`, `sqlite`, `disc-pg`, `disc-sqlite`, `p7`, `print-*`), each with `node_modules` linked to `examples/prisma-8-demo` or `examples/prisma-8-demo-sqlite`. `P` below is `node_modules/.bin/prisma` at the worktree root. Negative cases ran through `wip/s5/qa/neg.sh`, `negd.sh` and `p7.sh`, which write a one-model schema, run `P contract emit --json` and print each diagnostic's code, message and start position (line:column). Raw logs: `wip/s5/qa/neg-step1.log`, `neg-step2.log`, `negd.log`, `p7-neg.log`.

Overall verdict: **pass**. No defect in the slice's behaviour. Three messages are confusing (listed at the end), and two gaps are outside the slice.

## 1. Generator arguments, Postgres and SQLite: pass

Schema (`wip/s5/qa/pg/contract.prisma`):

```prisma
model Token {
  id     String      @id @onCreate(uuid())
  v7     Uuid        @onCreate(uuid(7))
  c2     String      @onCreate(cuid(2))
  nano   String      @onCreate(nanoid())
  nano12 VarChar(12) @onCreate(nanoid(12))
  ul     Char(26)    @onCreate(ulid())
  label  String
}
```

SQLite used the same fields typed `String`, plus `short sql.String(5) @onCreate(uuid())`.

| Command | Exit | Result |
| --- | --- | --- |
| `P contract emit` (pg, sqlite) | 0, 0 | Contracts written. |
| `P migration plan --name init -y` (pg, sqlite) | 0, 0 | Postgres: `character varying(12)`, `character(26)`, `uuid`, `text`. SQLite: `TEXT`, and `CHARACTER VARYING` for `sql.String(5)`. |
| `P db migrate -y` (pg, sqlite) | 0, 0 | `Applied 1 migration(s)`. |
| `tsx tokens.ts`: two `Token.create({ label })`, then `Token.all()` (pg, sqlite) | 0, 0 | Lengths on both targets: `id` 36 (version digit 4), `v7` 36 (version digit 7), `c2` 24, `nano` 21, `nano12` 12, `ul` 26; SQLite `short` 36. |

Invalid forms, one at a time, as `v String @onCreate(<form>)`, line 5. The results are identical on Postgres and SQLite except the type ids in the decimal message (`sqlite/integer`, `sqlite/real`). Every case exits 2 with `CONTRACT.SOURCE_LOAD_FAILED`; the diagnostic inside is:

| Form | Code | Message | Position |
| --- | --- | --- | --- |
| `uuid(5)` | `PSL_INVALID_GENERATOR_ARGUMENT` | `uuid: version must be 4 or 7, got 5` | 5:27, the argument |
| `uuid(4.0)` | `PSL_VALUE_TYPE_INCOMPATIBLE` | `Expected a number that pg/int4 can hold; got pg/numeric` | 5:27, the argument |
| `nanoid(1)` | `PSL_INVALID_GENERATOR_ARGUMENT` | `nanoid: size must be between 2 and 255, got 1` | 5:29, the argument |
| `nanoid(1000)` | `PSL_INVALID_GENERATOR_ARGUMENT` | `nanoid: size must be between 2 and 255, got 1000` | 5:29 |
| `nanoid(8.5)` | `PSL_VALUE_TYPE_INCOMPATIBLE` | `Expected a number that pg/int4 can hold; got pg/numeric` | 5:29 |
| `cuid(1)` | `PSL_INVALID_GENERATOR_ARGUMENT` | `cuid: version must be 2, got 1` | 5:27 |
| `cuid()` | `PSL_INVALID_ATTRIBUTE_SYNTAX` | `Generator function "cuid" is missing required argument "version"` | 5:22, the call |
| `nanoid(size: 8)` | `PSL_INVALID_ATTRIBUTE_SYNTAX` | `Generator function "nanoid" received unknown argument "size"` | 5:29, the argument |
| `nanoid("8")` (extra) | `PSL_VALUE_TYPE_INCOMPATIBLE` | `Expected a number` | 5:29 |
| `uuid(4, 7)` (extra) | `PSL_INVALID_ATTRIBUTE_SYNTAX` | `Generator function "uuid" received too many positional arguments` | 5:22 |

Boundaries `nanoid(2)`, `nanoid(255)` and `uuid(4)` emit (exit 0). `@default(uuid())` is refused with `PSL_GENERATOR_IN_DEFAULT`, pointing at `@onCreate(uuid())`.

Language server: `wip/s5/qa/lsp-client.mjs` starts `P lsp --stdio` in `wip/s5/qa/pg`, opens `contract.prisma` and asks for hover and signature help (exit 0, server exited). Hover on `uuid(7)` and `uuid()` shows `uuid((4 | 7)?)` with "Generates a UUID when a value is not supplied."; signature help shows `uuid((4 | 7)?)`. `nanoid` shows `nanoid(integer from 2 to 255?)`, `cuid` shows `cuid(2)`. No diagnostics on the valid file.

## 2. Column length: pass

Postgres, `v <type> @onCreate(<call>)`:

| Field | Exit | Diagnostic |
| --- | --- | --- |
| `VarChar(5) @onCreate(uuid())` | 2 | `PSL_GENERATOR_NOT_APPLICABLE`, `Field "Row.v": uuid() writes 36 characters, which does not fit a column of 5 characters.`, at `uuid` (5:26) |
| `Char @onCreate(uuid())` | 2 | same code, `... which does not fit a column of 1 character.` (5:20) |
| `VarChar(36) @onCreate(uuid())` | 0 | |
| `Char(36) @onCreate(uuid())` | 0 | |
| `VarChar @onCreate(uuid())` | 0 | |
| `Char(5) @onCreate(nanoid())` | 2 | `nanoid() writes 21 characters, which does not fit a column of 5 characters.` |
| `Char(5) @onCreate(nanoid(5))` | 0 | |
| `VarChar(23) @onCreate(cuid(2))` | 2 | `cuid(2) writes 24 characters, ...` |
| `VarChar(25) @onCreate(ulid())` | 2 | `ulid() writes 26 characters, ...` |

SQLite: `sql.String(5) @onCreate(uuid())` emits (exit 0), and step 1's ORM run stored the full 36-character UUID in that column.

## 3. Discriminators: pass

Schemas `wip/s5/qa/disc-pg/contract.prisma` and `disc-sqlite/contract.prisma`: three hierarchies, each a base with `kind` as discriminator and variants `Circle` (`"circle"`) and `Box` (`"box"`, own table). Postgres `kind` types: `String`, `Char(6)`, `VarChar(10)`. SQLite has no `Char(n)` or `VarChar(n)` in PSL (its only length-taking text type is `sql.String(n)`, which is `sql/varchar@1`), so SQLite used `String`, `sql.String(6)` and `sql.String(10)`.

| Command | Exit | Result |
| --- | --- | --- |
| `P contract emit`, `P migration plan`, `P db migrate -y` (pg, on a fresh database `disc`; sqlite) | 0 each | Postgres DDL: `text`, `character(6)`, `character varying(10)`. |
| `tsx run.ts`: `variant('circle').create(...)`, `variant('box').create(...)`, `orderBy(id).all()`, `variant('box').all()`, `variant('circle').all()` for each hierarchy (pg, sqlite) | 0, 0 | Every hierarchy on both targets reads `[{"id":1,"kind":"circle","name":"wheel","radius":3},{"id":2,"kind":"box","name":"crate","side":2}]`; each `variant(...)` returns only its row. |
| `psql -c 'select kind, octet_length(kind) from "ShapeC"'` | 0 | Postgres stores `box` padded to 6 bytes; the ORM reads it back as `box`. |

Refusals, all exit 2:

| Case | Code | Message | Position |
| --- | --- | --- | --- |
| `@@base(Shape, 4)` (pg, sqlite) | `PSL_INVALID_ATTRIBUTE_SYNTAX` | `Expected a string literal` | the value |
| `"circle"` on `VarChar(5)` (pg) | `PSL_INVALID_DEFAULT_LITERAL` | `Field "Shape.kind": pg/varchar JSON value must be a string of at most 5 characters` | the value in `Circle` |
| two variants `"circle"` (pg, sqlite) | `PSL_DUPLICATE_DISCRIMINATOR_VALUE` | `Discriminator value "circle" is used by both "Circle" and "Box" on base model "Shape"` | the second `@@base` |
| `"box"` and `"box   "` on `Char(6)` (pg) | `PSL_DUPLICATE_DISCRIMINATOR_VALUE` | `Discriminator value "box" is used by both ...` | the second `@@base` |
| `Uuid` discriminator (pg) | `PSL_INVALID_ATTRIBUTE_ARGUMENT` | `Discriminator field "kind" on model "Shape" must be text, such as String, but is "Uuid"` | the `@@discriminator` |
| `Int` discriminator (pg, sqlite) | `PSL_INVALID_ATTRIBUTE_ARGUMENT` | `... must be text, such as String, but is "Int"` | the `@@discriminator` |

On SQLite, `"circle"` on `sql.String(5)` emits (exit 0), because SQLite does not limit the length. That matches the integration test, which skips the length case on SQLite.

`@@base(Shape, 4)` was already refused with the same message on `main` (the value was `str()`), so this is not a change the slice made; the plan's "today it is accepted" was not accurate.

## 4. Prisma 7 reader: pass

`wip/s5/qa/p7/prisma.config.ts` uses `prisma7Schema('schema.prisma')` on Postgres. A `Token` model with `@default(uuid())`, `@default(uuid(7))`, `@default(cuid())` and `@default(nanoid(12))` emits (exit 0). The contract holds `uuidv4`, `uuidv7`, `cuid2` and `nanoid` with `{ "size": 12 }` as create generators.

Refusals, all exit 2 with `CONTRACT.SOURCE_LOAD_FAILED`, line 11 `  id String @id @default(<form>)`:

| Form | Code | Message | Position |
| --- | --- | --- | --- |
| `uuid(5)` | `PSL.PRISMA7_UNKNOWN_DEFAULT` | `Field "Token.id": uuid: version must be 4 or 7, got 5` | 11:31, the argument |
| `nanoid(1)` | `PSL.PRISMA7_UNKNOWN_DEFAULT` | `Field "Token.id": nanoid: size must be between 2 and 255, got 1` | 11:33, the argument |
| `uuid()` with `@db.VarChar(5)` | `PSL.PRISMA7_GENERATOR_REFUSED` | `Field "Token.id": @default(uuid()) cannot fill its column: uuid() writes 36 characters, which does not fit a column of 5 characters.` | 11:17, the `@default` |
| `cuid(1)` (extra) | `PSL.PRISMA7_UNKNOWN_DEFAULT` | `Field "Token.id": cuid: version must be 2, got 1` | the argument |
| `nanoid(1000)` (extra) | `PSL.PRISMA7_UNKNOWN_DEFAULT` | `... size must be between 2 and 255, got 1000` | the argument |
| `nanoid(size: 8)` (extra) | `PSL.PRISMA7_UNKNOWN_DEFAULT` | `Field "Token.id": Generator function "nanoid" received unknown argument "size"` | the argument |
| `nanoid(8.5)`, `uuid(4.0)` (extra) | `PSL.PRISMA7_UNKNOWN_DEFAULT` | `Field "Token.id": Expected a number that pg/int4 can hold; got pg/numeric` | the argument |
| `nanoid()` with `@db.Char(5)` (extra) | `PSL.PRISMA7_GENERATOR_REFUSED` | `... nanoid() writes 21 characters, which does not fit a column of 5 characters.` | the `@default` |

## 5. `contract print`: pass on Postgres; SQLite cannot print (not this slice)

| Command | Exit | Result |
| --- | --- | --- |
| `P contract print --format human --output ../print-pg/contract.prisma` in `pg` | 0 | Prints `@onCreate(uuid())`, `@onCreate(uuid(7))`, `@onCreate(cuid(2))`, `@onCreate(nanoid())`, `@onCreate(nanoid(12))`, `@onCreate(ulid())` on the same types. |
| `P contract emit` in `print-pg` | 0 | Storage, execution and profile hashes equal the original (`ccb5749a…`, `4c63523f…`, `3916f444…`); `cmp` of the two `contract.json` files: identical. |
| same for the Prisma 7 contract of step 4 (with `nanoid(12) @db.VarChar(12)`) | 0, 0 | Prints `@onCreate(uuid())`, `@onCreate(uuid(7))`, `@onCreate(cuid(2))`, `VarChar(12) @onCreate(nanoid(12))`; re-emitted `contract.json` identical. |
| `P contract print` in `sqlite` | 2 | `CONTRACT.PRINT_UNSUPPORTED`: the SQLite target does not provide `buildPslContract`. Same on `main`; not this slice. |

## 6. Upgrade notes: pass, with small gaps

App note (`upgrade-instructions/pending/generator-function-arguments-and-column-length/app/instructions.md`):

- `prisma7-default-function-arguments-checked`: matches. The code, the message `Field "<Model>.<field>": uuid: version must be 4 or 7, got 5`, the position at the argument, `nanoid(size: 8)` refused and `cuid()` read as `cuid(2)` are all what I saw. Its detection patterns match `uuid(5)`, `cuid(1)`, `nanoid(1)`, `nanoid(256)`, `nanoid(1000)`, `nanoid(size: 8)`, `nanoid(8.5)` and not `uuid()`, `uuid(4)`, `uuid(7)`, `cuid()`, `cuid(2)`, `nanoid()`, `nanoid(2)`, `nanoid(12)`, `nanoid(255)` (`wip/s5/qa/regex.mjs`). Gap: a Prisma 7 `@default(uuid(4.0))` is now refused too, with the decimal message; the note covers fractions only for `@onCreate`.
- `generator-function-argument-diagnostics`: matches, codes and messages exactly.
- `generator-function-argument-with-fraction`: matches the code. The note does not quote the message, which reads `Expected a number that pg/int4 can hold; got pg/numeric`.
- `generator-fits-column`: matches; the message format, both codes, the lengths I tested (`uuid` 36, `ulid` 26, `cuid(2)` 24, `nanoid()` 21), bare `Char` as 1, bare `VarChar` unlimited, SQLite unlimited, and the `Char(5) @onCreate(nanoid(5))` fix. The Prisma 7 message has the extra prefix `@default(uuid()) cannot fill its column:`. I did not check "used to fail at the first insert".
- `discriminator-must-be-text`: matches the message. Gap: "may now also be a `Char(n)` or `VarChar(n)` column" and "a value longer than a `VarChar(n)` column holds is refused" hold on Postgres only. SQLite has neither type in PSL and does not check a `@@base` value's length.

Extension note: I read it as an extension author. The `sqlIntegerArgumentGeneratorFunctions`, `GeneratorFunctionField.length`, `buildContractDefinition` lookups, `label` and `oneOf` steps are consistent with the behaviour above; I did not build an extension to exercise them.

## Confusing messages

1. A decimal generator argument (`nanoid(8.5)`, `uuid(4.0)`) says `Expected a number that pg/int4 can hold; got pg/numeric`. It names internal data type ids, and `4.0` reads as a number an integer can hold. Something like "`nanoid` takes a whole number, got 8.5" would be clearer. The same text appears through the Prisma 7 reader, where the user never wrote a Prisma 8 type.
2. A `@@base` value too long for a `VarChar(5)` discriminator says `Field "Shape.kind": pg/varchar JSON value must be a string of at most 5 characters`, code `PSL_INVALID_DEFAULT_LITERAL`. It is not a default, the user wrote no JSON, and `pg/varchar` is an internal id. The test pins this text, so it is intended for now.
3. `PSL.PRISMA7_UNKNOWN_DEFAULT` for an argument out of range (`uuid(5)`): the function is known; only its argument is wrong. The plan chose this code on purpose.

## Outside this slice

- `contract print` is unsupported on SQLite (also on `main`).
- SQLite DDL for `sql.String(5)` is `CHARACTER VARYING` without the length. SQLite ignores the length anyway.
