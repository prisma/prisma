# Prisma driver adapter for Cloudflare D1

Prisma driver adapter for [Cloudflare's Serverless Driver D1](https://developers.cloudflare.com/d1/). Refer to the [announcement blog post](https://prisma.io/cloudflare-d1) and our [docs](https://www.prisma.io/docs/guides/database/cloudflare-d1) for more details.

> **Note**: Support for Cloudflare D1 is available in [Early Access](https://www.prisma.io/docs/about/prisma/releases#early-access) from Prisma versions [TODO](https://github.com/prisma/prisma/releases/tag/TODO) and later.

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
  url      = "file:./dev.db"
}
```

Generate Prisma Client:

```sh
npx prisma generate
```

Install the Prisma adapter for Cloudflare's D1 serverless driver and Cloudflare's workers types packages:

```sh
npm install @prisma/adapter-d1
npm install @cloudflare/workers-types
```

Update your Prisma Client instance to use the Cloudflare D1 serverless driver:

```ts
// Import needed packages
import { PrismaClient } from 'db'
import { PrismaD1 } from '@prisma/adapter-d1'

// Setup
export interface Env {
  MY_DATABASE: D1Database
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Init prisma client
    const adapter = new PrismaD1(env.MY_DATABASE, process.env.DEBUG)
    const prisma = new PrismaClient({ adapter })

    // Use Prisma Client as normal
  },
}
```

> **Note**: Make sure your D1 database is setup in your `wrangler.toml`. Refer to [Cloudflare's docs](https://developers.cloudflare.com/d1/get-started/#3-create-a-database) to learn how to set up your database binding.
>
> ```toml
> [[d1_databases]]
> binding = "MY_DATABASE"    # i.e. available in the Worker on env.MY_DATABASE
> database_name = "database_name"
> database_id = "<unique-ID-for-your-database>"
> ```

Refer to our [docs](https://www.prisma.io/docs/guides/database/cloudflare-d1#how-to-manage-schema-changes) to learn how to manage schema changes when using Prisma and Cloudflare D1.

### Transactions

...

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/TODO).
