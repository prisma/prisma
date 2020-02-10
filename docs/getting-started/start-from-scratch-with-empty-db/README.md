# Start from scratch with an empty database

There are two ways how you can use Prisma with an empty database:

- [Define your database schema and run migrations using SQL](./quickstart-sql.md) (recommended)
- [Define your database schema via Prisma and run migrations using Prisma Migrate](./quickstart-prisma-migrate.md) (experimental)

> **Warning**: Prisma Migrate is currently in an **experimental** state. When using any of the the `prisma2 migrate` commands, you need to explicitly opt-in to that functionality via an `--experimental` flag, e.g. `prisma2 migrate save --experimental`.
