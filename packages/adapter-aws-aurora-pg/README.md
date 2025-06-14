# @prisma/adapter-aws-aurora-pg

This package contains the driver adapter for Prisma ORM that enables usage of the [`aws-advanced-nodejs-wrapper`](https://github.com/aws/aws-advanced-nodejs-wrapper/) database driver for PostgreSQL.

## Usage

This section explains how you can use it with Prisma ORM and the `@prisma/adapter-aws-aurora-pg` driver adapter. Be sure that the `DATABASE_URL` environment variable is set to your PostgreSQL connection string (e.g. in a `.env` file).

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

Next, install the `aws-advanced-nodejs-wrapper` package and Prisma ORM's driver adapter:

```
npm install aws-advanced-nodejs-wrapper
npm install @prisma/adapter-aws-aurora-pg
```

### 3. Instantiate Prisma Client using the driver adapter

Finally, when you instantiate Prisma Client, you need to pass an instance of Prisma ORM's driver adapter to the `PrismaClient` constructor:

```ts
import { PrismaClient } from '@prisma/client'
import { AwsPGClient } from 'aws-advanced-nodejs-wrapper/dist/pg/lib/index.js' // the AWS client
import { PrismaAws } from './adapter' // the custom adapter

const connectionString = `${process.env.DATABASE_URL}`

const client = new AwsPGClient(connectionString)
const adapter = new PrismaAws(client)
const prisma = new PrismaClient({ adapter })
```

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

<!-- Placeholder -->

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/discussions/).
