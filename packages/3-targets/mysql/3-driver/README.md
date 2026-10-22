# @internal/driver-mysql

MySQL control driver for Prisma 8, built on mysql2.

## Package Classification

- **Domain**: targets
- **Layer**: drivers
- **Plane**: multi-plane (shared, migration)

## Purpose

Connects the control plane to a MySQL server and hands codecs the text the server sends ([ADR 155](../../../../docs/architecture%20docs/adrs/ADR%20155%20-%20Driver%20Codec%20Boundary%20and%20Lowering%20Responsibilities.md)).

## Responsibilities

- **Text protocol only**: statements run through mysql2's `query()`, which escapes parameters on the client; `multipleStatements` stays off.
- **Server text** (`src/core/server-text.ts`): a `typeCast` returns every column as text, JSON as UTF-8 (MySQL reports it as binary), and binary strings and blobs as their bytes.
- **Errors**: a query error MySQL reports becomes a `SqlQueryError` carrying its SQLSTATE; a failed connection is `DRIVER.CONNECTION_FAILED` with the URL redacted.
- **Not yet built**: the runtime driver.

## Exports

- `./control`: the control driver descriptor and `MysqlControlDriver`
