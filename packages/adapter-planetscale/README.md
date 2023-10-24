# @prisma/adapter-planetscale

Prisma driver adapter for [PlanetScale Serverless Driver](https://github.com/planetscale/database-js).

See https://github.com/prisma/prisma/releases/tag/5.4.0 and https://www.prisma.io/blog/serverless-database-drivers-KML1ehXORxZV for details.

The following usage tutorial is valid for Prisma 5.4.2 and later versions.

## How to install

After [getting started with PlanetScale](https://neon.tech/docs/get-started-with-neon/setting-up-a-project), you can use the PlanetScale serverless driver to connect to your database. You will need to install the `@prisma/adapter-planetscale` driver adapter, the `@planetscale/database` serverless driver, and `undici` to provide a `fetch` function to the PlanetScale driver.

```sh
npm install @prisma/adapter-planetscale
npm install @planetscale/database
npm install undici
```

Make sure your [PlanetScale database connection string](https://planetscale.com/docs/concepts/connection-strings) is copied over to your `.env` file. The connection string will start with `mysql://`.

```env
# .env
DATABASE_URL="mysql://..."
```

You can now reference this environment variable in your `schema.prisma` datasource. Make sure you also include the `driverAdapters` Preview feature.

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}
```

Now run `npx prisma generate` to re-generate Prisma Client.

## How to use

In TypeScript, you will need to:

1. Import packages
2. Set up the PlanetScale serverless database driver
3. Instantiate the Prisma PlanetScale adapter with the PlanetScale serverless database driver
4. Pass the driver adapter to the Prisma Client instance

```typescript
// Import needed packages
import { connect } from '@planetscale/database';
import { PrismaPlanetScale } from '@prisma/adapter-planetscale';
import { PrismaClient } from '@prisma/client';
import { fetch as undiciFetch } from 'undici';

// Setup
const connectionString = `${process.env.DATABASE_URL}`;

// Init prisma client
const connection = connect({ url: connectionString, fetch: undiciFetch });
const adapter = new PrismaPlanetScale(connection);
const prisma = new PrismaClient({ adapter });

// Use Prisma Client as normal
```

Your Prisma Client instance now uses PlanetScale's [`database-js`](https://github.com/planetscale/database-js), which can improve [`connection reliability and performance`](https://planetscale.com/blog/faster-mysql-with-http3). It uses HTTP requests instead of Prisma’s connection pool, but Prisma will continue to handle error handling and type safety. If you have any feedback about our PlanetScale Serverless Driver support, please leave a comment on our [dedicated GitHub issue](https://github.com/prisma/prisma/discussions/21347) and we'll use it as we continue development.
