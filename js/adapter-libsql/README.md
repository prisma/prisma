# @prisma/adapter-libsql

Prisma driver adapter for Turso and libSQL.

See https://prisma.io/turso for details.

The following usage tutorial is valid for Prisma 5.4.2 and later versions.

## How to install

After [getting started with Turso](https://www.prisma.io/blog/prisma-turso-ea-support-rXGd_Tmy3UXX#create-a-database-on-turso), you can use the Turso serverless driver to connect to your database. You will need to install the `@prisma/adapter-libsql` driver adapter and the `@libsql/client` serverless driver.

```sh
npm install @prisma/adapter-libsql
npm install @libsql/client
```

Make sure your Turso database connection string and authentication token is copied over to your `.env` file. The connection string will start with `libsql://`.

```env
# .env
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
TURSO_DATABASE_URL="libsql://turso-prisma-random-user.turso.io"
```

You can now reference this environment variable in your `schema.prisma` datasource. Make sure you also include the `driverAdapters` Preview feature.

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

Now run `npx prisma generate` to re-generate Prisma Client.

## How to setup migrations

As Turso needs to sync between a local sqlite database and another one hosted on Turso Cloud, an additional migration setup is needed. In particular, anytime you modify models and relations in your `schema.prisma` file, you should:

1. Create a baseline migration

```sh
npx prisma migrate diff --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > baseline.sql
```

2. Apply the migration to your Turso database

```sh
turso db shell turso-prisma < baseline.sql 
```

## How to use

In TypeScript, you will need to:

1. Import packages
2. Set up the libSQL serverless database driver
3. Instantiate the Prisma libSQL adapter with the libSQL serverless database driver
4. Pass the driver adapter to the Prisma Client instance

```typescript
// Import needed packages
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// Setup
const connectionString = `${process.env.TURSO_DATABASE_URL}`;
const authToken = `${process.env.TURSO_AUTH_TOKEN}`;

// Init prisma client
const libsql = createClient({
  url: connectionString,
  authToken,
});
const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

// Use Prisma Client as normal
```

Your Prisma Client instance now uses a **single** remote Turso database.
You can take it a step further by setting up database replicas. Turso automatically picks the closest replica to your app for read queries when you create replicas. No additional logic is required to define how the routing of the read queries should be handled. Write queries will be forwarded to the primary database.
We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback about our libSQL Serverless Driver support, please leave a comment on our [dedicated GitHub issue](https://github.com/prisma/prisma/discussions/21345) and we'll use it as we continue development.
