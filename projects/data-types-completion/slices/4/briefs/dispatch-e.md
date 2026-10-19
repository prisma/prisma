# Dispatch e: the Prisma 7 type table names data types

Read `common-rules.md` first. Design 13.8; plan decision 5.

## Today

`packages/3-targets/3-targets/postgres/src/core/prisma7-type-map.ts` names a Prisma 8 constructor and default arguments per Prisma 7 type; three date entries spell the constructor through `EXISTING_COLUMN_DATE_TIME_TYPES` (`psl-build/existing-column-date-time-types.ts`), which nothing else reads. Every entry already names the constructor marked `inferred` for its data type.

## Build

1. Each entry names the data type and parameters Prisma 7 creates for the Prisma 7 type (for example `DateTime` → `pg/timestamp` with `{ precision: 3 }`), and the reader prints the constructor marked `inferred` for that data type with the fewest arguments, through the SQL family's marked-constructor functions from TML-3582.
2. Delete `EXISTING_COLUMN_DATE_TIME_TYPES` and its file.
3. A `@db.X(args)` attribute's arguments still replace the defaults.

## Done when

Prisma 7 reader output is unchanged: `contract-prisma7` tests, its expected-contract fixtures (no regeneration diff), `test/integration/test/fixtures/prisma7-source/` journeys. Root `typecheck:agent`, `lint:deps`.
