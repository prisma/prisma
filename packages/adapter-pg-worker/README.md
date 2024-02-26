# @prisma/adapter-pg-worker

This package provides a driver adapter for Prisma ORM that allows you to use the `@prisma/pg-worker` package as a connection pool for PostgreSQL databases.

`@prisma/pg-worker` is a lightweight version of `pg` that is designed to be used in a worker. It is a drop-in replacement for `pg` and is fully compatible with Prisma ORM.

## Usage

This section explains how you can use it with Prisma ORM and the `@prisma/adapter-pg-worker` driver adapter. Be sure that the `DATABASE_URL` environment variable is set to your PostgreSQL connection string (e.g. in a `.env` file).

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

Next, install the `@prisma/pg-worker` package and Prisma ORM's driver adapter:

```
npm install @prisma/pg-worker
npm install @prisma/adapter-pg-worker
```

### 3. Instantiate Prisma Client using the driver adapter

Finally, when you instantiate Prisma Client, you need to pass an instance of Prisma ORM's driver adapter to the `PrismaClient` constructor:

```ts
import { Pool } from '@prisma/pg-worker'
import { PrismaPg } from '@prisma/adapter-pg-worker'
import { PrismaClient } from '@prisma/client'

const connectionString = `${process.env.DATABASE_URL}`

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/22899).
