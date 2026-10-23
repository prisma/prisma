# ADR 279 — Convenience date and time types choose an explicit type from their arguments

**Status:** Accepted
**Builds on:** [ADR 241 — Scalar types use the authoring type-constructor channel](ADR%20241%20-%20Scalar%20types%20use%20the%20authoring%20type-constructor%20channel.md), [ADR 254 — Data types and casts](ADR%20254%20-%20Data%20types%20and%20casts.md), [ADR 257 — Scalar types are named after the target on every surface](ADR%20257%20-%20Scalar%20types%20are%20named%20after%20the%20target%20on%20every%20surface.md)
**Amends:** [ADR 275 — Client generators are field attributes, and a type alias is expanded into each column](ADR%20275%20-%20Client%20generators%20are%20field%20attributes%2C%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md)

## At a glance

```prisma
model Order {
  id        Int      @id
  paidAt    DateTime                     // timestamptz(3), read as a JavaScript Date
  shipBy    Date                         // date, read as "2024-02-29"
  opensAt   Time                         // time, read as "09:30:00"
  period    Duration                     // interval, read as "P1M"
  settledAt DateTime(value: temporal)    // timestamptz, read as a Temporal.Instant
  legacyAt  DateTime(column: timestamp)  // timestamp(3), read as a Date stored as UTC
  exactAt   TimestamptzTemporal(6)       // the explicit type, written directly
}
```

`DateTime`, `Date`, `Time` and `Duration` are **convenience types**. Each is named for what a field means in the application, and each becomes exactly one **explicit type**, the database-named type that fixes the column type and the value the application reads. Written bare, a convenience type takes defaults that work on any JavaScript runtime with no setup. Its optional arguments choose any other explicit type. The contract records only the explicit type: `settledAt` is stored exactly as `settledAt TimestamptzTemporal` would be.

## Decision

1. **Date and time types have two layers.** The explicit types are named after the database, as ADR 257 requires. Each one uses a single codec, so it fixes both the column type and the value the application reads. The convenience types are named after the application concept, and each one becomes exactly one explicit type.
2. **A convenience type is a type choice.** It is a declaration with:
   - option arguments, each with a fixed set of values and a default;
   - arguments it passes on to the chosen type, such as `precision`;
   - a table from each allowed combination of option values to the name of an explicit type.

   A combination the table does not list is refused.
3. **The contract stores only the explicit type.** A schema written with convenience types and the same schema written with the explicit types they become give the same contract and the same hashes.
4. **The defaults need no setup.** On PostgreSQL:
   - `DateTime` defaults to a `timestamptz(3)` column read as a JavaScript `Date`.
   - `Date`, `Time` and `Duration` default to ISO 8601 strings.

   No default needs a global `Temporal`.
5. **The tools write the convenience types.** `contract infer`, `contract print`, the Prisma 7 schema reader and `prisma orm init` write each date or time column as the convenience call that becomes its explicit type. They write only the arguments that differ from the defaults. An explicit type is written only for a column that no convenience call reaches.

## Why

In Prisma 7, every date or time field is `DateTime`, and the application always reads a JavaScript `Date`. A `@db.*` attribute changes the column type and nothing else. That is easy to learn. But a `Date` is a moment in time, so it is the wrong value for a calendar date or a time of day. A birthday created at local midnight on a machine east of UTC is stored as the day before.

Prisma 8's explicit types make each choice visible instead. A `date` column can be read as a `Temporal.PlainDate` (`DateTemporal`) or as a string (`DateString`), and each is correct for what it is. The cost is that every name fixes two things at once: the column type and the kind of value. So a column type with three kinds of value has three names, and across PostgreSQL's date and time column types there are more than a dozen. Nothing says which one to start with. To choose, a user must already know the difference between `timestamp` and `timestamptz`, what each Temporal type means, and what each kind of value costs. A user writing a model thinks "this field is when the order was paid", not "this is a `timestamptz` column read as a `Temporal.Instant`".

Prisma 8's approach is to give users explicit, predictable controls first, then make common cases easy by building convenience APIs on top. The client facades are an example. `postgres({ contract, url })` builds the runtime, adapter and driver that a user could otherwise create and connect by hand. The convenience types do the same for dates and times. There is one name per concept, with a default that works, and every explicit choice stays available as an argument or as the explicit type itself.

## How it works

### The explicit layer

An explicit type is a type constructor. It names one codec and maps its arguments onto that codec's parameters:

```ts
TimestamptzTemporal: {
  kind: 'typeConstructor',
  args: [{ kind: 'value', dataType: PG_SIZE_TYPE, name: 'precision', optional: true }],
  output: {
    codecId: 'pg/timestamptz-temporal@1',
    typeParams: { precision: { kind: 'arg', index: 0 } },
  },
},
```

When a column type has more than one codec, every explicit type for it carries a suffix naming its kind of value. No name looks like the neutral default:

| Column | `Date` | `Temporal` | String | Other |
| --- | --- | --- | --- | --- |
| `timestamptz` | `TimestamptzJsDate` | `TimestamptzTemporal` (`Temporal.Instant`) | `TimestamptzString` | |
| `timestamp` | `TimestampJsDate` | `TimestampTemporal` (`Temporal.PlainDateTime`), `TimestampInstant` (`Temporal.Instant`) | `TimestampString` | |
| `date` | | `DateTemporal` (`Temporal.PlainDate`) | `DateString` | |
| `time` | | `TimeTemporal` (`Temporal.PlainTime`) | `TimeString` | |
| `timetz` | | | `Timetz` | |
| `interval` | | | `IntervalString` (an ISO 8601 duration) | `IntervalParts` (`{ months, days, micros }`) |

`TimestampJsDate` and `TimestampInstant` read and write a `timestamp` column as UTC. This lets a `timestamp` column, the column Prisma 7's `DateTime` creates, hold the same moment-in-time value as a `timestamptz` column. `TimestampInstant` names its Temporal type instead of taking the `Temporal` suffix, because the `timestamp` column has two Temporal codecs.

### A type choice names its explicit types

A convenience type is a second kind of declaration in the same namespace, a type choice. It names no codec. It declares its arguments and a table whose rows each name an explicit type:

```ts
DateTime: {
  kind: 'typeChoice',
  args: [
    { kind: 'option', name: 'value', values: ['jsDate', 'temporal', 'string'], default: 'jsDate', optional: true },
    { kind: 'option', name: 'column', values: ['timestamptz', 'timestamp'], default: 'timestamptz', optional: true },
    { kind: 'value', dataType: PG_SIZE_TYPE, name: 'precision', optional: true },
  ],
  choices: [
    { when: { value: 'jsDate', column: 'timestamptz' }, type: 'TimestamptzJsDate', defaults: { precision: 3 } },
    { when: { value: 'temporal', column: 'timestamptz' }, type: 'TimestamptzTemporal' },
    { when: { value: 'string', column: 'timestamptz' }, type: 'TimestamptzString' },
    { when: { value: 'jsDate', column: 'timestamp' }, type: 'TimestampJsDate', defaults: { precision: 3 } },
    { when: { value: 'temporal', column: 'timestamp' }, type: 'TimestampInstant' },
    { when: { value: 'string', column: 'timestamp' }, type: 'TimestampString' },
  ],
},
```

The value names repeat the explicit types' suffixes, so `DateTime(value: jsDate)` and `TimestamptzJsDate` read as the same thing. The PostgreSQL target declares four type choices:

| Convenience type | `value` | `column` | Default |
| --- | --- | --- | --- |
| `DateTime` | `jsDate`, `temporal`, `string` | `timestamptz`, `timestamp` | `jsDate`, `timestamptz`, precision 3 |
| `Date` | `string`, `temporal` | `date` | `string` |
| `Time` | `string`, `temporal` | `time`, `timetz` (with `string` only) | `string`, `time` |
| `Duration` | `string`, `parts` | `interval` | `string` |

Resolving a call takes four steps:
1. Fill in the default for every option the call leaves out.
2. Look up the table row for the resulting combination of values.
3. Instantiate the explicit type that row names, passing on the other arguments. A row default stands in for an argument the call leaves out.
4. The result is exactly what writing that explicit type would give.

Every argument is optional, so a bare `DateTime` is its default row. Arguments are written by name or in declaration order. Because `value` comes first, `Time(3)` reads `3` as the `value` option, and the refusal says to write `Time(precision: 3)`.

A call is refused at the argument that makes it invalid, and the message lists what that argument accepts. That covers:
- a value an option does not list, such as `Date(value: jsDate)`;
- a combination with no row, such as `Time(value: temporal, column: timetz)`;
- a passed-on argument the chosen type does not take, such as `Date(precision: 3)`.

Assembly refuses a type choice that:
- names a constructor not registered beside it;
- has two rows for one combination;
- lists a value or default its option does not declare;
- gives a row default for an argument the chosen constructor does not take;
- passes on an argument whose data type differs from the chosen constructor's.

### Every reader uses the type the call chooses

Every place that needs a field's codec resolves the field's call first, including through a `types {}` alias, so it sees the explicit type's codec:
- the PSL interpreter, which builds the column;
- the `@default` value check;
- the `@onCreate`/`@onUpdate` generator lookup;
- the Prisma 7 reader;
- the MongoDB reader;
- the language server.

`DateTime @onCreate(now())` therefore gets the generator for `TimestamptzJsDate`, and `DateTime(value: temporal) @onCreate(now())` gets the one for `TimestamptzTemporal`.

In a TypeScript contract, `type.DateTime(...)`, `type.Date(...)`, `type.Time(...)` and `type.Duration(...)` take the same arguments in the same order. Each has one overload per row, so a call is typed as the explicit type it chooses, and a combination with no row does not compile.

### The values the defaults read

The defaults are chosen so that the value is right for the concept and needs nothing installed:
- **`DateTime` reads a JavaScript `Date`.** That is the right value for a moment in time, it works everywhere, and it is what Prisma 7 gave. A `Date` holds milliseconds, so the default precision is 3. A user who needs microseconds writes `DateTime(value: temporal)` or `DateTime(value: string)`.
- **`Date`, `Time` and `Duration` read plain ISO 8601 strings.** JavaScript has no built-in calendar date, time of day or duration. A `Date` would bring back the wrong-day bug, and a class or branded string owned by Prisma would add friction without catching anything the codec doesn't.

A string is the ISO 8601 form its data type stores (ADR 254, "Date and time types"). It reads the same on every server, and a value written in that form reads back unchanged:
- The `timestamptz` codec converts any session time zone offset to UTC.
- The `timetz` codec keeps the offset stored with the value.
- `IntervalString` reads every `IntervalStyle` PostgreSQL prints.

Reading dates and times as ISO text needs `DateStyle=ISO`. The PostgreSQL target declares that requirement, and the PostgreSQL driver ensures every connection it hands to the runtime meets it. How the driver does that is its own concern. A codec that still reads text in another style refuses it, with an error that names the setting.

The Temporal codecs take their TypeScript types from `temporal-spec`, a package of declarations with no runtime code. A Temporal field is then typed precisely in a project that has no global `Temporal` declarations. No polyfill reaches an application that does not choose a Temporal value.

### What the tools write

`contract infer` reads a database, and `contract print` reads a contract. Neither has a record of which layer the user wrote. Both take the well-trodden path wherever it reaches the column: they write the convenience type's default, with only the arguments that differ from its defaults. The table shows what they write; the last row is the explicit fallback.

| Column | Written as | Explicit type it becomes |
| --- | --- | --- |
| `timestamptz(3)` | `DateTime` | `TimestamptzJsDate(3)` |
| `timestamptz` (no declared precision) | `DateTime(precision: 6)` | `TimestamptzJsDate(6)` |
| `timestamp(3)` | `DateTime(column: timestamp)` | `TimestampJsDate(3)` |
| `date` | `Date` | `DateString` |
| `time(0)` | `Time(precision: 0)` | `TimeString(0)` |
| `timetz` | `Time(column: timetz)` | `Timetz` |
| `interval` | `Duration` | `IntervalString` |
| a `timestamp` read as `Temporal.PlainDateTime` | `TimestampTemporal` | `TimestampTemporal` |

**A missing precision.** PostgreSQL stores microseconds whether a precision of 6 is declared or omitted. So the date and time data types treat an omitted precision as 6 when comparing columns (their normal form, ADR 254). A column with no declared precision is written as `DateTime(precision: 6)`, and `db verify` and the migration planner see no difference.

**Type marks and arguments.** Each data type marks one explicit type `inferred`: the type its convenience default becomes. To write the convenience call, the tools find the row that names that explicit type, build its arguments from the row, and drop those equal to the defaults. They then check that the call resolves back to the same codec and parameters. Arguments are always written by name.

**The Prisma 7 schema reader** follows the same marks:

| Prisma 7 field | Explicit type |
| --- | --- |
| `DateTime` | `TimestampJsDate(3)` (a `timestamp(3)` column, read as a `Date`, as Prisma 7 read it) |
| `@db.Timestamptz(p)` | `TimestamptzJsDate(p)` |
| `@db.Date` | `DateString` |
| `@db.Time(p)` | `TimeString(p)` |
| `@db.Timetz(p)` | `Timetz(p)` |

**`prisma orm init`** writes `DateTime` for the timestamps of a new project.

### Combinations left out

- **A JavaScript `Date` for a calendar date or a time of day.** A calendar date stored through a moment in time depends on the time zone of the machine that made it.
- **`Temporal.PlainTime` on a `timetz` column.** It would drop the stored UTC offset.
- **`Temporal.PlainDateTime`.** This is a date and a time with no time zone, which is rarely what an application means ("9am wherever the user is"). It stays available as the explicit type `TimestampTemporal`. `DateTime(value: temporal, column: timestamp)` reads a `Temporal.Instant` instead.

### Created-at and updated-at

The PostgreSQL target ships two ready-made type aliases (ADR 275):
- `temporal.CreatedAt` is `DateTime @onCreate(now())`.
- `temporal.UpdatedAt` is `DateTime @onCreate(now()) @onUpdate(now())`.

Both are the default `TimestamptzJsDate(3)`. A contributed alias takes no arguments, so a user who wants another kind of value writes the attributes on the convenience call, for example `DateTime(value: string) @onCreate(now()) @onUpdate(now())`, or declares their own alias with that line. `now()` picks its generator from the field's final codec, so it always writes the value that codec expects.

## Consequences

- A user can write `DateTime`, `Date`, `Time` or `Duration` without knowing PostgreSQL's column types or the Temporal API, and get a working field. A user who needs a specific column type or kind of value says so with an argument, or writes the explicit type.
- The contract, the migration planner, `db verify` and the runtime see only explicit types, and nothing below the PSL and TypeScript surfaces changes.
- A schema the tools write reads like one a user would write.
- A type constructor still names one codec, as ADR 254 says. A type choice is a second kind of type declaration that resolves to a type constructor.
- ADR 257's suffix rule applies to every codec of a column type that has several. The unsuffixed name of a concept belongs to a convenience type.
- ADR 275's contributed `temporal.*` aliases are built on `DateTime`, and need no variants for other kinds of value.
- The editor's hover lists each convenience type's choices and the explicit type each combination becomes.

## Not decided here

- **SQLite, MySQL and MongoDB.** A convenience name must mean the same thing on every target. Each of these targets declares its own type choices over its own explicit types, and each already uses one of the names for an explicit type:
  - SQLite's `DateTime` is `sqlite/datetime@1`.
  - MySQL's `DateTime` is a `datetime(3)` column read as a `Date`.
  - MongoDB's `Date` is `mongo/date@1`, a moment in time. MongoDB's explicit `Date` therefore needs another name before a convenience `Date` can mean a calendar date there.
- **Whether other scalar types get convenience types,** for example an `Int` whose arguments choose between `Int2`, `Int4` and `Int8`.

## Alternatives considered

**Name every type after the application's meaning, with no explicit types.** Every field would be written `DateTime`, `Date` or `Time` and refined by arguments, and the database-named types would go. That reverses ADR 257 and leaves arguments as the only way to state a column type exactly. Two layers keep the database-named types as the precise form and put the short form on top.

**One codec for `DateTime`, with the column type as a parameter.** A codec converts values of exactly one data type, and a column stores the data type its codec represents (ADR 254). A codec whose data type depends on a parameter breaks both rules. Choosing among existing codecs gives the same schema without changing codecs.

**A type constructor whose codec is a select template over option arguments** (ADR 246). A select picks a value by case, but it has no default case and no way to refuse a combination. A bare `DateTime` would resolve to no codec, and `Time(value: temporal, column: timetz)` could not be refused. A type choice that names explicit types has defaults and refusals by construction.

**Convenience types as contributed type aliases with arguments.** A type alias attaches attributes such as `@onCreate` to one fixed type (ADR 275). Choosing which type a field has is a different job.

**Keep only the explicit types and document which to choose.** It adds nothing to learn, but the schema offers no default, so every user must understand every choice before writing their first field.

**Leave the Temporal-valued explicit types unsuffixed.** That changes fewer names, but `Timestamptz` would look like the neutral choice when it reads one particular kind of value. The explicit types would also follow two naming patterns.

**Name the convenience types after the Temporal API: `Instant`, `PlainDate`, `PlainTime`.** The names would say exactly what the application reads, but they are a library's vocabulary. A user modelling an application thinks "a birthday" or "when the order was paid".

**A Prisma-owned value for calendar dates, times and durations, or a branded string type.** A class is one more date API to learn and convert from. It does not survive a trip through JSON, and becomes redundant once runtimes ship Temporal. A branded string forces every write, which almost always starts from a plain string, through a helper or a cast. It catches nothing the codec doesn't already refuse when the value is written.

**Infer the lossless string types for columns a `Date` cannot hold exactly.** The string types never lose a digit, but the inferred schema would then differ from what a user writing the same model would write. Infer takes the default instead, and the docs say how to keep microseconds.
