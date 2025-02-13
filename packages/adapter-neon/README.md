# Prisma driver adapter for Neon serverless driver

Prisma driver adapter for [Neon Serverless Driver](https://github.com/neondatabase/serverless). Refer to the [announcement blog post](https://www.prisma.io/blog/serverless-database-drivers-KML1ehXORxZV) and our [docs](https://www.prisma.io/docs/guides/database/neon#how-to-use-neons-serverless-driver-with-prisma-preview) for more details.

> **Note:**: Support for Neon's serverless driver is available from Prisma versions [5.4.2](https://github.com/prisma/prisma/releases/tag/5.4.2) and later.

The [Neon serverless driver](https://github.com/neondatabase/serverless) is a low-latency Postgres driver for JavaScript and TypeScript that allows you to query data from serverless and edge environments.

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

> **Note**: Make sure your connection string exists in your `.env` file. Refer to [Neon's docs](https://neon.tech/docs/connect/connect-from-any-app) to learn how to retrieve your database's connection string.
>
> ```bash
> DATABASE_URL="postgres://user:password@server.us-east-2.aws.neon.tech/neondb"
> ```

Generate Prisma Client:

```sh
npx prisma generate
```

Install the Prisma adapter for Neon's serverless driver, Neon's serverless driver and `ws` packages:

```sh
npm install @prisma/adapter-neon
npm install @neondatabase/serverless
npm install ws
```

Update your Prisma Client instance to use the Neon serverless driver using a WebSocket connection:

```ts
// Import needed packages
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import ws from 'ws'

// Setup
neonConfig.webSocketConstructor = ws
const connectionString = `${process.env.DATABASE_URL}`

// Init prisma client
const pool = new Pool({ connectionString })
const adapter = new PrismaNeon(pool)
const prisma = new PrismaClient({ adapter })

// Use Prisma Client as normal
```

You can now use Prisma Client as you normally would with full type-safety. Your Prisma Client instance now uses Neon's serverless driver to connect to your database. This comes with benefits such as WebSocket connections and [message pipelining](https://neon.tech/blog/quicker-serverless-postgres).

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/21346).
