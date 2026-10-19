---
changes:
  - id: enum-jsonb-timetz-codecs-refused
    summary: |
      An enum typed by `pg/jsonb@1` or `pg/timetz@1` is now refused: `defineContract` from the Postgres package refuses its `enumType` with `CONTRACT.ENUM_INVALID`, and PSL refuses its `@@type` with `PSL_EXTENSION_INVALID_VALUE`. A jsonb enum's CHECK constraint lists each member as text that PostgreSQL reads as JSON, so a contract with one failed to apply. A query reads a timetz value as the text PostgreSQL prints, such as "12:34:56+02", so a value read back did not equal a member stored as "12:34:56+02:00". Replace either enum with a text enum.
    detection:
      glob: "**/*.{prisma,ts,tsx,mts,cts}"
      matches:
        - '@@type\(\s*"pg/(?:jsonb|timetz)@1"\s*\)'
        - '(?<![\s\S])(?![\s\S]*GENERATED FILE - DO NOT EDIT)(?=[\s\S]*\benumType\()[\s\S]*?(?:[''"]pg/(?:jsonb|timetz)@1[''"]|\b(?:PG_JSONB_CODEC_ID|PG_TIMETZ_CODEC_ID|jsonbColumn|pgJsonbColumn|pgTimetzColumn)\b)'
  - id: enum-columns-typed-by-member-literals
    summary: |
      A column typed by an enum whose codec is `pg/uuid@1`, `pg/inet@1`, `pg/numeric@1`, `pg/bit@1`, `pg/varbit@1`, `pg/date-string@1`, `pg/time-string@1`, `sql/char@1`, `sql/varchar@1`, `sql/text@1`, `sql/int@1` or `sql/float@1` on Postgres, or `sqlite/text@1`, `sqlite/integer@1`, `sqlite/real@1`, `sqlite/bigint@1`, `sqlite/json@1`, `sql/char@1`, `sql/varchar@1`, `sql/int@1` or `sql/float@1` on SQLite, is now typed in the emitted `contract.d.ts` as the union of its members' values, as a `pg/text@1` or `pg/int4@1` enum column already was, instead of the codec's whole type. Re-emit the contract. Code that writes a value that is not a member to such a column no longer typechecks; write a member, such as `client.enums.Host.members.Loopback`.
---

## `enum-jsonb-timetz-codecs-refused`

`defineContract` refuses an enum typed by `pg/jsonb@1` or `pg/timetz@1`:

```text
CONTRACT.ENUM_INVALID: enumType("Payload"): an enum cannot use the codec pg/jsonb@1. A CHECK lists each member as SQL text, which PostgreSQL reads as the JSON text of a document, while the contract stores a jsonb member as the document itself, so no CHECK can compare a value with the members. No enum can use a jsonb codec; use a text enum instead.
```

PSL refuses an enum block with `@@type("pg/jsonb@1")` or `@@type("pg/timetz@1")` with the same reason, as `PSL_EXTENSION_INVALID_VALUE`.

1. Type the enum with `pg/text@1`: change the `@@type` in PSL, or pass `{ codecId: 'pg/text@1' }` (or `textColumn`) to `enumType` in TypeScript. Write each member as text.
2. Re-emit the contract. The enum's columns change type, and with them the storage hash. Plan and apply a migration, which changes each column's type.

The TypeScript detection matches a file that calls `enumType(` and names one of these codecs anywhere, even on a column that is not an enum. Check only the enums.

## `enum-columns-typed-by-member-literals`

Re-emit the contract. Then typecheck the project. Where a write to an enum column no longer typechecks, the value written is not a member; write a member instead. A test that writes a non-member on purpose, to see the CHECK constraint refuse it, can write it `as never`.
