# Node.js Drivers Playground

This playground can be used to observe how the experimental `nodeDrivers` preview feature behaves with respect to a "standard" Prisma Client.

In particular, focusing on the MySQL database, this playground makes it easy to run Prisma queries switching from a Rust driver to a Node.js wrapper around the `mysql2` driver.

## Preliminaries

In a terminal open at the root of this repository:

- Run `pnpm i && pnpm build` to build Prisma locally
- Run a MySQL instance via
  ```sh
  docker-compose -f docker/docker-compose.yml up mysql
  ```

In another terminal open at the current ([./reproductions/node-drivers](./)) location:

- Run `pnpm i`
- Edit the Prisma Client script (located at [`index.ts`](./index.ts)) as you please before running the playground examples
- Export the `DATABASE_URL="mysql://root:root@localhost:3306/tests"` env var, ideally via `direnv allow .`

## How to run experimental `nodeDrivers`

- Edit [`./prisma/schema.prisma`](./prisma/schema.prisma) and set:
  - `provider = "@prisma/mysql"` in the `datasource db` block
- Run `pnpm prepare`
- Run `pnpm test:node`
  - We recommend saving the output to a file like so: `pnpm test:node > out.node.log`

## How to run plain ol' Prisma

- Edit [`./prisma/schema.prisma`](./prisma/schema.prisma) and set:
  - `provider = "mysql"` in the `datasource db` block
- Run `pnpm prepare`
- Run `pnpm test:rust`
  - We recommend saving the output to a file like so: `pnpm test:rust > out.rust.log`

## Current limitations

- The database URL can only be `env("DATABASE_URL")`
- The `PRISMA_USE_NODE_DRIVERS` env var is currently used to regulate when a Node.js driver is effectively instantiated.
- Only parameterless queries that don't use transactions can currently be tested
- Prisma Client scripts must be explicitly closed via `process.exit(0)` (otherwise, the process hangs when using `nodeDrivers`)
