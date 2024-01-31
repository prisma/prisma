# @prisma/adapter-pg

This package contains the driver adapter for Prisma ORM that enables usage of the [`node-postgres`](https://node-postgres.com/) (`pg`) database driver for PostgreSQL. You can learn more in the [documentation](https://pris.ly/d/adapter-pg).

`pg` is one of the most popular drivers in the JavaScript ecosystem for PostgreSQL databases. It can be used with any PostgreSQL database that's accessed via TCP.

> **Note:**: Support for the `pg` driver is available from Prisma versions [5.4.2](https://github.com/prisma/prisma/releases/tag/5.4.2) and later.

## Usage

This section explains how you can use it with Prisma ORM and the `@prisma/adapter-pg` driver adapter. Be sure that the `DATABASE_URL` environment variable is set to your PostgreSQL connection string (e.g. in a `.env` file).

### 1. Enable the `driverAdapters` Preview feature flag

Since driver adapters are currently in [Preview](/orm/more/releases#preview), you need to enable its feature flag on the `datasource` block in your Prisma schema:

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Once you have added the feature flag to your schema, re-generate Prisma Client:

```
npx prisma generate
```

### 2. Install the dependencies

Next, install the `pg` package and Prisma ORM's driver adapter:

```
npm install pg
npm install @prisma/adapter-pg
```

### 3. Instantiate Prisma Client using the driver adapter

Finally, when you instantiate Prisma Client, you need to pass an instance of Prisma ORM's driver adapter to the `PrismaClient` constructor:

```ts
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = `${process.env.DATABASE_URL}`

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/22899).
