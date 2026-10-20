# Slice 0: type-constructor arguments are values of data types

_Project: [`projects/raw-columns/`](../../spec.md). Linear: TML-3615. Lands as its own pull request against `main`, after slice 1 (TML-3585, #30745), which shipped `Raw("...")` with a plain string. Starts after the implementation of TML-3607 merges: that change removes field presets and ADR 246's option arguments (ADR 275, prisma/orm#30754), so this slice covers type constructors only._

## Outcome

Every argument of a type constructor that is a value is read as a value of a data type, through the same cast rule that attribute arguments use (ADR 254, `dataTypeValue`). A schema keeps its syntax, and a refusal names the data type:

```prisma
model Account {
  name    VarChar(255)          // 255 is a number; it reads as pg/int2 and casts to pg/int4
  price   Numeric(10, 2)
  created Timestamptz(3)
  bad     VarChar(3000000000)   // PSL_VALUE_TYPE_INCOMPATIBLE: Expected a number that pg/int4 can hold; got pg/int8
  worse   VarChar("255")        // PSL_VALUE_TYPE_INCOMPATIBLE: Expected a number; today this is accepted
}
```

The argument kinds `string`, `number`, `boolean` and `stringArray` are removed. `Raw`'s argument becomes a value of `sql/expression`, so it is written `` Raw(sql`ltree`) `` instead of `Raw("ltree")`, and `contract print` writes it with the `sql` literal printer. A raw type whose name needs double quotes, such as `` Raw(sql`"MyType"[]`) ``, can then be written and printed. This is a breaking change for schemas that use `Raw("...")`, with upgrade instructions.

## Chosen design

### The argument descriptor

After TML-3607, the only users of the `option` and `object` kinds (field presets) are gone, and that change removes them. `AuthoringArgumentDescriptor` (`packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts:68`) then has one arm:

- `{ kind: 'value', dataType: string, name?, optional? }`: a value of the named data type. New.

A reference to an entity stays on the constructor as `entityRefArg` (`pg.enum(AalLevel)`). Unchanged. If `option` or `object` survive TML-3607, this slice removes them, since no type constructor uses them.

`string`, `number` (with `integer`, `minimum`, `maximum`), `boolean` and `stringArray` are removed. No constructor in the repo uses `boolean` or `stringArray` (only tests do). Bounds move to the data type's parameter schema, which already holds them for every parameter in the table below (`pgPrecisionParams`, `pgCharacterLengthParams`, `pgNumericParams`, `pgBitLengthParams`, `postgisGeometryParams`, `pgvectorVectorParams`), as `docs/reference/codec-authoring-guide.md:561` already says.

### One read for every value

Today a type-constructor argument is read from its rendered text by `parsePslAuthoringArgumentValue` (`packages/1-framework/2-authoring/psl-parser/src/authoring-arguments.ts:316`), which accepts `VarChar("255")` and an unquoted `Raw(tsvector)`. An attribute argument is read from its expression by `dataTypeValue` (`attribute-spec/combinators/data-type-value.ts:49`): `readWrittenScalar`, then `readWrittenValue`, then `castTypedValue`, with refusals worded by `describeRefusal`.

The body of `parseDataTypeValue` becomes one function in `psl-parser`, `readExpressionAs(support, dataType, expression)`, returning the canonical value or `{ code, message }`. `dataTypeValue` wraps it in a leaf diagnostic as today. `mapPslHelperArgs` calls it for a `value` argument, using `ResolvedAttributeArg.expression`, which `readResolvedArgList` already sets (`resolve.ts:81`). The text parser for arguments (`parseJsLikeLiteral`, `parsePslObjectLiteral`, `parseStringArrayLiteral`, `unquoteStringLiteral`) is deleted. `mapPslHelperArgs` takes the stack's `DataTypeSupport`; `instantiatePslTypeConstructor` already has it in reach (`contract-psl/src/interpreter.ts:174`). A refusal is reported at the argument with the codes attribute arguments use: `PSL_VALUE_TYPE_INCOMPATIBLE`, `PSL_INVALID_LITERAL`, `PSL_UNKNOWN_LITERAL_TAG`.

`validateAuthoringArgument` (`framework-authoring.ts:1609`) checks that a `value` argument is present unless optional, and nothing about its shape: the value it receives is already canonical. `validateAuthoringTypeParams` still checks the parameters against the codec's schema.

### Which data type a number becomes

A written number reads through the target's plain-number entry. On Postgres (`postgres/src/core/data-type-entries.ts:29`) a whole number becomes the narrowest of `pg/int2`, `pg/int4` (both as a JavaScript number) and `pg/int8` (as digit text). `pg/int4` casts from `pg/int2` unchanged (`postgres/src/core/data-types.ts:148`). So an argument of `pg/int4` gives `255` for `VarChar(255)`, the same parameter as today, and every committed contract keeps its hash. A number too large for `int4`, or with a fraction, has no cast into `pg/int4` and is refused. A typmod in Postgres is an `int4`, so `pg/int4` is the honest type for every Postgres length, precision, scale and SRID.

On SQLite (`sqlite/src/core/data-type-entries.ts:20`) every whole number becomes `sqlite/integer`, whose canonical form is digit text (`sqlite/src/core/data-types.ts:38`). An argument of `sqlite/integer` would give `"255"`, which the length schema (`number.integer >= 1`) refuses and which would change contract hashes. This is the gap in open question 1.

### Constructors shared by several targets

`sql.String` is contributed by the SQL family, which cannot name a target's data type. It becomes a builder that the target calls with its whole-number data type, `sqlFamilyTypeConstructors({ wholeNumber })`, and Postgres and SQLite each contribute the result. `type.sql.String(...)` keeps its path. A target-level role name resolved at assembly (`dataType: 'wholeNumber'`) was considered and dropped: it is a small vocabulary of family types, which ADR 254 rejects.

### Argument table

Every type constructor in the repo with at least one argument, after TML-3607 removes field presets. Constructors with no arguments (the Postgres, SQLite and Mongo scalars, `Uuid`, `Inet`, `SmallInt`, `Real`, `Date`, `DateString`, `BigIntNumber`, `UnboundedInt`) are unaffected.

| Owner | Constructor | Argument | Today | Becomes |
|---|---|---|---|---|
| Postgres (`postgres/src/core/type-constructors.ts:74`) | `VarChar` | `length?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:84` | `Char` | `length?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:94` | `Numeric` | `precision?`, `scale?` | `number`, integer | `value` of `pg/int4` (each) |
| Postgres `:110` | `Timestamp` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:119` | `Timestamptz` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:129` | `Time` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:138` | `Timetz` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:186` | `TimestampString` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:196` | `TimestamptzJsDate` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:206` | `TimestamptzString` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:216` | `TimeString` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:226` | `Bit` | `length?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:236` | `VarBit` | `length?` | `number`, integer | `value` of `pg/int4` |
| Postgres `:246` | `Interval` | `precision?` | `number`, integer | `value` of `pg/int4` |
| Postgres (`postgres/src/core/authoring.ts:148`) | `pg.enum` | the enum | `entityRefArg` | unchanged: reference |
| SQL family (`2-sql/9-family/src/core/authoring-type-constructors.ts:3`) | `sql.String` | `length` | `number`, integer | `value` of the target's whole-number type: `pg/int4`; SQLite see open question 1 |
| pgvector (`3-extensions/pgvector/src/core/authoring.ts:5`) | `pgvector.Vector` | `length` | `number`, integer | `value` of `pg/int4` |
| PostGIS (`3-extensions/postgis/src/core/authoring.ts:6`) | `postgis.Geometry` | `srid?` | `number`, integer | `value` of `pg/int4` |
| SQL family (`2-sql/9-family/src/core/authoring-type-constructors.ts`) | `Raw` | `sql` | `string` | `value` of `sql/expression` |

That is 19 constructors with 20 arguments: 18 become values of `pg/int4` or the target's whole-number type, 1 becomes a value of `sql/expression` (`Raw`), and 1 reference keeps its kind. No Mongo constructor takes a value argument, so Mongo needs no data-type entries for this slice.

### The TypeScript builder

`ArgTypeFromDescriptor` (`packages/1-framework/2-authoring/contract/src/authoring-argument-types.ts:32`) maps an argument kind to a TypeScript parameter type. A `value` argument maps through a type that the pack registering the data type declares, from data type id to the TypeScript value an author passes: `'pg/int4': number`, `'sqlite/real': number`, `'sql/expression': SqlExpression`. The map is merged from the family, the target and the extensions, as `CodecTypes` is in `composed-authoring-helpers.ts`, and `TypeHelpersFromNamespace` passes it down. `ResolveTemplateValue` maps the argument's TypeScript value to its canonical form, so `type.VarChar(255)` still gives `typeParams: { length: 255 }` at the type level, which `Varchar<255>` in `codec-types.ts` relies on.

At run time, `createTypeHelpersFromNamespace` (`contract-ts/src/authoring-helper-runtime.ts:47`) turns each argument into the written value it stands for (a number into a number, a string into a string, a boolean into a boolean, a `SqlExpression` into a `sql` literal of its text) and run `readWrittenValue` and `castTypedValue`. The parameters PSL and TypeScript produce stay identical, as ADR 129 requires.

`type.Raw(...)` and the adapters' `rawColumn(...)` take `` sql`...` ``. ADR 268 says every builder field that takes raw SQL accepts only a `SqlExpression`, and the `sql` tag is already exported from the contract builder (`contract-ts/src/exports/contract-builder.ts:1`).

### `contract print` and `contract infer`

Both write a type-constructor call with `fewestArgumentsCall` and `pslTypeArgumentText` (`2-sql/9-family/src/core/psl-build/inferred-type-constructors.ts:90`, used by `psl-build/column-types.ts:47` and `postgres/src/core/psl-print/column-types.ts:41`), which prints a number as written and a string between quotes. They print each argument instead as a value of its `dataType`, through the writer `contract infer` already uses for defaults, `writeScalar` (`psl-build/default-mapping.ts:205`), exported for this. It writes the value in a form its data type admits, through the data type's entry and `print`, and proves the text reads back as the same value. `255` prints `255`; a `sql/expression` value prints `` sql`"MyType"[]` ``. A value it cannot write is refused through `refuseUnwritableTypeArgument`, as today. `pslTypeArgumentText` is deleted.

`inferredCodecRef` (`postgres/src/core/psl-infer/infer-default-codec.ts:60`) re-parses printed argument text with `parsePslPositionalArgs`. It takes the argument values from the call it built instead, and `parsePslPositionalArgs` is deleted.

### Assembly

`enforceConstructorInvariants` (`framework-components/src/control/control-stack.ts:446`) also refuses a `value` argument whose data type the stack does not register (`CONTRACT.DATA_TYPE_UNREGISTERED`) or that nothing in the stack writes. Today `dataTypeValue` finds that only when a schema uses the argument, and throws an `InternalError`.

### The language server

`argumentTypeLabel` in `language-server/src/hover.ts:178` shows a `value` argument as the forms its data type admits (`describeAdmittedForms`: "a number", `` sql`...` ``). `typeConstructorSnippet` (`completion-snippets.ts:23`) writes a tagged placeholder (`` sql`$1` ``) for a data type with a tag, as attribute arguments already do (`completion-snippets.ts:76`). Diagnostics come from the interpreter and need no change.

### Documentation

- ADR 231 line 135 lists "a DDL parameter (`VarChar(255)`)" as grammar. It moves to database values, and line 218 says type-constructor arguments use the same read as `dataTypeValue`.
- ADR 254 gets a dated amendment: a type-constructor argument that is a value names a data type and is admitted by the cast rule.
- `docs/reference/codec-authoring-guide.md:561` and the example at `:569` use `{ kind: 'value', dataType: 'pg/int4' }`.
- `docs/reference/error-reference.md` gains nothing new; the codes are the ones attribute arguments already report.

## Scope

In: the `value` kind and the removal of four kinds; `Raw` taking `` sql`...` `` in PSL, the TypeScript builder and `rawColumn`, with `contract print`, ADR 273, the prisma-8 skill reference and app upgrade instructions (`Raw("x")` becomes `` Raw(sql`x`) ``); the shared read; PSL type constructors; every constructor in the table; the family builder for `sql.String`; the TypeScript type map and runtime conversion; `contract print` and `contract infer`; assembly; the language server; ADR 231 and ADR 254; the codec authoring guide; package READMEs that show an argument descriptor; upgrade instructions for extension authors (`upgrade-instructions/pending/data-typed-constructor-arguments/extension/instructions.md`), since `AuthoringArgumentDescriptor` is published through `@prisma/orm-framework/components/authoring`; an app fragment that says a quoted number such as `VarChar("255")` is now refused.

Out: Field presets, option arguments and type aliases, which TML-3607 changes. Generator and default-function arguments such as `@onCreate(nanoid(16))`, which ADR 231's `funcCall` reads; their limits stay with the generator. Entity types whose factory reads its own input. Mongo data-type entries.

## Done conditions

- Every schema in the repo parses as before, and `pnpm fixtures:check` shows no change: every committed `contract.json` keeps its hash.
- `VarChar(3000000000)`, `Timestamp(2.5)` and `VarChar("255")` are refused at the argument with `PSL_VALUE_TYPE_INCOMPATIBLE` and the message attribute arguments give for the same value.
- `Timestamp(7)` is still refused by the parameter schema, at the argument.
- `sql.String(50)` produces the same parameters on Postgres and SQLite as today.
- A TypeScript contract and a PSL contract with the same constructors emit byte-identical contracts (`contract-psl/test/ts-psl-parity.test.ts`).
- `type.VarChar(255)` still types the column as `Varchar<255>` (type test).
- `contract print` and `contract infer` round-trip every constructor in the table.
- A pack whose `value` argument names an unregistered data type fails assembly with `CONTRACT.DATA_TYPE_UNREGISTERED`.
- No `kind: 'string' | 'number' | 'boolean' | 'stringArray'` argument descriptor remains outside tests of the refusal.
- `pnpm lint:deps`, `pnpm typecheck`, `pnpm test:packages`, `lint:throws` and `check:upgrade-coverage` pass.

## Decisions

1. **SQLite's whole-number argument type is `sqlite/real`** (Will, 2026-10-19). SQLite has no data type whose canonical whole number is a JavaScript number: `sqlite/integer` stores digit text so it holds every 64-bit value exactly, and type parameters are JSON numbers. A written whole number reads as `sqlite/integer` and casts to `sqlite/real` as a number (`asReal`), so `sql.String(255)` gives `255`; a fraction reads as `sqlite/real` and the length schema refuses it as not an integer. The cast is exact for every length the schema accepts. The alternative is a new SQLite data type that holds a whole number as a JavaScript number, which no SQLite column has, and which ADR 254 argues against.
2. **nanoid's `size` limit stays with the generator** (Will, 2026-10-19). TML-3607 removes the nanoid preset; its size becomes a generator argument (`@onCreate(nanoid(16))`), which this slice does not read. So a `value` argument carries no bounds.

## Dispatch plan

| # | Outcome |
|---|---|
| 1 | The `value` kind and the removal of four kinds; the shared `readExpressionAs`; `mapPslHelperArgs` reading expressions; assembly check; every constructor in the table on Postgres, SQLite, pgvector and PostGIS, with the family builder; PSL unit and interpreter tests, including the refusals above; fixtures unchanged |
| 2 | The TypeScript type map, `ArgTypeFromDescriptor` and `ResolveTemplateValue`, the runtime conversion in the type helpers; type tests and the TS and PSL parity test |
| 3 | `contract print` and `contract infer` through the data type writer; the language server; ADR 231, ADR 254, the codec authoring guide, READMEs; upgrade instructions |
