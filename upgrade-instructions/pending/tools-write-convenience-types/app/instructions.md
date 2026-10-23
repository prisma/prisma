---
changes:
  - id: prisma7-schema-reads-dates
    summary: |
      A contract from `prisma7Schema(...)` on PostgreSQL now reads a Prisma 7 `DateTime` field as a JavaScript `Date`, as Prisma 7 did, instead of a string: a plain `DateTime` is `TimestampJsDate(3)` and a `@db.Timestamptz(p)` field is `TimestamptzJsDate(p)`. The columns do not change, but the contract's codecs and storage hash do. Re-emit with `prisma contract emit`, run `prisma db sign`, and change application code that read those fields as strings to read a `Date`.
    detection:
      glob: "**/prisma.config.{ts,mts,cts,js,mjs}"
      matches:
        - '\bprisma7Schema\s*\('
  - id: temporal-type-aliases-on-datetime
    summary: |
      On PostgreSQL, `temporal.CreatedAt` and `temporal.UpdatedAt` are now built on `DateTime`, a `timestamptz(3)` column read as a JavaScript `Date`, instead of a `timestamptz` column read as a `Temporal.Instant`, and the `temporal.CreatedAtString`, `temporal.UpdatedAtString`, `temporal.CreatedAtJsDate` and `temporal.UpdatedAtJsDate` aliases are removed, in PSL and as `type.temporal.*()` in a TypeScript contract. Write the type and the generators instead, as the table in the body shows, to keep each field and its contract.
    detection:
      glob: "**/*.{prisma,ts,mts,cts,tsx}"
      matches:
        - '(?<![\w$])temporal\.(?:Created|Updated)At(?:String|JsDate)?(?![\w$])'
---

# The tools write the convenience date and time types

## `prisma7-schema-reads-dates`

`prisma7Schema(...)` reads each Prisma 7 date and time field as the type the convenience default gives for its column:

| Prisma 7 field | Prisma 8 type | The application reads |
| --- | --- | --- |
| `DateTime` | `TimestampJsDate(3)`, printed `DateTime(column: timestamp)` | a JavaScript `Date`, the stored value read as UTC |
| `@db.Timestamptz(p)` | `TimestamptzJsDate(p)`, printed `DateTime(precision: p)` | a JavaScript `Date` |
| `@db.Timestamp(p)` | `TimestampJsDate(p)` | a JavaScript `Date`, the stored value read as UTC |
| `@db.Date` | `DateString` | a string, unchanged |
| `@db.Time(p)` | `TimeString(p)` | a string, unchanged |
| `@db.Timetz(p)` | `Timetz(p)` | a string, unchanged |

Before this release the first three read strings, such as `2026-09-14 10:00:00.123`. `@updatedAt` and `@default(now())` now write a `Date` for these fields.

For each project whose `prisma.config.ts` uses `prisma7Schema(...)`:

1. Run `prisma contract emit` and commit the new `contract.json` and `contract.d.ts`. The storage hash changes, because the columns' codecs change; the columns themselves do not.
2. Run `prisma db sign` against each database, so its marker records the new contract. Commit the snapshot and the `db` ref it writes under `migrations/`, replacing the previous ones.
3. Change code that read a `DateTime` or `@db.Timestamptz` field as a string. It now gets a `Date`, and a write takes a `Date`:

   ```ts
   // before: user.updatedAt was "2026-09-14 10:00:00.123"
   console.log(user.updatedAt.replace(' ', 'T'));
   // after: user.updatedAt is a Date
   console.log(user.updatedAt.toISOString());
   ```

A `Date` holds milliseconds. A `@db.Timestamptz(6)` or `@db.Timestamp(6)` column with values that use the extra digits reads with them dropped. To keep them, write the Prisma 8 schema yourself with `DateTime(value: string)` or `DateTime(value: temporal)` for that field.

## `temporal-type-aliases-on-datetime`

`temporal.CreatedAt` is now `DateTime @onCreate(now())` and `temporal.UpdatedAt` is `DateTime @onCreate(now()) @onUpdate(now())`, a `timestamptz(3)` column read as a JavaScript `Date`. To keep each field exactly as it is, and its contract, write the type and the generators the alias stood for:

| Before | After, in PSL |
| --- | --- |
| `temporal.CreatedAt` | `TimestamptzTemporal @onCreate(now())` |
| `temporal.UpdatedAt` | `TimestamptzTemporal @onCreate(now()) @onUpdate(now())` |
| `temporal.CreatedAtString` | `TimestamptzString @onCreate(now())` |
| `temporal.UpdatedAtString` | `TimestamptzString @onCreate(now()) @onUpdate(now())` |
| `temporal.CreatedAtJsDate` | `TimestamptzJsDate @onCreate(now())` |
| `temporal.UpdatedAtJsDate` | `TimestamptzJsDate @onCreate(now()) @onUpdate(now())` |

In a TypeScript contract, `field.column(type.temporal.CreatedAtString())` becomes `field.column(type.TimestamptzString()).onCreate(gen.now())`, adding `.onUpdate(gen.now())` for an `UpdatedAt` alias, with `gen` taken from the `defineContract` callback beside `field` and `type`. Do the same for each alias in the table. Re-emit with `prisma contract emit`: the contract is the same as before.

To move a `temporal.CreatedAt` or `temporal.UpdatedAt` field to the new default instead, keep the alias and update the code that reads it to a `Date`. Its column becomes `timestamptz(3)`, which rounds stored values to milliseconds, so plan it with `prisma migration plan --delete <Model>.<field>` and apply it with `prisma db migrate`, or run `prisma db update --delete <Model>.<field>`.

The detection also matches `temporal.CreatedAt` and `temporal.UpdatedAt` in SQLite and MongoDB projects. There they keep their meaning and need no change.
