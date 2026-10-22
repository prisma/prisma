# ADR 279 — Convenience date and time types choose an explicit type from their arguments

**Status:** Accepted. Implemented: the type choice, the four PostgreSQL convenience types, and every reader of a field's codec. Not yet implemented: items 8 and 10, what the Prisma 7 reader, `contract infer`, `contract print` and `prisma orm init` write, and the `temporal.*` aliases built on `DateTime` ("Created-at and updated-at"); until then those write and use the explicit types.
**Builds on:** [ADR 241 — Scalar types use the authoring type-constructor channel](ADR%20241%20-%20Scalar%20types%20use%20the%20authoring%20type-constructor%20channel.md)
**Amends:** [ADR 254 — Data types and casts](ADR%20254%20-%20Data%20types%20and%20casts.md), [ADR 257 — Scalar types are named after the target on every surface](ADR%20257%20-%20Scalar%20types%20are%20named%20after%20the%20target%20on%20every%20surface.md), [ADR 275 — Client generators are field attributes, and a type alias is expanded into each column](ADR%20275%20-%20Client%20generators%20are%20field%20attributes%2C%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md)

## At a glance

On PostgreSQL today, each date and time type name fixes one column type and one kind of value that the application reads: `Timestamptz` is a `timestamptz` column read as a `Temporal.Instant`, `TimestamptzString` is the same column read as a string, and so on. This decision calls those the **explicit types**, and keeps them.

It adds four **convenience types**, named for what a field means in the application: `DateTime` for a moment in time, `Date` for a calendar date, `Time` for a time of day, and `Duration` for a length of time. Each convenience type becomes one explicit type. Two optional arguments say which: `value`, what the application reads, and `column`, the PostgreSQL column type.

```prisma
model Order {
  id       Int      @id
  paidAt   DateTime
  heldAt   DateTime(value: temporal, column: timestamptz, precision: 3)
  shipBy   Date(value: string)
  opensAt  Time(value: temporal, precision: 0)
}
```

| Field | Becomes the explicit type | Column | The application reads |
| --- | --- | --- | --- |
| `paidAt` | `TimestamptzJsDate(3)` | `timestamptz(3)` | a JavaScript `Date` |
| `heldAt` | `TimestamptzTemporal(3)` | `timestamptz(3)` | `Temporal.Instant` |
| `shipBy` | `DateString` | `date` | a string, such as `"2024-02-29"` |
| `opensAt` | `TimeTemporal(0)` | `time(0)` | `Temporal.PlainTime` |

The contract stores what the explicit type stores: the codec, its data type and its parameters. `heldAt` is stored exactly as if the user had written `heldAt TimestamptzTemporal(3)`, and nothing in the contract records that a convenience type was written.

## Decision

1. **Date and time types have two layers.** Each explicit type uses one codec, so it fixes one column type and one application value, and is named after the database as ADR 257 says. Each convenience type is named for what a field means in the application, and becomes exactly one explicit type.
2. **A convenience type's arguments choose its explicit type.** `value` says what the application reads: a JavaScript `Date`, a `Temporal` object or a string. `column` says the PostgreSQL column type. Each has a default that the convenience type declares. Any other argument, such as `precision`, is passed on to the chosen explicit type.
3. **A convenience type is a type choice: a type declaration whose arguments name the explicit type it becomes.** It declares its option arguments, each with a fixed set of values written as bare names and a default, the arguments it passes on (such as `precision`), and a table from each allowed combination of option values to the name of an explicit type constructor, with any parameter defaults for that combination. An unlisted combination is refused.
4. **The contract stores only the explicit type.** The contract format, the codecs, the data types, the storage hash and the execution hash are the same whether a schema writes the convenience type or the explicit type it becomes.
5. **The PostgreSQL target provides four convenience types:**

   | Convenience type | `value` choices | `column` choices | Defaults |
   | --- | --- | --- | --- |
   | `DateTime` | `jsDate` (a JavaScript `Date`), `temporal` (`Temporal.Instant`), `string` | `timestamptz`, `timestamp` | `jsDate`, `timestamptz`; precision 3 with `jsDate`, PostgreSQL's default otherwise |
   | `Date` | `string`, `temporal` (`Temporal.PlainDate`) | `date` | `string` |
   | `Time` | `string`, `temporal` (`Temporal.PlainTime`) | `time`; `timetz` is allowed only with `value: string` | `string`, `time` |
   | `Duration` | `string` (an ISO 8601 duration such as `P1Y2M`), `parts` (the object `{ months, days, micros }`) | `interval` | `string` |

   The value names repeat the suffixes of the explicit types, so `DateTime(value: jsDate)` and `TimestamptzJsDate` read as the same thing. No default needs a global `Temporal`, so every default works on a runtime without one. A JavaScript `Date` is the default only for a moment in time; a calendar date, a time of day and a length of time default to plain ISO 8601 strings, because JavaScript has no built-in value for them and a `Date` there stores the wrong day.

6. **Every explicit type for a column that has several codecs carries a suffix naming its kind of value.** The explicit types that read `Temporal` values gain the suffix `Temporal`, next to the existing `String` and `JsDate` suffixes:

   | Column | `Temporal` value | Explicit name today | Explicit name after |
   | --- | --- | --- | --- |
   | `timestamptz` | `Temporal.Instant` | `Timestamptz`, and `DateTime` as a second name | `TimestamptzTemporal` |
   | `timestamp` | `Temporal.PlainDateTime` | `Timestamp` | `TimestampTemporal` |
   | `date` | `Temporal.PlainDate` | `Date` | `DateTemporal` |
   | `time` | `Temporal.PlainTime` | `Time` | `TimeTemporal` |

   This frees `DateTime`, `Date` and `Time` for the convenience types. Without the suffix, a name such as `Timestamptz` would look like a neutral default when it is one specific kind of value. For the same reason, `Interval`, which reads the object `{ months, days, micros }`, becomes `IntervalParts`, next to the new `IntervalString`.

7. **Three codecs are added:** a `timestamp` column read as a JavaScript `Date`, and a `timestamp` column read as a `Temporal.Instant`, both reading and writing the stored value as UTC; and an `interval` column read as an ISO 8601 duration string. Each gets an explicit type: `TimestampJsDate(p)` for the `Date` codec, `TimestampInstant(p)` for the `Temporal.Instant` codec, and `IntervalString(p)`. `IntervalString` reads interval text in every `IntervalStyle` PostgreSQL prints (`postgres`, `postgres_verbose`, `sql_standard`, `iso_8601`) and returns the ISO 8601 duration ADR 254 stores, so it needs no `IntervalStyle` setting. `DateTime(column: timestamp)` with `value: jsDate` becomes `TimestampJsDate`, with `value: temporal` becomes `TimestampInstant`, and `Duration` with `value: string` becomes `IntervalString`. `TimestampInstant` names its `Temporal` type rather than taking the `Temporal` suffix, because the `timestamp` column has two `Temporal` codecs and `TimestampTemporal` is the one that reads `Temporal.PlainDateTime`.
8. **The Prisma 7 reader maps Prisma 7's `DateTime` to `TimestampJsDate(3)`,** which `contract print` writes as `DateTime(column: timestamp)`: a `timestamp(3)` column read as a JavaScript `Date`, instead of a string. The column and its stored values do not change; only the application value goes from a string back to the `Date` that Prisma 7 gave, so an upgraded application keeps the values its code was written for. `prisma orm init`, which creates new columns, writes plain `DateTime`, a `timestamptz(3)` column read as a `Date`.
9. **A string value is ISO 8601, the same on every server.** Every string codec of a date or time type returns the form its data type stores (see ADR 254, "Date and time types") and reads that form back unchanged. PostgreSQL's display text, such as `2024-01-01 00:00:00+00` or a year written with BC, never reaches the application. The `timestamptz` codec converts any session time zone offset to UTC itself; the `timetz` codec keeps the offset the value was stored with, because that offset is part of a `timetz` value. Prisma requires `DateStyle=ISO` on its database connections: it sets it on the connections it opens, and refuses a value it reads in another style with an error naming the setting. The codec ids do not change; the old text was never a format an application could rely on.
10. **`contract infer` and `contract print` write convenience types,** with arguments only where they differ from the defaults. A column no convenience type covers, a `timestamp` read as `Temporal.PlainDateTime`, is written as its explicit type. `prisma orm init` writes `DateTime`.
11. **A convenience name means the same thing on every target.** This decision covers PostgreSQL. Another target adds convenience types under the same names, and renames any explicit type that already uses one of them for something else.

## Why

Prisma 8 gives users explicit, predictable controls first, then makes common cases easy by building convenience APIs on top of them. For example, the `postgres({ contract, url })` function builds the runtime, adapter and driver that a user could otherwise create and connect by hand. The date and time types have the explicit controls but nothing built on top of them.

In Prisma 7, every date or time field is `DateTime`, and the application always reads a JavaScript `Date`. A `@db.*` attribute changes the column type. A user who never learns those attributes still gets a working field. That was simple, but Prisma made the choice for the user, and for some fields it was wrong. A `Date` is a moment in time, not a calendar date: a birthday created at local midnight on a machine east of UTC is stored as the day before.

Prisma 8's explicit types fix that by making every choice visible. But each name fixes both the column type and the kind of value, so PostgreSQL has eleven date and time type names (`Timestamptz`, `TimestamptzJsDate`, `TimestamptzString`, `Timestamp`, `TimestampString`, `Date`, `DateString`, `Time`, `TimeString`, `Timetz`, and `DateTime` as a second name for `Timestamptz`). Prisma 8 does not say which one a new user should pick. To choose, a user must already know the difference between `timestamp` and `timestamptz`, what each `Temporal` type means, and how each kind of value behaves. A user writing a schema thinks "this field is when the order was paid", not "this is a `timestamptz` column read as a `Temporal.Instant`".

The convenience types give that user one name per concept, with defaults that work. Every explicit choice stays available, as an argument or as the explicit type itself.

## How it works

### A type choice names its explicit types

An explicit type is a type constructor: it names one codec, and maps its arguments onto that codec's parameters.

```ts
TimestamptzTemporal: {
  kind: 'typeConstructor',
  args: [{ kind: 'value', dataType: 'pg/int4', name: 'precision', optional: true }],
  output: {
    codecId: 'pg/timestamptz-temporal@1',
    typeParams: { precision: { kind: 'arg', index: 0 } },
  },
},
```

A convenience type is a different kind of declaration in the same namespace, a type choice. It names no codec. It declares its option arguments, each with its values and a default, the value arguments it passes on by name, and a table whose rows each name an explicit type constructor of the same namespace:

```ts
DateTime: {
  kind: 'typeChoice',
  args: [
    { kind: 'option', name: 'value', values: ['jsDate', 'temporal', 'string'], default: 'jsDate', optional: true },
    { kind: 'option', name: 'column', values: ['timestamptz', 'timestamp'], default: 'timestamptz', optional: true },
    { kind: 'value', name: 'precision', dataType: 'pg/int4', optional: true },
  ],
  choices: [
    { when: { value: 'jsDate', column: 'timestamptz' }, type: 'TimestamptzJsDate', defaults: { precision: 3 } },
    { when: { value: 'temporal', column: 'timestamptz' }, type: 'TimestamptzTemporal' },
    // …one row for each combination below
  ],
},
```

As a table:

| `value` | `column` | Explicit type | Parameter defaults |
| --- | --- | --- | --- |
| `jsDate` (default) | `timestamptz` (default) | `TimestamptzJsDate` | precision 3 |
| `temporal` | `timestamptz` | `TimestamptzTemporal` | |
| `string` | `timestamptz` | `TimestamptzString` | |
| `jsDate` | `timestamp` | `TimestampJsDate` | precision 3 |
| `temporal` | `timestamp` | `TimestampInstant` | |
| `string` | `timestamp` | `TimestampString` | |

That is `DateTime`'s table; the other three are declared the same way. Resolving a call fills each option left out with its default, looks up the row for the option values, then instantiates the named explicit constructor with the passed-on arguments, a row default standing in for one left out, so the result is exactly what writing the explicit type gives. A combination with no row, such as `Time(value: temporal, column: timetz)`, is refused at the argument that makes it invalid, and the message lists the values that argument accepts with the others as written; a value an option does not list, such as `Date(value: jsDate)`, is refused the same way. A passed-on argument the chosen constructor does not take is refused at that argument. Arguments are written by name or in declaration order, so `Time(3)` reads `3` as the `value` option and is refused. Every argument is optional, so a type choice is also written bare, as its default row. Assembly refuses a table that names a constructor no component registers beside it, a combination or default an option does not list, defaults with no row, a row default for an argument the choice does not pass on, and a passed-on argument whose data type differs from the chosen constructor's.

The field-preset option arguments and select templates (ADR 246) are not used: a select resolves a template value and has no defaults and no refusal, while a type choice resolves to a named constructor, which is what "becomes one explicit type" means.

Every place that reads a field's codec reads the codec its call resolves to, including through a `types {}` alias: the PSL column resolution, the `@default` value check and the `@onCreate`/`@onUpdate` generator lookup, the Prisma 7 reader and the TypeScript builder, whose `type.*` helpers (ADR 275) include the type choices and resolve their application type at compile time from literal arguments. The `type.*` helper of a type choice takes the same arguments in the same order, and its type is one overload per row, so a call is typed as the explicit type it chooses and a combination with no row does not compile. The editor's hover shows each argument's values as PSL writes them and the explicit type each combination becomes.

### What the contract and the tools see

The PSL interpreter resolves a convenience type to its explicit type's codec and parameters while it builds the contract, so the contract only ever holds the explicit type. The migration planner, `db verify` and the runtime read the contract and are unchanged.

`contract infer` and `contract print` write a schema from a database or a contract, where nothing records which layer the user wrote. They write the convenience type: the one whose choices reach the column's codec, with the `value:`, `column:` and `precision:` arguments that differ from its defaults. Each data type marks at most one type constructor `inferred` (ADR 254); a convenience type is the inferred constructor of every data type it reaches, and the explicit type is written only for a codec no convenience type reaches. The printer runs the text it writes back through the interpreter, as it does today, to prove it gives the same codec and parameters.

### Combinations left out

- A JavaScript `Date` for a calendar date or a time of day. A `Date` is a moment in time, so a calendar date stored through one depends on the time zone of the machine that made it. That is the Prisma 7 bug this layer must not bring back.
- `Temporal.PlainTime` on a `timetz` column, because it drops the stored UTC offset.
- `Temporal.PlainDateTime`, a date and a time with no time zone. It is rarely what an application means: a field that holds "9am wherever the user is". It stays available as the explicit type `TimestampTemporal`. `DateTime(value: temporal, column: timestamp)` reads a `Temporal.Instant`, treating the stored value as UTC.

### Created-at and updated-at

ADR 275 has the PostgreSQL target ship ready-made type aliases under `temporal`, such as `temporal.UpdatedAt`, built on `TimestamptzTemporal` (formerly `Timestamptz`), with `String` and `JsDate` variants for the other kinds of value. With this decision they are built on `DateTime` instead, for example `temporal.UpdatedAt = DateTime @onCreate(now()) @onUpdate(now())`, and use its defaults. `now()` picks its generator from the field's final codec, so it writes a `Date`, a `Temporal.Instant` or a string to match.

The `String` and `JsDate` variants are not needed. A contributed alias takes no arguments (ADR 275), so a user who wants another kind of value writes the attributes on the convenience type, `DateTime(value: string) @onCreate(now()) @onUpdate(now())`, or defines their own alias with that line.

## Consequences

- A user can write `DateTime`, `Date` or `Time` and get a working field without knowing PostgreSQL's column types or the `Temporal` API. A user who wants a specific column type or kind of value says so with an argument, or writes the explicit type.
- **Breaking for schemas that write `DateTime`, `Date`, `Time`, `Timestamptz`, `Timestamp` or `Interval`.** `DateTime`, `Date` and `Time` change meaning from one explicit type to a convenience type, whose defaults may choose a different kind of value. `Timestamptz`, `Timestamp` and `Interval` become errors. ADR 257's rule keeps a renamed name for one release line as a deprecated alias; that rule is not applied before Prisma 8 reaches its release candidate, so every name changes at once and the upgrade instructions give the rewrite. A schema that wants today's meaning writes the explicit names (`TimestamptzTemporal`, `TimestampTemporal`, `DateTemporal`, `TimeTemporal`, `IntervalParts`), and its contract does not change.
- **Breaking for `contract print`,** which today writes `DateTime` for a `timestamptz` column read as a `Temporal.Instant`.
- **Upgraded Prisma 7 schemas read `Date` values instead of strings.** Their contracts change codec, so each database needs `prisma db sign` after the upgrade. A schema written by an earlier `contract infer` or `prisma orm init` keeps its explicit string types and its contract.
- **String values change form.** An application that reads a string date or time type gets ISO 8601 text instead of PostgreSQL's display text, for example `2024-01-01T00:00:00Z` instead of `2024-01-01 00:00:00+00`. The codec ids and the contract do not change.
- **Temporal fields are typed from `temporal-spec`,** a package of TypeScript declarations with no runtime code, instead of an undeclared global `Temporal`. A Temporal field is then never typed `any` in a project without the polyfill's global declarations, and no polyfill code reaches an application that does not opt into Temporal values. A missing global `Temporal` at runtime is still reported when a Temporal codec or generator first runs.
- **`Interval` reads the same object as before, under the name `IntervalParts`;** `Duration` reads an ISO string by default.
- ADR 254 says a type constructor names one codec and maps its arguments onto parameters. That stays true; a type choice is a second kind of type declaration that resolves to a type constructor.
- ADR 257 says the second codec of a stored type adds a suffix. Where a stored type has several codecs, every one now has a suffix, and the unsuffixed name of the concept belongs to a convenience type.
- ADR 275's `String` and `JsDate` variants of the contributed `temporal.*` aliases are not built.
- The planned rename of the PostgreSQL and SQLite types, which applies ADR 257 to those targets (for example `Int` to `Int4`), keeps `DateTime` as the convenience type instead of removing it, and adds the renames in item 6.
- The editor's hover text gives each convenience type's `value` and `column` choices and the explicit type each combination becomes, and completion inserts the bare name, which writes the defaults.

## Not decided here

- SQLite and MongoDB. Each declares its own convenience types over its own explicit types, under item 11, and each already uses one of the names: SQLite's explicit `DateTime` is its `sqlite/datetime@1` type, and MongoDB's explicit `Date` is `mongo/date@1`, a moment in time, with `DateTime` as a deprecated alias of it.
- Whether other scalar types get convenience types, for example an `Int` whose arguments choose between the explicit `Int2`, `Int4` and `Int8`.

## Alternatives considered

**Name every type after the application's meaning, with no explicit types.** Every field would be written `DateTime`, `Date` or `Time` and refined by arguments, and the database-named types would go. This reverses ADR 257, and leaves arguments as the only way to state a column type exactly. Two layers keep the database-named types as the precise form and add the short form on top.

**One codec for `DateTime`, with the column type as a parameter.** A codec converts values of exactly one data type, and a column stores the data type its codec represents (ADR 254). A codec whose data type depends on a parameter breaks both rules. Choosing among existing codecs in the type constructor gives the same schema syntax without changing codecs.

**A type constructor whose codec is chosen by a select template over option arguments** (the field-preset machinery of ADR 246). A select has no default case and no way to refuse a combination, so bare `DateTime` would resolve to no codec and `Time(value: temporal, column: timetz)` could not be refused; and the machinery is being removed with the presets. A type choice that names explicit constructors has defaults and refusals by construction.

**Convenience types as contributed type aliases with arguments.** A type alias attaches attributes such as `@onCreate` to one fixed type (ADR 275). Choosing which type is what a type constructor does, and a type constructor already takes arguments.

**Keep only the explicit types and document which to choose.** This adds nothing to learn, but the schema offers no default, so every user must understand every choice before writing a first field.

**Keep `Timestamptz` and `Timestamp` unsuffixed and rename only `Date` and `Time`.** It changes fewer names, but `Timestamptz` would remain an unmarked name for one particular kind of value while its neighbours `Date` and `Time` become convenience types, and the explicit types would follow two naming patterns.

**Name the convenience types after the `Temporal` API: `Instant`, `PlainDate`, `PlainTime`.** The names would say exactly what value the application reads, but they are a library's vocabulary. A user modelling an application thinks "a birthday" or "when the order was paid", and the mapping from `Date` to a calendar date is obvious without it.

**A Prisma-owned value for calendar dates, times of day and durations, or a branded string type.** A class would be one more date API to learn and convert from, would not survive a trip through JSON, and would be redundant once runtimes ship `Temporal`. A branded string (`string & { __brand }`) makes every write that starts from a plain string, which is almost every write, go through a helper or a cast, to catch a mistake the codec already reports when the value is written. Plain ISO 8601 strings, validated by the codec, have neither cost.
