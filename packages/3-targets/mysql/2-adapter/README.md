# @internal/adapter-mysql

MySQL control adapter for Prisma 8.

## Package Classification

- **Domain**: targets
- **Layer**: adapters
- **Plane**: multi-plane (shared, migration)

## Purpose

Reads a MySQL database for the control plane: introspection into the SQL family's schema IR, the marker and ledger reads, the control tables' DDL and transactions.

## Responsibilities

- **Capabilities**: `foreignKeys`, `orderBy`, `limit` and `enums`. Not `returning`, `lateral` or any conflict target.
- **Introspection** (`src/core/migrations/introspection.ts`): reads `information_schema` for `TABLE_SCHEMA = DATABASE()`. A column's type is `COLUMN_TYPE` as reported; `EXTRA` marks `auto_increment` and expression defaults (`DEFAULT_GENERATED`), and an unquoted `COLUMN_DEFAULT` is a literal the column's codec reads. Unique constraints are split from plain indexes by `TABLE_CONSTRAINTS`, and the index InnoDB creates for a foreign key, which carries the key's name and columns, is left out. The mapping takes catalog rows, so it is tested without a server.
- **Marker and ledger reads**, **`withTransaction`** (`START TRANSACTION`), and the `CREATE TABLE IF NOT EXISTS` statements for the control tables.
- **Not yet built**: marker and ledger writes and `lockMarker` refuse with `MIGRATION.TARGET_UNSUPPORTED`; query lowering refuses with `RUNTIME.AST_UNSUPPORTED`.

## Exports

- `./control`: the control adapter descriptor, `MysqlControlAdapter` and `buildMysqlSchemaIR`
- `./adapter`: capabilities and contract contributions
- `./codec-types`: the `CodecTypes` an emitted `contract.d.ts` imports
