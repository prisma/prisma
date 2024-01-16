# @prisma/adapter-pg

Prisma driver adapter for the [Postgres `pg` driver](https://github.com/brianc/node-postgres).

> **Note:**: Support for the `pg` driver is available from Prisma versions [5.4.2](https://github.com/prisma/prisma/releases/tag/5.4.2) and later.

The [Postgres `pg` driver](https://github.com/brianc/node-postgres) is a low-latency Postgres driver for JavaScript and TypeScript that allows you to query data any environment, including serverless and edge clouds.

## Getting started

To get started, enable the `driverAdapters` Preview feature in your Prisma schema:

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

> **Note**: Make sure your connection string exists in your `.env` file.
>
> ```bash
> DATABASE_URL="postgres://user:password@server.us-east-2.aws.com/yourdb"
> ```

Generate Prisma Client:

```sh
npx prisma generate
```

Install the Prisma adapter for `pg`, as well as `pg` itself:

```sh
npm install @prisma/adapter-pg
npm install pg
```

Update your Prisma Client instance to use the `pg` driver:

```ts
// Import needed packages
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Setup
const connectionString = `${process.env.DATABASE_URL}`

// Init prisma client
const pool = new Pool({ connectionString })
const adapter = new PrismaNeon(pool)
const prisma = new PrismaClient({ adapter })

// Use Prisma Client as normal
```

You can now use Prisma Client as you normally would with full type-safety. Your Prisma Client instance now uses the Postgres `pg` driver to connect to your database.

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/21346).
