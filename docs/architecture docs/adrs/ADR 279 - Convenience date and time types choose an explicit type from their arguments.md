# ADR 279 — Convenience date and time types choose an explicit type from their arguments

**Status:** Proposed
**Builds on:** [ADR 241 — Scalar types use the authoring type-constructor channel](ADR%20241%20-%20Scalar%20types%20use%20the%20authoring%20type-constructor%20channel.md)
**Amends:** [ADR 254 — Data types and casts](ADR%20254%20-%20Data%20types%20and%20casts.md), [ADR 257 — Scalar types are named after the target on every surface](ADR%20257%20-%20Scalar%20types%20are%20named%20after%20the%20target%20on%20every%20surface.md), [ADR 275 — Client generators are field attributes, and a type alias is expanded into each column](ADR%20275%20-%20Client%20generators%20are%20field%20attributes%2C%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md)
**Brings back:** [ADR 246 — Option arguments and select templates for authoring helpers](ADR%20246%20-%20Option%20arguments%20and%20select%20templates%20for%20authoring%20helpers.md), which ADR 275 supersedes, for type constructors only

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
3. **A convenience type is a type constructor whose arguments choose its codec.** A type constructor is how PSL defines a type name that can take arguments, such as `Timestamptz(3)`. Today each one always uses the same codec. A type constructor may now choose its codec from its arguments.
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

7. **Three codecs are added:** a `timestamp` column read as a JavaScript `Date`, and a `timestamp` column read as a `Temporal.Instant`, both reading and writing the stored value as UTC; and an `interval` column read as an ISO 8601 duration string. `DateTime(column: timestamp)` with `value: jsDate` or `value: temporal`, and `Duration` with `value: string`, use them.
8. **The Prisma 7 reader maps Prisma 7's `DateTime` to a `timestamp(3)` column read as a JavaScript `Date`,** the new codec, instead of a string. A Prisma 7 `DateTime` is a `timestamp(3)` column read as a `Date`, so an upgraded application keeps the values its code was written for.
9. **A string value is ISO 8601, the same on every server.** Every string codec of a date or time type returns the form its data type stores (see ADR 254, "Date and time types"), whatever the database session's `TimeZone` and `DateStyle`, and reads that form back unchanged. PostgreSQL's display text, such as `2024-01-01 00:00:00+00` or a ` BC` year, never reaches the application.
10. **`contract infer` and `contract print` write convenience types,** with arguments only where they differ from the defaults. A column no convenience type covers, a `timestamp` read as `Temporal.PlainDateTime`, is written as its explicit type. `prisma orm init` writes `DateTime`.
11. **A convenience name means the same thing on every target.** This decision covers PostgreSQL. Another target adds convenience types under the same names, and renames any explicit type that already uses one of them for something else.

## Why

Prisma 8 gives users explicit, predictable controls first, then makes common cases easy by building convenience APIs on top of them. For example, the `postgres({ contract, url })` function builds the runtime, adapter and driver that a user could otherwise create and connect by hand. The date and time types have the explicit controls but nothing built on top of them.

In Prisma 7, every date or time field is `DateTime`, and the application always reads a JavaScript `Date`. A `@db.*` attribute changes the column type. A user who never learns those attributes still gets a working field. That was simple, but Prisma made the choice for the user, and for some fields it was wrong. A `Date` is a moment in time, not a calendar date: a birthday created at local midnight on a machine east of UTC is stored as the day before.

Prisma 8's explicit types fix that by making every choice visible. But each name fixes both the column type and the kind of value, so PostgreSQL has eleven date and time type names (`Timestamptz`, `TimestamptzJsDate`, `TimestamptzString`, `Timestamp`, `TimestampString`, `Date`, `DateString`, `Time`, `TimeString`, `Timetz`, and `DateTime` as a second name for `Timestamptz`). Prisma 8 does not say which one a new user should pick. To choose, a user must already know the difference between `timestamp` and `timestamptz`, what each `Temporal` type means, and how each kind of value behaves. A user writing a schema thinks "this field is when the order was paid", not "this is a `timestamptz` column read as a `Temporal.Instant`".

The convenience types give that user one name per concept, with defaults that work. Every explicit choice stays available, as an argument or as the explicit type itself.

## How it works

### A type constructor chooses its codec

A type constructor's output is an `AuthoringStorageTypeTemplate`: a `codecId`, and a `typeParams` template whose values may refer to the constructor's arguments. Today `codecId` is a plain string:

```ts
Timestamptz: {
  kind: 'typeConstructor',
  documentation: 'An instant represented as Temporal.Instant, with optional fractional-second precision.',
  args: [{ kind: 'number', name: 'precision', integer: true, optional: true }],
  output: {
    codecId: 'pg/timestamptz-temporal@1',
    typeParams: { precision: { kind: 'arg', index: 0 } },
  },
},
```

A convenience constructor's `codecId` is chosen by its `value` and `column` arguments. ADR 246 introduced the two pieces this needs, for the `temporal.*` field presets such as `temporal.timestamp(3, onCreate: now)`:

- an argument that takes one of a fixed set of bare names (`AuthoringOption`, `kind: 'option'`);
- a template value that picks one case by the value of such an argument (`AuthoringSelectRef`, `kind: 'select'`).

ADR 275 removes both together with the presets. This decision keeps them, for type constructors, and lets a `select` give a type constructor's `codecId`. That is more than a new case:

- `codecId` is typed `string` in `AuthoringStorageTypeTemplate`, and many places read it as a plain string: the control stack, the PSL column resolution, the attribute specs, the generator attributes, the inferred-constructor map, the Prisma 7 reader and the MongoDB interpreter. Each must resolve the template against the call's arguments first.
- The TypeScript contract builder works out a column's application type at compile time from its `codecId`. Its type-level resolver, `ResolveTemplateValue`, cannot evaluate a `select`; ADR 246 bars `select` from a preset's `codecId` for that reason. The resolver must learn to evaluate it, so that a convenience type written in a TypeScript contract gets an application type as precise as an explicit one. A TypeScript contract reaches the convenience types through the `type.*` helpers that ADR 275 gives every PSL type constructor.

A combination a convenience type does not list, such as `Date(value: jsDate)`, is an error. The PSL interpreter reports it at the argument when it reads the schema, and the message lists the choices the type accepts.

### What the contract and the tools see

The PSL interpreter resolves a convenience type to its explicit type's codec and parameters while it builds the contract, so the contract only ever holds the explicit type. The migration planner, `db verify` and the runtime read the contract and are unchanged.

`contract infer` and `contract print` write a schema from a database or a contract, where nothing records which layer the user wrote. They write the convenience type: the one whose choices reach the column's codec, with the `value:`, `column:` and `precision:` arguments that differ from its defaults. Each data type marks at most one type constructor `inferred` (ADR 254); a convenience type is the inferred constructor of every data type it reaches, and the explicit type is written only for a codec no convenience type reaches. The printer runs the text it writes back through the interpreter, as it does today, to prove it gives the same codec and parameters.

### Combinations left out

- A JavaScript `Date` for a calendar date or a time of day. A `Date` is a moment in time, so a calendar date stored through one depends on the time zone of the machine that made it. That is the Prisma 7 bug this layer must not bring back.
- `Temporal.PlainTime` on a `timetz` column, because it drops the stored UTC offset.
- `Temporal.PlainDateTime`, a date and a time with no time zone. It is rarely what an application means: a field that holds "9am wherever the user is". It stays available as the explicit type `TimestampTemporal`. `DateTime(value: temporal, column: timestamp)` reads a `Temporal.Instant`, treating the stored value as UTC.

### Created-at and updated-at

ADR 275 has the PostgreSQL target ship ready-made type aliases under `temporal`, such as `temporal.UpdatedAt`, built on `Timestamptz`, with `String` and `JsDate` variants for the other kinds of value. With this decision they are built on `DateTime` instead, for example `temporal.UpdatedAt = DateTime @onCreate(now()) @onUpdate(now())`, and use its defaults. `now()` picks its generator from the field's final codec, so it writes a `Date`, a `Temporal.Instant` or a string to match.

The `String` and `JsDate` variants are not needed. A contributed alias takes no arguments (ADR 275), so a user who wants another kind of value writes the attributes on the convenience type, `DateTime(value: string) @onCreate(now()) @onUpdate(now())`, or defines their own alias with that line.

## Consequences

- A user can write `DateTime`, `Date` or `Time` and get a working field without knowing PostgreSQL's column types or the `Temporal` API. A user who wants a specific column type or kind of value says so with an argument, or writes the explicit type.
- **Breaking for schemas that write `DateTime`, `Date` or `Time`.** Each name changes meaning from one explicit type to a convenience type, whose defaults may choose a different kind of value. ADR 257's rule for renaming keeps an old name for one release line as a deprecated alias of the new one. That is not possible here, because the old names are reused at once. A schema that wants today's meaning writes the new explicit names (`TimestamptzTemporal`, `DateTemporal`, `TimeTemporal`), and its contract does not change. `Timestamptz` and `Timestamp` follow ADR 257's rule, as deprecated aliases of `TimestamptzTemporal` and `TimestampTemporal` for one release line.
- **Breaking for `contract print`,** which today writes `DateTime` for a `timestamptz` column read as a `Temporal.Instant`.
- **Upgraded Prisma 7 schemas read `Date` values instead of strings.** Their contracts change codec, so each database needs `prisma db sign` after the upgrade. A schema written by an earlier `contract infer` or `prisma orm init` keeps its explicit string types and its contract.
- **String values change form.** An application that reads a string date or time type gets ISO 8601 text instead of PostgreSQL's display text, for example `2024-01-01T00:00:00Z` instead of `2024-01-01 00:00:00+00`. The codec ids and the contract do not change.
- **`Interval` reads the same object as before, under the name `IntervalParts`;** `Duration` reads an ISO string by default.
- ADR 254 says a type constructor names one codec and maps its arguments onto parameters. A type constructor may now also choose the codec.
- ADR 257 says the second codec of a stored type adds a suffix. Where a stored type has several codecs, every one now has a suffix, and the unsuffixed name of the concept belongs to a convenience type.
- ADR 275's removal of the `option` argument kind and the `select` template does not apply to type constructors. Its `String` and `JsDate` alias variants are not built.
- The planned rename of the PostgreSQL and SQLite types, which applies ADR 257 to those targets (for example `Int` to `Int4`), keeps `DateTime` as the convenience type instead of removing it, and adds the renames in item 6.
- The editor's completion offers each convenience type's `value` and `column` choices, and its hover text gives the explicit type each choice becomes.

## Not decided here

- SQLite and MongoDB. Each declares its own convenience types over its own explicit types, under item 11, and each already uses one of the names: SQLite's explicit `DateTime` is its `sqlite/datetime@1` type, and MongoDB's explicit `Date` is `mongo/date@1`, a moment in time, with `DateTime` as a deprecated alias of it.
- Whether other scalar types get convenience types, for example an `Int` whose arguments choose between the explicit `Int2`, `Int4` and `Int8`.

## Alternatives considered

**Name every type after the application's meaning, with no explicit types.** Every field would be written `DateTime`, `Date` or `Time` and refined by arguments, and the database-named types would go. This reverses ADR 257, and leaves arguments as the only way to state a column type exactly. Two layers keep the database-named types as the precise form and add the short form on top.

**One codec for `DateTime`, with the column type as a parameter.** A codec converts values of exactly one data type, and a column stores the data type its codec represents (ADR 254). A codec whose data type depends on a parameter breaks both rules. Choosing among existing codecs in the type constructor gives the same schema syntax without changing codecs.

**Convenience types as contributed type aliases with arguments.** A type alias attaches attributes such as `@onCreate` to one fixed type (ADR 275). Choosing which type is what a type constructor does, and a type constructor already takes arguments.

**Keep only the explicit types and document which to choose.** This adds nothing to learn, but the schema offers no default, so every user must understand every choice before writing a first field.

**Keep `Timestamptz` and `Timestamp` unsuffixed and rename only `Date` and `Time`.** It changes fewer names, but `Timestamptz` would remain an unmarked name for one particular kind of value while its neighbours `Date` and `Time` become convenience types, and the explicit types would follow two naming patterns.

**Name the convenience types after the `Temporal` API: `Instant`, `PlainDate`, `PlainTime`.** The names would say exactly what value the application reads, but they are a library's vocabulary. A user modelling an application thinks "a birthday" or "when the order was paid", and the mapping from `Date` to a calendar date is obvious without it.

**A Prisma-owned value for calendar dates, times of day and durations, or a branded string type.** A class would be one more date API to learn and convert from, would not survive a trip through JSON, and would be redundant once runtimes ship `Temporal`. A branded string (`string & { __brand }`) makes every write that starts from a plain string, which is almost every write, go through a helper or a cast, to catch a mistake the codec already reports when the value is written. Plain ISO 8601 strings, validated by the codec, have neither cost.
