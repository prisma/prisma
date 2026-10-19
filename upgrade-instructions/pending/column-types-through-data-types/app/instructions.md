---
changes:
  - id: db-schema-json-names-type-text
    summary: |
      `prisma db schema --json` names each column's type field `typeText` instead of `nativeType`, holding the type exactly as the database reports it (`integer`, `timestamp(3) with time zone`), and no longer has `resolvedNativeType`. The tree output of `prisma db schema` shows the type the database reports too, such as `integer` where it showed `int4`.
    detection:
      glob: "**/*.{ts,mts,cts,js,mjs,cjs,sh,json}"
      matches:
        - '(?<![\s\S])(?=[\s\S]*\bdb schema\b)[\s\S]*\bnativeType\b'
---

## `db-schema-json-names-type-text`

A script that reads column types from `prisma db schema --json` reads `typeText`:

```sh
# Before
prisma db schema --json | jq '.schema.tables[].columns[].nativeType'

# After
prisma db schema --json | jq '.schema.tables[].columns[].typeText'
```

The value is the type as the database reports it, so compare it with what the database prints (`integer`, `character varying(20)`), not with the short names (`int4`, `varchar(20)`) earlier releases printed.
