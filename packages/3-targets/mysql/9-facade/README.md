# @internal/mysql

MySQL configuration, contract builder and control client for Prisma 8.

## Package Classification

- **Domain**: extensions
- **Layer**: adapters
- **Plane**: multi-plane (shared, migration)

## Purpose

Wires the MySQL target, adapter and driver together for a project's `prisma.config.ts` and for TypeScript contracts.

## Responsibilities

- **`defineConfig`** (`./config`): a MySQL project's configuration. A `.prisma` contract types a text `enum` block as a native MySQL enum (`mysql/enum@1`) and an integer one as `int`.
- **`defineContract`** (`./contract-builder`): the TypeScript contract builder bound to the MySQL packs.
- **`createMysqlControlClient`** (`./control`): a control client for introspection and the marker and ledger reads.
- **Not yet built**: the runtime client and the static entry point. This package has no public shell yet.

## Testing

`test/fixtures/` holds the project's example contract in PSL with its emitted `generated/` files, which `pnpm fixtures:check` keeps stable. The live tests need `MYSQL_URL` and are skipped without it. `docker compose up mysql` starts MySQL 8.4 for them: `MYSQL_URL=mysql://root:root@127.0.0.1:3307/mysql pnpm test`.
