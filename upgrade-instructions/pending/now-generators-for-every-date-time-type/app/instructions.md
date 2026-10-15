---
changes:
  - id: string-timestamp-presets-write-text
    summary: |
      The `temporal.*String` presets on Postgres (`timestampString`, `timestamptzString`, `createdAtString`, `updatedAtString`), and every `@updatedAt` field a `prisma7Schema(...)` contract reads, now fill the column with text from a new generator instead of a `Date`. Re-emit the contract with `prisma contract emit`. Only the execution hash changes, so the database needs no migration and no `db sign`. The detection matches a schema or contract source that uses one of these presets or `@updatedAt`.
    detection:
      glob: "**/*.{prisma,ts,mts,cts}"
      matches:
        - 'temporal\.(?:timestamp|timestamptz|createdAt|updatedAt)String\('
        - '@updatedAt\b'
  - id: string-timestamp-codecs-take-text-only
    summary: |
      The Postgres `pg/timestamp-string@1` and `pg/timestamptz-string@1` codecs, behind `TimestampString(p)` and `TimestamptzString(p)`, no longer accept a `Date` when they encode. Code that writes a `Date` to such a column is now a type error. Write the text instead, such as `date.toISOString()`.
---

# Re-emit contracts that use a string timestamp preset

On Postgres, a field written `temporal.timestampString(3, onCreate: now, onUpdate: now)`, `temporal.updatedAtString()` or another `temporal.*String` preset is filled by a generator that writes text, such as `2024-01-02 03:04:05.678` or `2024-01-02 03:04:05.678+00`. Before, it was filled by `timestampNow`, which produced a `Date`. A Prisma 7 schema read through `prisma7Schema(...)` gets the same preset for each `@updatedAt` field.

The generator's id is in the execution section of `contract.json`, so the execution hash changes. Run `prisma contract emit` again and commit the new `contract.json` and `contract.d.ts`. The storage hash does not change, and the database marker holds only the storage and profile hashes, so there is no migration to plan and no need to run `prisma db sign`.

# A string timestamp column takes text, not a `Date`

`TimestampString(p)` and `TimestamptzString(p)` columns take and return text. Their codecs also accepted a `Date` on encode; that is removed. Code that passes a `Date` for such a column no longer compiles:

```ts
// Before
await db.orm.public.Post.create({ title: 'Hello', publishedAt: new Date() });

// After
await db.orm.public.Post.create({ title: 'Hello', publishedAt: new Date().toISOString() });
```

To work with `Date` values, use a `TimestamptzJsDate(p)` column (`temporal.timestamptzJsDate(...)` as a preset) instead.
