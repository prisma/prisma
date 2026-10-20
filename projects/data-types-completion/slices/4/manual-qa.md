# Slice 4 manual QA

Run on 2026-10-19 against branch `tml-3387-verify-through-data-types` (merge `aa9fcbf984`), CLI built with `pnpm build` and run as `node_modules/.bin/prisma` from the repository root. Working projects and full logs are under `wip/s4/qa/` (gitignored). Databases: `postgres:17` and `postgis/postgis:17-3.5` containers, and a PGlite server from `@prisma/dev` (the repository's journey helper) for pgvector. Every command below was run with `--format human`; exit codes are the CLI's.

Comparisons with `bot/main` (`b4f3476021`, the merge base) used a temporary worktree at `wip/s4/qa/main`, installed and built, then removed.

## Summary

| Step | Verdict |
| --- | --- |
| 1. Postgres 17, every data type with a constructor | Pass |
| 1. pgvector (PGlite) | Pass for the type comparison; `db sign` after a raw `CREATE EXTENSION vector` leaves the pgvector space unverifiable (not this slice) |
| 2. SQLite | Pass; non-canonical spellings are reported as undeclared, same verdict as `bot/main` |
| 3. PostGIS | Pass for SRID drift; see the `spatial_ref_sys` note |
| 4. Committed examples | Pass for `prisma-8-demo`, `prisma-8-demo-sqlite`, `react-router-demo`, `prisma-8-cloudflare-worker`; `supabase` and `paradedb-demo` stop before verify, identically on `bot/main` |
| 5. `db schema` | Pass: database type names, JSON field `typeText` |

No defect in this slice's change was found. Findings that are older than this branch are listed at the end.

## 1. Postgres 17

Project: `wip/s4/qa/pg/` (`contract.prisma`, `schema.sql`, `prisma.config.ts` without extensions). The contract has one column for every Postgres constructor (`String`, `Boolean`, `Int`, `BigInt`, `Float`, `Decimal`, `DateTime`, `Json`, `Jsonb`, `Bytes`, `VarChar(20)`, `VarChar`, `Char`, `Char(5)`, `Numeric(10)`, `Numeric(10, 2)`, `Numeric`, `Timestamp`, `Timestamp(3)`, `Timestamptz`, `Timestamptz(3)`, `Time`, `Time(2)`, `Timetz`, `Uuid`, `Inet`, `SmallInt`, `Real`, `Date`, `DateString`, `TimestampString(6)`, `TimestamptzJsDate(3)`, `TimestamptzString`, `TimeString`, `Bit`, `Bit(8)`, `VarBit`, `VarBit(16)`, `Interval`, `Interval(3)`, `BigIntNumber`, `UnboundedInt`), a native enum `public.mood`, lists `String[]`, `Int[]`, `VarChar(10)[]`, `pg.enum(Mood)[]`, and a table in namespace `app` with enum `app.level`.

The tables were created by raw SQL with spellings Prisma does not write: `int`, `integer`, `int8`, `int2`, `float4`, `bool`, `double precision`, `decimal`, `decimal(10,2)`, `numeric(10,0)` for `Numeric(10)`, `character(1)` for `Char`, `char(5)`, `character varying(20)`, `timestamp without time zone`, `timestamp(3) with time zone`, `timestamptz(3)`, `time with time zone`, `bit varying`, `varbit(16)`, `bigint`, `public.mood[]`.

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `docker exec -i s4-qa-pg17 psql -v ON_ERROR_STOP=1 -U postgres < schema.sql` | tables created | 0 | |
| `prisma db verify --schema-only` | `✔ Database schema satisfies contract` | 0 | Pass |
| `prisma db verify --strict --schema-only` | `✔ Database schema satisfies contract` | 0 | Pass |
| `prisma db sign`, then `prisma db verify` | `✔ Database marker and schema match contract` | 0 | Pass |
| `prisma migration plan --name noop` | wrote a baseline from the `db` ref (empty migrations directory) | 0 | |
| `prisma migration plan --name noop2` | `✔ No changes detected` | 0 | Pass |
| `prisma db update --dry-run` (plans against the live database) | `✔ Planned 0 operation(s)` | 0 | Pass |

Change one column by raw SQL:

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `psql -c 'ALTER TABLE all_types ALTER COLUMN vc TYPE character varying(40)'` | | | |
| `prisma db verify` | `mismatch: database/public/all_types/column:vc. The contract column is "character varying(20)" and the database column is "character varying(40)".` | 4 | Pass: names exactly that column with the type the database reports |
| `prisma db update --dry-run` | one operation, `ALTER TABLE "public"."all_types" ALTER COLUMN "vc" TYPE character varying(20) USING "vc"::character varying(20);`, asks for `--delete public.AllTypes.vc` | 0 | Pass |
| `psql -c 'ALTER TABLE all_types ALTER COLUMN vc TYPE varchar(20)'`, `prisma db verify` | clean | 0 | |
| Enum drift: `ALTER TABLE app.thing ALTER COLUMN level TYPE app.tier USING 'gold'::app.tier`, `prisma db verify` | `mismatch: database/app/thing/column:level. The contract column is "app.level" and the database column is "app.tier".` | 4 | Pass (enum outside `public`) |

Type changes through `migration plan` and `db migrate` (the planner is offline, so the type change was made in the contract):

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| contract `vc VarChar(20)` → `VarChar(40)`, `i Int` → `BigInt`; `prisma contract emit`; `prisma migration plan --name widen` | two operations: `ALTER COLUMN "i" TYPE int8`, `ALTER COLUMN "vc" TYPE character varying(40)` | 0 | Pass |
| `prisma db migrate` | `✔ Applied 1 migration(s) (2 operation(s))`; postchecks `format_type(...) = 'bigint'` and `= 'character varying(40)'` passed | 0 | Pass |
| `prisma db verify --strict` | `✔ Database marker and schema match contract` | 0 | Pass |
| contract `tags String[]` → `VarChar(30)[]`; `prisma migration plan --name tags --from 20261019T1732_widen --delete public.AllTypes.tags` | drop element check, `ALTER COLUMN "tags" TYPE character varying(30)[]`, re-add check | 0 | Pass |
| `prisma db migrate`, `prisma db verify` | applied 3 operations; postcheck `character varying(30)[]` passed; verify clean | 0, 0 | Pass (list) |
| contract `s String` → `pg.enum(app.Tier)` plus new `app.thing.tier pg.enum(Tier)[]`; `migration plan --name enums --from 20261019T1733_tags --delete public.AllTypes.s`; `db migrate`; `db verify --strict` | applied 4 operations; enum postcheck is `atttypid = to_regtype('"app"."tier"')`; verify clean | 0, 0, 0 | Pass (enum in another schema, identity postcheck) |

A type no pack declares:

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `psql -c "CREATE EXTENSION hstore" -c "ALTER TABLE all_types ADD COLUMN pt point, ADD COLUMN hs hstore"`; contract adds `pt String?`, `hs String?`; `prisma db verify --schema-only` | `mismatch: database/public/all_types/column:hs. The database column is "hstore", which no data type in the configured stack declares.` and the same for `"point"` | 4 | Pass |
| `prisma db update --dry-run` | plans `ALTER COLUMN "hs" TYPE text`, `ALTER COLUMN "pt" TYPE text` | 0 | Pass |

### pgvector on PGlite

`postgres:17` has no pgvector, so this ran on a `@prisma/dev` PGlite server (`wip/s4/qa/vec/`, config with `extensions: [pgvector]`, contract `emb pgvector.Vector(3)`, `vc VarChar(20)`). Raw SQL: `CREATE EXTENSION vector; CREATE TABLE doc (id integer PRIMARY KEY, emb vector(3) NOT NULL, vc character varying(20) NOT NULL)`.

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `prisma db verify --schema-only` before any `migration plan` | `MIGRATION.CONTRACT_SPACE_LAYOUT_VIOLATION`, `[declaredButUnmigrated] pgvector` | 2 | Fails before verify: the pgvector space's migrations must be on disk |
| `prisma migration plan --name init` (writes `migrations/pgvector/`), then with `emb` raw-altered to `vector(4)`: `prisma db verify --schema-only` | `The contract column is "vector(3)" and the database column is "vector(4)".` | 4 | Pass |
| raw revert to `vector(3)`; `prisma db verify --schema-only --strict` | `✔ Database schema satisfies contract` | 0 | Pass |
| `prisma db sign`; `prisma db verify` | sign succeeds, then `MIGRATION.CONTRACT_SPACE_VIOLATION`: `[invariantsMismatch] pgvector: Re-apply the migrations ... so the marker carries invariants: pgvector:install-vector-v1` | 0, 4 | Not this slice: signing a database whose extension was created by hand leaves the extension space without its invariant (same class as adopting an existing PostGIS install) |

## 2. SQLite

Project: `wip/s4/qa/sq/`. Contract: `String`, `Int`, `BigInt`, `BigIntNumber`, `Float`, `Decimal`, `DateTime`, `Json`, `Bytes`. Prisma writes `INTEGER`, `TEXT`, `REAL`, `BLOB`.

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `sqlite3 qa.db < schema1.sql` with `Integer`, `Text`, `integer`, `InTeGeR`, `ReAl`, `text`, `TeXt`, `Blob` | | 0 | |
| `prisma db verify --schema-only --strict`; `db sign`; `db verify` | clean | 0, 0, 0 | Pass (mixed case) |
| `prisma db update --dry-run`; `migration plan` twice | `Planned 0 operation(s)`; second plan `✔ No changes detected` | 0 | Pass |
| `sqlite3 qa.db 'CREATE TABLE other (id INT PRIMARY KEY NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, big BIGINT NOT NULL, notype)'`, contract `Other { id Int, name String, qty Int, big BigInt, notype String? }`; `prisma db verify --schema-only` | five mismatches: `The database column is "int", which no data type in the configured stack declares.` (id, qty), `"bigint"`, `"varchar(255)"`, and `notype`: `The database column has no declared type, which no data type in the configured stack declares.` | 4 | Pass. `bot/main` reports the same five columns as mismatches, without the type. |
| `prisma db update --dry-run` | `Recreate table other` with `INTEGER`/`TEXT` columns, asks `--delete` per column | 0 | Same plan as `bot/main` |

## 3. PostGIS

`examples/prisma-8-postgis-demo` on `postgis/postgis:17-3.5` (`--platform linux/amd64`), `DATABASE_URL=postgres://postgres:pw@localhost:55418/postgres`.

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `prisma contract emit`; `prisma db init` | `✔ Applied 3 operation(s) across 2 contract spaces`; committed contract unchanged | 0, 0 | |
| `prisma db verify` | `✔ Database marker and schema match contract` | 0 | Pass |
| `prisma db verify --strict` | `Unclaimed elements: spatial_ref_sys` | 4 | Older than this branch (see below) |
| `psql -c 'ALTER TABLE cafe ALTER COLUMN location TYPE geometry(Geometry, 3857) USING ST_SetSRID(location, 3857)'`; `prisma db verify` | `mismatch: database/public/cafe/column:location. The contract column is "geometry(Geometry,4326)" and the database column is "geometry(Geometry,3857)".` | 4 | Pass |
| `prisma db update --dry-run` | `ALTER COLUMN "location" TYPE geometry(Geometry,4326)` plus `DROP TABLE "public"."spatial_ref_sys"` | 0 | Type change pass; drop is older (below) |
| raw `ALTER TABLE route ALTER COLUMN path TYPE geometry(LineString, 4326)`; `prisma db verify` | `The database column is "geometry(LineString,4326)", which no data type in the configured stack declares.` | 4 | Correct (the pack declares only `geometry(Geometry,<srid>)`), but the wording can surprise a PostGIS user |

## 4. Committed examples

Each example: `prisma contract emit` (no committed file changed), `prisma db init --db <url> --yes`, `prisma db verify`. Logs: `wip/s4/qa/ex-*.log`.

| Example | Database | Result | Verdict |
| --- | --- | --- | --- |
| `prisma-8-demo` | PGlite (`@prisma/dev`, has pgvector) | init applied 21 operations across 2 spaces; `✔ Database marker and schema match contract` | Pass |
| `prisma-8-demo-sqlite` | file `wip/s4/qa/sqlite-demo.db` | init applied 7 operations; `SQLITE_PATH=... prisma db verify --strict` clean | Pass |
| `react-router-demo` | postgres:17 | init 4 operations; verify clean | Pass |
| `prisma-8-cloudflare-worker` | postgres:17 | init 11 operations; verify clean, also after `CREATE EXTENSION pg_stat_statements` (its `db:init` script) | Pass |
| `supabase` | postgres:17 | `db init` and `db verify --schema-only`: `MIGRATION.CONTRACT_SPACE_LAYOUT_VIOLATION`, `[declaredButUnmigrated] supabase` | Stops before verify. Identical on `bot/main`: older than this branch |
| `paradedb-demo` | postgres:17 (no ParadeDB image locally) | same error, `[declaredButUnmigrated] paradedb` | Stops before verify. Identical on `bot/main`: older than this branch |

Neither `supabase` nor `paradedb-demo` commits a `migrations/` directory, and both declare an extension with its own contract space.

## 5. `db schema`

| Command | Output that matters | Exit | Verdict |
| --- | --- | --- | --- |
| `prisma db schema` on the Postgres QA database | `vc: character varying(40)`, `ch: character(1)`, `num10: numeric(10,0)`, `tstz3: timestamp(3) with time zone`, `i: bigint`, `id: integer`, `s: app.tier`, `pt: point`, `hs: hstore` | 0 | Pass: database names (`bot/main` printed `int4` for `nums`) |
| `prisma db schema --json` | columns carry `"typeText"` (50 columns); no `nativeType` field; lists carry `"many": true` | 0 | Pass |

## Findings outside this slice

Items 1 to 4 reproduce on `bot/main` with the same commands. Items 5 and 6 were not run on `bot/main`; neither touches type comparison.

1. `supabase` and `paradedb-demo` cannot run `db init` or `db verify` as their READMEs say: `[declaredButUnmigrated] <extension>`.
2. On a PostGIS database built by `db init`, `db update --dry-run` plans `DROP TABLE "public"."spatial_ref_sys"` (it asks for `--delete public.spatial_ref_sys` before applying), and `db verify --strict` reports `spatial_ref_sys` as unclaimed.
3. `db schema` (human and JSON) shows only the `public` schema; the `app.thing` table is missing although `db verify` checks it.
4. `db schema` in human format prints list columns without `[]` (`tags: character varying(30)`); only the JSON says `"many": true`.
5. `migration plan` after `db migrate` started from the `db` ref (the baseline), not from the newest migration, and re-planned changes already applied; `db migrate` then failed with `MIGRATION.PATH_UNREACHABLE`. Passing `--from <newest migration>` worked. The `db` ref is advanced by `db sign` but not by `db migrate`.
6. `db verify` against a SQLite path that does not exist creates an empty file there (seen with the example's default `./demo.db`).

## Confusing messages

- `The database column has no declared type, which no data type in the configured stack declares.` reads oddly for a SQLite column with no type.
- The consent subject differs between plans: `--delete public.AllTypes.vc` (model name) for a type change of a declared column, but `--delete public.all_types.hs` (table name) when the database type is undeclared.
- The layout-violation advice ("Declare the extension in `extensions` and re-emit its contract-space artefacts") does not say that `migration plan` is the command that writes the extension's migrations.
