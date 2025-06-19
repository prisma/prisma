# Prisma driver adapter for bun-sqlite

Prisma driver adapter for `bun-sqlite`.

> [!NOTE]
> The adapter is currently in [Preview](https://www.prisma.io/docs/orm/more/releases#early-access), we are looking for feedback before moving to General Availability.

## Getting started

To get started, enable the `driverAdapters` Preview feature flag in your Prisma schema:

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = "file:./path/to/database.db"
}
```

Install Prisma CLI, Prisma Client, the Prisma adapter for bun:sqlite:

```sh
bun add @prisma/client @prisma/adapter-bun-sqlite
bun add -D prisma
```

Update your Prisma Client instance to use `PrismaBunSqlite`:

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaBunSQLite } from '@prisma/adapter-bun-sqlite';

const adapter = new PrismaBunSQLite({ url: "./path/to/database.db" });

const prisma = new PrismaClient({ adapter });
```

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.