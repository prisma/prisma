# Prisma driver adapter for Cloudflare D1

Prisma driver adapter for [Cloudflare D1](https://developers.cloudflare.com/d1/).

> [!IMPORTANT] 
> We do not recommend using the adapter in a production environment yet.
> The adapter is currently in [Early Access](https://www.prisma.io/docs/orm/more/releases#early-access), we are looking for feedback before moving to Preview. 

<!-- TODO Refer to the [announcement blog post](https://prisma.io/cloudflare-d1) and our [docs](https://www.prisma.io/docs/guides/database/cloudflare-d1) for more details. -->

<!-- > **Note**: Support for Cloudflare D1 is available in [Early Access](https://www.prisma.io/docs/about/prisma/releases#early-access) from Prisma versions [TODO](https://github.com/prisma/prisma/releases/tag/TODO) and later. -->

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

Install Prisma Client, Prisma adapter for Cloudflare D1, Prisma CLI, Cloudflare's workers types and Wrangler CLI packages:

```sh
npm install @prisma/client
npm install @prisma/adapter-d1
npm install --save-dev prisma
npm install --save-dev @cloudflare/workers-types
npm install --save-dev wrangler
```

Generate Prisma Client:

```sh
npx prisma generate
```

Update your Prisma Client instance to use `PrismaD1`:

```ts
// Import needed packages
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

export interface Env {
  MY_DATABASE: D1Database
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Setup Prisma Client with the adapter
    const adapter = new PrismaD1(env.MY_DATABASE)
    const prisma = new PrismaClient({ adapter })

    // Execute a Prisma Client query
    const usersCount = await prisma.user.count()

    // Return result
    return new Response(usersCount)
  }
}
```

<details>
  <summary>For JavaScript users</summary>
  ```js
  // Import needed packages
  import { PrismaClient } from '@prisma/client'
  import { PrismaD1 } from '@prisma/adapter-d1'
  
  export default {
    async fetch(request, env, ctx) {
      // Setup Prisma Client with the adapter
      const adapter = new PrismaD1(env.MY_DATABASE)
      const prisma = new PrismaClient({ adapter })
  
      // Execute a Prisma Client query
      const usersCount = await prisma.user.count()

      // Return result
      return new Response(usersCount)
    }
  }
  ```
</details>

> **Note**: Make sure your D1 database is setup in your `wrangler.toml`. Refer to [Cloudflare's docs](https://developers.cloudflare.com/d1/get-started/#3-create-a-database) to learn how to set up your database binding.
>
> ```toml
> [[d1_databases]]
> binding = "MY_DATABASE"    # i.e. available in the Worker on env.MY_DATABASE
> database_name = "database_name"
> database_id = "<unique-ID-for-your-database>"
> ```

<!-- TODO Refer to our [docs](https://www.prisma.io/docs/guides/database/cloudflare-d1#how-to-manage-schema-changes) to learn how to manage schema changes when using Prisma and Cloudflare D1. -->

<!-- ## Feedback
TODO Leave this till preview
We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/TODO). -->
