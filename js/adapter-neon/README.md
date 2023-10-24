# @prisma/adapter-neon

Prisma driver adapter for [Neon Serverless Driver](https://github.com/neondatabase/serverless).

See https://github.com/prisma/prisma/releases/tag/5.4.0 and https://www.prisma.io/blog/serverless-database-drivers-KML1ehXORxZV for details.

The following usage tutorial is valid for Prisma 5.4.2 and later versions.

## How to install

After [creating your database on Neon](https://neon.tech/docs/get-started-with-neon/setting-up-a-project), you'll need to install the `@prisma/adapter-neon` driver adapter, Neon’s serverless database driver `@neondatabase/serverless`, and `ws` to set up a WebSocket connection for use by Neon.

```sh
npm install @prisma/adapter-neon
npm install @neondatabase/serverless
npm install ws
```

Make sure your [Neon database connection string](https://neon.tech/docs/connect/connect-from-any-app) is copied over to your `.env` file. The connection string will start with `postgres://`.

```env
# .env
DATABASE_URL="postgres://..."
```

Make sure you also include the `driverAdapters` Preview feature in your `schema.prisma`.

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

Now run `npx prisma generate` to re-generate Prisma Client.

## How to use

In TypeScript, you will need to:

1. Import packages
2. Set up the Neon serverless database driver
3. Instantiate the Prisma Neon adapter with the Neon serverless database driver
4. Pass the driver adapter to the Prisma Client instance

```typescript
// Import needed packages
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

// Setup
neonConfig.webSocketConstructor = ws;
const connectionString = `${process.env.DATABASE_URL}`;

// Init prisma client
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

// Use Prisma Client as normal
```

Now your code has built-in benefits of the Neon serverless driver, such as WebSocket connections and [message pipelining](https://neon.tech/blog/quicker-serverless-postgres), while Prisma covers connection creation and destruction, error handling, and type safety. If you have any feedback about our Neon Serverless Driver support, please leave a comment on our [dedicated GitHub issue](https://github.com/prisma/prisma/discussions/21346) and we'll use it as we continue development.
