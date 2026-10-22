# @internal/target-mysql

MySQL target pack for Prisma 8.

## Package Classification

- **Domain**: targets
- **Layer**: targets
- **Plane**: multi-plane (shared, migration)

## Purpose

Declares what MySQL is to the SQL family: its data types, codecs and PSL scalars, its single namespace, the control tables, and the control target descriptor that projects a contract onto the schema IR introspection compares it with.

## Responsibilities

- **Descriptor metadata**: `targetId: 'mysql'`, `supportsNamespaces: false` and the unbound default namespace ([ADR 223](../../../../docs/architecture%20docs/adrs/ADR%20223%20-%20Target-owned%20default%20namespace.md)). Namespace blocks are refused through that flag, with the display name and reason the descriptor supplies.
- **Data types** (`src/core/data-types.ts`, [ADR 254](../../../../docs/architecture%20docs/adrs/ADR%20254%20-%20Data%20types%20and%20casts.md)): `mysql/int`, `mysql/bigint`, `mysql/varchar`, `mysql/char`, `mysql/text`, `mysql/datetime` and `mysql/enum`. PSL `String` is `varchar(191)`, so a `@unique` column can be indexed. `mysql/enum` is a native `enum('A','B')` column type whose name is the text MySQL's catalog prints, so `db verify` compares the members and their order.
- **Enum columns** (`src/core/mysql-database.ts`): the namespace factory writes each enum column's members, from the value set the column names, into its type parameters in declared order. No CHECK constraint is derived.
- **Codecs**: one per data type, plus MySQL adaptations of the family's `sql/char@1`, `sql/varchar@1` and `sql/raw@1`. Each `fromWire` reads the text MySQL sends ([ADR 155](../../../../docs/architecture%20docs/adrs/ADR%20155%20-%20Driver%20Codec%20Boundary%20and%20Lowering%20Responsibilities.md)). `projectJson` refuses until reads with includes are built.
- **Control tables**: `_prisma_marker` and `_prisma_ledger` live beside the application's tables, because MySQL has no schema inside a database. `src/contract-free/control-bootstrap.ts` declares their DDL.
- **Control target descriptor**: contract serializer, `contractToSchema` and `diffSchema`. Planning and running migrations refuse with `MIGRATION.TARGET_UNSUPPORTED` until the migration slice.

## Exports

- `./pack`: the pack ref for `defineContract` and the PSL interpreter
- `./control`: the control target descriptor and `mysqlCreateNamespace`
- `./codecs`, `./codec-ids`, `./codec-types`, `./codec-descriptor`: codecs and their registry
- `./data-types`: data types and their PSL authoring entries
- `./contract-free`, `./ddl`, `./control-tables`: control-table DDL
- `./default-normalizer`, `./sql-utils`, `./errors`: helpers the adapter shares
