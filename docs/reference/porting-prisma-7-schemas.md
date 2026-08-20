# Porting a Prisma 7 schema: `Json` vs `Jsonb` on Postgres

In Prisma ORM (Prisma 7 and earlier), the `Json` scalar mapped to the Postgres `jsonb` column type. In Prisma 8 PSL, `Json` binds to the native `json` column type, and `jsonb` has its own scalar: `Jsonb`.

A `schema.prisma` copied from Prisma 7 therefore emits `json` columns where the original database had `jsonb`. Emit and check both pass; only `db verify` against the live database catches the mismatch. If you meant `jsonb` — which every Prisma 7 `Json` field did — write `Jsonb`.

`contract emit` warns about this: every bare `Json` field on the postgres target reports `PN_PSL_JSON_NATIVE_JSON`, batched into one summary when a schema has many such fields. The warning is advisory and never fails the build; if a native `json` column is what you want, keep the `Json` spelling.

SQLite and MongoDB `Json` bindings are unaffected. The TypeScript authoring surface (`field.json()`) already means `jsonb` and is unaffected.
