# Prisma driver adapter for libSQL

Prisma driver adapter for Turso and libSQL. Refer to the [announcement blog post](https://prisma.io/turso) and our [docs](https://www.prisma.io/docs/guides/database/turso) for more details.

> **Note**: Support for Turso is available in [Early Access](https://www.prisma.io/docs/about/prisma/releases#early-access) from Prisma versions 5.4.2 and later.

## Getting started

<details>

<summary> <b>Set up a database on Turso and retrieve database credentials</b> </summary>

Ensure that you have the [Turso CLI](https://docs.turso.tech/reference/turso-cli) installed to manage your databases.

1. To provision a database on Turso, run the following command:

```sh
turso db create turso-prisma-db
```

2. Retrieve the database's connection string:

```sh
turso db show turso-prisma-db
```

3. Create an authentication token that will allow you to connect to the database:

  ```sh
  turso db tokens create turso-prisma-db
  ```

4. Update your `.env` file with the authentication token and connection string:

  ```text
  TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
  TURSO_DATABASE_URL="libsql://turso-prisma-db-user.turso.io"
  ```

</details>

<br/>

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

Install the libSQL database client and Prisma driver adapter for libSQL packages:

```sh
npm install @prisma/adapter-libsql
npm install @libsql/client
```

Update your Prisma Client instance to use the libSQL database Client and the Prisma driver adapter for libSQL:

```ts
// Import needed packages
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Setup
const connectionString = `${process.env.TURSO_DATABASE_URL}`
const authToken = `${process.env.TURSO_AUTH_TOKEN}`

// Init prisma client
const libsql = createClient({
  url: connectionString,
  authToken,
})
const adapter = new PrismaLibSQL(libsql)
const prisma = new PrismaClient({ adapter })

// Use Prisma Client as normal
```

The above setup uses a **single** remote Turso database. You can take this a step further by setting up [remote replicas](https://docs.turso.tech/concepts#replica) and [embedded replicas](https://blog.turso.tech/introducing-embedded-replicas-deploy-turso-anywhere-2085aa0dc242) with Turso.

## How to manage schema changes

Prisma Migrate and Introspection workflows are currently not supported when working with Turso. This is because Turso uses HTTP to connect to your database, which Prisma Migrate doesn't support.

To update your database schema:

1. Generate a migration file using `prisma migrate dev` against a local SQLite database:

   ```sh
   npx prisma migrate dev --name init # Migration name
   ```

2. Apply the migration using Turso's CLI:

   ```sh
   turso db shell turso-prisma-db < ./prisma/migrations/20230922132717_init/migration.sql # Replace `20230922132717_init` with the existing migration
   ```

For subsequent migrations, repeat the above steps to apply changes to your database. This workflow does not support tracking the history of applied migrations.


## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback about our libSQL driver support. Leave a comment on our [dedicated GitHub issue](https://github.com/prisma/prisma/discussions/21345) and we'll use it as we continue development.
