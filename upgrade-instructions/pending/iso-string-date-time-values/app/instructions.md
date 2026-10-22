---
changes:
  - id: iso-string-date-time-values
    summary: |
      The PostgreSQL text date and time types (`TimestamptzString`, `TimestampString`, `DateString`, `TimeString`, `Timetz`) read and write ISO 8601, the form the contract stores, instead of the text PostgreSQL prints. A `timestamptz` reads as the instant in UTC whatever the session's time zone, as in `2024-01-01T00:00:00Z`. A literal default or enum member on these types must be written in that form. Prisma sets `DateStyle=ISO` on the connections it opens; a `pg.Pool` or `pg.Client` passed to Prisma with another `DateStyle` fails reads with `RUNTIME.DATE_STYLE_NOT_ISO`.
    detection:
      glob: "**/*.{prisma,ts,tsx,mts,cts,js,mjs,cjs}"
      matches:
        - '(?<![\w$])(?:TimestamptzString|TimestampString|DateString|TimeString|Timetz)(?![\w$])'
        - '(?<![\w$])(?:timestamptzStringColumn|timestampStringColumn|dateStringColumn|timeStringColumn|timetzColumn|createdAtString|updatedAtString)(?![\w$])'
        - 'pg/(?:timestamptz-string|timestamp-string|date-string|time-string|timetz)@1'
---

# Text date and time values are ISO 8601

A column of `TimestamptzString`, `TimestampString`, `DateString`, `TimeString` or `Timetz` used to read the text PostgreSQL prints, which depends on the session's `TimeZone` and `DateStyle`. It now reads ISO 8601, the same on every server:

| Type | Before | After |
| --- | --- | --- |
| `TimestamptzString` | `2024-01-01 01:00:00+01` on a server in `Europe/Berlin` | `2024-01-01T00:00:00Z` |
| `TimestampString` | `2024-01-01 12:34:56.5` | `2024-01-01T12:34:56.5` |
| `DateString`, 44 BC | `0044-03-15 BC` | `-000043-03-15` |
| `Timetz` | `12:34:56+02`, `12:34:56+00` | `12:34:56+02:00`, `12:34:56Z` |

The same text is read inside an `.include()`. `infinity` and `-infinity` are unchanged. The generated `now()` values of these columns, such as `temporal.updatedAtString()`, are written in the same form.

Change the code that reads these values:

- Code that parses the old text, for example by replacing the space with `T` or appending `Z` before `new Date(...)`, can pass the value to `new Date(...)` or `Temporal.Instant.from(...)` directly for a `TimestamptzString`. A `TimestampString` value has no offset; append `Z` to read it as UTC, as before.
- Code that compares a read value with text in the old form, in application code or in tests, compares with the ISO form.
- Code that shows a value to a user formats it for display, since the value is no longer in the session's time zone.

A value the application writes may still be in any form PostgreSQL reads, and it reads back in ISO 8601. A literal default or an enum member on these types must be written in the stored form, because Prisma compares it with the value a query returns:

```ts
// Before
scheduledAt: field.column(timestamptzStringColumn).default('2024-01-15 10:30:00+00'),

// After
scheduledAt: field.column(timestamptzStringColumn).default('2024-01-15T10:30:00Z'),
```

`contract emit` refuses a default in another form with `CONTRACT.DEFAULT_INVALID`, and the message shows the form to write. A PSL default written with a tag, such as `` @default(timestamptz`2024-01-15 10:30:00+00`) ``, is unchanged. An enum on `TimestampString`, `TimestamptzString` or `Timetz` is now allowed.

Prisma sets `DateStyle=ISO` as a startup option on every connection it opens from a URL. A `pg.Pool` or `pg.Client` you pass to Prisma keeps its own settings. If its `DateStyle` is not ISO, give it the option:

```ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c DateStyle=ISO' });
```

Without it, reading a date or timestamp fails with `RUNTIME.DATE_STYLE_NOT_ISO`. A connection pooler that refuses startup options needs `ALTER ROLE <role> SET DateStyle = 'ISO'` instead.
