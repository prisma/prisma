# @prisma/orm-family-sql

The SQL family domain of Prisma Next: the SQL contract surface, schema IR, query lanes, SQL builder, and the SQL runtime shared by every SQL target (Postgres, SQLite).

Applications receive it as an exact-pinned dependency of a SQL facade (`@prisma/orm-postgres`, `@prisma/orm-sqlite`); app developers install the facade. Extension authors and decomposed installs building against the SQL family import it directly.

## Entrypoints

| Namespace | Surface |
| --- | --- |
| `/contract` | SQL contract entities, validators, index and FK modelling |
| `/schema-ir` | SQL schema intermediate representation |
| `/contract-psl`, `/contract-ts` | PSL and TypeScript contract authoring for SQL |
| `/contract-emitter` | SQL contract emission |
| `/relational-core`, `/lane-query-builder`, `/builder` | query lanes, relational AST, SQL builder |
| `/runtime` | SQL runtime |
| `/family` | the family pack: control, migration, diff, IR, verification |

## Responsibilities

Everything SQL databases share and nothing any one of them owns: contract semantics, relational query building, and the family-level control/migration surface. Target-specific behavior (Postgres or SQLite DDL, drivers) lives in the `@prisma/orm-target-*` packages.

## Dependencies

`@prisma/orm-framework` and `@prisma/orm-toolchain` (exact lockstep pins) plus small third-party runtime libraries. No database drivers.
