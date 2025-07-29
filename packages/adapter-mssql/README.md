# @prisma/adapter-mssql

This package contains the driver adapter for Prisma ORM that enables usage of the [`mssql`](https://www.npmjs.com/package/mssql) database driver for Microsoft SQL Server.

The `mssql` driver is one of the most popular drivers in the JavaScript ecosystem for Microsoft SQL Server databases. It can be used with any SQL Server database that's accessed via TCP, including Azure SQL Database.

## Usage

This section explains how you can use it with Prisma ORM and the `@prisma/adapter-mssql` driver adapter. Be sure that the `DATABASE_URL` environment variable is set to your SQL Server connection string (e.g. in a `.env` file).

### 1. Enable the `driverAdapters` Preview feature flag

Since driver adapters are currently in [Preview](/orm/more/releases#preview), you need to enable its feature flag on the `datasource` block in your Prisma schema:

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

Once you have added the feature flag to your schema, re-generate Prisma Client:

```
npx prisma generate
```

### 2. Install the dependencies

Next, install the Prisma ORM's driver adapter:

```
npm install @prisma/adapter-mssql
```

### 3. Instantiate Prisma Client using the driver adapter

Finally, when you instantiate Prisma Client, you need to pass an instance of Prisma ORM's driver adapter to the `PrismaClient` constructor:

```ts
import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaClient } from '@prisma/client'

const config = {
  server: 'localhost',
  port: 1433,
  database: 'mydb',
  user: 'sa',
  password: 'mypassword',
  options: {
    encrypt: true, // Use this if you're on Windows Azure
    trustServerCertificate: true, // Use this if you're using self-signed certificates
  },
}

const adapter = new PrismaMssql(config)
const prisma = new PrismaClient({ adapter })
```
