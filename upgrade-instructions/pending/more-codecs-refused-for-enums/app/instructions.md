---
changes:
  - id: more-codecs-refused-for-enums
    summary: |
      An enum typed by `pg/jsonb@1`, `pg/timetz@1`, `pg/enum@1`, `arktype/json@1`, `pg/vector@1` or `pg/geometry@1` is now refused: `defineContract` from the Postgres package refuses its `enumType` with `CONTRACT.ENUM_INVALID`, and PSL refuses its `@@type` with `PSL_EXTENSION_INVALID_VALUE`. A jsonb enum's CHECK constraint failed to apply: it lists a string member as text PostgreSQL reads as JSON, and a number member as a number it cannot compare with `jsonb`. A query reads a timetz value as the text PostgreSQL prints, such as "12:34:56+02", so a value read back did not equal a member stored as "12:34:56+02:00". A `pg/enum@1` codec types a native enum's column; declare a native enum instead. Replace any other refused enum with a text enum.
    detection:
      glob: "**/*.{prisma,ts,tsx,mts,cts}"
      matches:
        - '@@type\(\s*"(?:pg/(?:jsonb|timetz|enum|vector|geometry)|arktype/json)@1"\s*\)'
        - '(?<![\s\S])(?![\s\S]*GENERATED FILE - DO NOT EDIT)(?=[\s\S]*\benumType\()[\s\S]*?(?:[''"`](?:pg/(?:jsonb|timetz|enum|vector|geometry)|arktype/json)@1[''"`]|\b(?:timetzColumn|jsonbColumn|arktypeJson|geometryColumn)\b|\b(?:vector|geometry)\()'
  - id: enum-columns-typed-by-member-literals
    summary: |
      A column typed by an enum whose codec is `pg/uuid@1`, `pg/inet@1`, `pg/numeric@1`, `pg/bit@1`, `pg/varbit@1`, `pg/date-string@1`, `pg/time-string@1`, `sql/char@1`, `sql/varchar@1`, `sql/text@1`, `sql/int@1` or `sql/float@1` on Postgres, or `sqlite/text@1`, `sqlite/integer@1`, `sqlite/real@1`, `sqlite/bigint@1`, `sqlite/json@1`, `sql/char@1`, `sql/varchar@1`, `sql/int@1` or `sql/float@1` on SQLite, is now typed in the emitted `contract.d.ts` as the union of its members' values, as a `pg/text@1` or `pg/int4@1` enum column already was, instead of the codec's whole type. Re-emit the contract. Code that writes a value that is not a member to such a column, or compares a value read from it with one, no longer typechecks; use a member, such as `client.enums.Host.members.Loopback`.
---

## `more-codecs-refused-for-enums`

`defineContract` refuses an enum typed by one of these codecs, for example:

```text
CONTRACT.ENUM_INVALID: enumType("Payload"): an enum cannot use the codec pg/jsonb@1. A CHECK lists a string member as SQL text, which PostgreSQL reads as the JSON text of a document rather than as a string, and a number member as a number, which PostgreSQL cannot compare with jsonb, so no CHECK can compare a value with the members. No enum can use a jsonb codec; use a text enum instead.
```

PSL refuses an enum block with `@@type` naming one of these codecs with the same reason, as `PSL_EXTENSION_INVALID_VALUE`.

1. For a `pg/enum@1` enum, declare a native enum: a `native_enum` block in PSL, or `nativeEnum` in TypeScript.
2. For any other refused enum, type it with `pg/text@1`: change the `@@type` in PSL, or pass `{ codecId: 'pg/text@1' }` (or `textColumn`) to `enumType` in TypeScript. Write each member as text.
3. Re-emit the contract. The enum's columns change type, and with them the storage hash. Plan and apply a migration, which changes each column's type.

The TypeScript detection matches a file that calls `enumType(` and names one of these codecs or their column helpers anywhere, even on a column that is not an enum. Check only the enums.

## `enum-columns-typed-by-member-literals`

Re-emit the contract. Then typecheck the project. Where a write to an enum column, or a comparison with a value read from one, no longer typechecks, the value is not a member; use a member instead. A test that writes a non-member on purpose, to see the CHECK constraint refuse it, can write that value `as never`.
