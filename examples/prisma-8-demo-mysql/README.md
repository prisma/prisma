# Prisma 8 Demo (MySQL)

A minimal demo showing how to use `@prisma/orm-mysql`, the one package a MySQL
application installs. It has a PSL contract with two models, a relation and an
enum, and a committed migration written by `prisma migration plan`.

MySQL support is early, and this example grows with it. Today it shows the
control plane: the contract emits, the committed migration applies to an empty
MySQL database, `db verify` and `db sign` pass, and planning again from the
unchanged contract writes nothing. Reads, writes and MariaDB will be added here
as each lands, and each is done only when this example runs it in CI.

## Setup

You need a MySQL 8 server with an empty database. The repository's
`docker-compose.yaml` starts one on port 3307.

```bash
docker compose up -d mysql
docker compose exec mysql mysql -uroot -proot -e 'CREATE DATABASE demo'
pnpm install
pnpm emit                                   # generates src/prisma/contract.json + contract.d.ts
export MYSQL_URL=mysql://root:root@127.0.0.1:3307/demo
pnpm db:migrate                             # applies migrations/ to the database
pnpm db:verify                              # checks the database matches the contract
pnpm db:sign                                # records the contract the database now satisfies
```

`db sign` writes `migrations/app/refs/db.json`, the migration graph's record of
which contract the database is at.

## Commands

| Script | Runs | What it does |
| --- | --- | --- |
| `emit` | `prisma contract emit` | Writes `src/prisma/contract.json` and `contract.d.ts` from `prisma/contract.prisma` |
| `emit:check` | `emit`, then `git diff` | Fails when the committed contract is out of date |
| `migration:plan` | `prisma migration plan --name init` | Writes a new migration under `migrations/app/` when the contract has changed |
| `db:migrate` | `prisma db migrate` | Applies the migrations the database does not have yet |
| `db:verify` | `prisma db verify` | Checks the database's marker and schema against the contract |
| `db:sign` | `prisma db sign` | Signs a database whose schema satisfies the contract |
| `test` | `vitest run` | The whole flow against a fresh database at `MYSQL_URL` |

`pnpm test` creates a uniquely named database on the server at `MYSQL_URL`
(for example `mysql://root:root@127.0.0.1:3307/mysql`),
runs `db migrate`, `db verify`, `db sign` and `migration plan` against it
through the `prisma` CLI, and drops the database. Without `MYSQL_URL` the tests
are skipped.

## What the migration creates

```sql
CREATE TABLE `Post` (
  `authorId` int NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) NOT NULL,
  PRIMARY KEY (`id`)
);
CREATE TABLE `User` (
  `email` varchar(191) NOT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `role` enum('USER','ADMIN') NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `User_email_key` UNIQUE (`email`)
);
```

plus an index on `Post.authorId` and the foreign key to `User`. The PSL enum
`Role` becomes a native MySQL `enum` column, so the database enforces its
members. `String` becomes `varchar(191)`, because MySQL cannot put a unique
index on a `text` column without a key length.

## Key files

- `prisma/contract.prisma` — the contract (User, Post, Role)
- `prisma.config.ts` — CLI config; reads the connection from `MYSQL_URL`
- `migrations/` — the committed migration and its contract snapshot
- `test/migrations.test.ts` — the end-to-end flow
- `test/database.ts` — creates and drops a database for each test run
