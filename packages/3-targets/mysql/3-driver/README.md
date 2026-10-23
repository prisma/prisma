# @internal/driver-mysql

MySQL runtime and control drivers for Prisma 8, built on mysql2.

## Package Classification

- **Domain**: targets
- **Layer**: drivers
- **Plane**: multi-plane (shared, migration, runtime)

## Purpose

Connects the runtime and the control plane to a MySQL server and hands codecs the text the server sends ([ADR 155](../../../../docs/architecture%20docs/adrs/ADR%20155%20-%20Driver%20Codec%20Boundary%20and%20Lowering%20Responsibilities.md)).

## Responsibilities

- **Text protocol only**: statements run through mysql2's `query()`, and `multipleStatements` stays off. The driver writes the values into the statement itself (`src/core/format-query.ts`), escaped by mysql2: a numbered `?N` takes value N and a bare `?` takes the values in order. A `?` inside a quoted string, a backtick identifier or a comment is text, which mysql2's own substitution does not know. A statement whose placeholders and values do not match raises `RUNTIME.PARAM_PLACEHOLDER_MISMATCH`.
- **Connection URL** (`src/core/connection-options.ts`): reads `ssl`, `connectTimeout` and `flags` as connection options and `connectionLimit` and `poolTimeout` (milliseconds, ten seconds by default) as pool settings, and refuses any other parameter with `RUNTIME.BINDING_INVALID`. Every connection uses utf8mb4 and a `charset` parameter is refused: the driver escapes values as JavaScript text, and a narrower charset can turn a character of a value into a quote or a backslash when mysql2 encodes the statement.
- **Session setup** (`src/core/session-setup.ts`): every connection clears `NO_BACKSLASH_ESCAPES`, because mysql2 escapes with backslashes, and runs in UTC.
- **Server text** (`src/core/server-text.ts`): a `typeCast` returns every column as text, JSON as UTF-8 (MySQL reports it as binary), and binary strings and blobs as their bytes.
- **Errors**: a query error MySQL reports becomes a `SqlQueryError` carrying its SQLSTATE; a failed connection is `DRIVER.CONNECTION_FAILED` with the URL redacted.
- **Runtime driver** (`./runtime`): a mysql2 pool. Each physical connection runs the session setup once. Rows stream through the connection; a stream whose connection is lost ends with `DRIVER.NOT_CONNECTED`, and a lost connection or a fatal error evicts it. When the caller stops reading a stream early, a connection the pool lent for that statement is evicted, and a connection the caller holds reads and drops the rest so its session survives. A transaction runs on one connection. A statement that waits longer than `poolTimeout` for a connection fails with `DRIVER.CONNECTION_FAILED`. `close()` waits for every connection and stream it has handed out.

## Exports

- `./runtime`: the runtime driver descriptor
- `./control`: the control driver descriptor and `MysqlControlDriver`
