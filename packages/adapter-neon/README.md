# Prisma driver adapter for Neon

Prisma driver adapter for [Neon Serverless Driver](https://github.com/neondatabase/serverless). Refer to the [announcement blog post](https://www.prisma.io/blog/serverless-database-drivers-KML1ehXORxZV) for more details.

> **Note:**: The Neon driver adapter is availalble from Prisma versions [5.4.2](https://github.com/prisma/prisma/releases/tag/5.4.0) and later.

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

Generate Prisma Client:

```sh
npx prisma generate
```

Install the Prisma adapter for Neon's serverless driver, Neon's serverless driver and `ws`:

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

Your Prisma Client will now take advantage of the Neon serverless driver. The Neon serverless driver comes with benefits such as WebSocket connections and [message pipelining](https://neon.tech/blog/quicker-serverless-postgres), while Prisma covers connection creation and destruction, error handling, and type safety.

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/21346).
