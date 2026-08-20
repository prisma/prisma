# Porting a Prisma 7 schema: `Json` vs `Jsonb` on Postgres

In Prisma ORM (Prisma 7 and earlier), the `Json` scalar mapped to the Postgres `jsonb` column type. In Prisma 8 PSL, `Json` binds to the native `json` column type, and `jsonb` has its own scalar: `Jsonb`.

A `schema.prisma` copied from Prisma 7 therefore emits `json` columns where the original database had `jsonb`. If you meant `jsonb` — which every Prisma 7 `Json` field did — write `Jsonb`.

`contract emit` flags this: every bare `Json` field on the postgres target reports the advisory `PN_PSL_JSON_NATIVE_JSON`, batched into one summary when a schema has many such fields, and `db verify` confirms the resulting mismatch against the live database. The warning never fails the build; if a native `json` column is what you want, keep the `Json` spelling. A named-type alias (`types { Meta = Json }`) is treated as a deliberate single-site choice and does not warn.

SQLite and MongoDB `Json` bindings are unaffected. The TypeScript authoring surface (`field.json()`) already means `jsonb` and is unaffected.
