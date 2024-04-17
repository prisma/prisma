# @prisma/adapter-pg-lite

This package contains the driver adapter for Prisma ORM that enables usage of the [`PGlite`](https://github.com/electric-sql/pglite) database driver for PostgreSQL running in WebAssembly. You can learn more in the [documentation](https://pris.ly/d/adapter-pg-lite).

`PGlite` is a lightweight, WASM-based PostgreSQL build that allows running PostgreSQL directly in the browser, Node.js, and Bun environments without any external dependencies. It is only 2.6mb gzipped and supports both ephemeral in-memory databases and persistent storage.

> **Note:**: Support for the `PGlite` driver is available from Prisma versions [5.4.2](https://github.com/prisma/prisma/releases/tag/5.4.2) and later.

## Usage

This section explains how you can use it with Prisma ORM and the `@prisma/adapter-pg-lite` driver adapter. Be sure that the `DATABASE_URL` environment variable is set to your PostgreSQL connection string (e.g., in a `.env` file) or use a direct in-memory connection.

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

Next, install the `@electric-sql/pglite` package and Prisma ORM's driver adapter:
