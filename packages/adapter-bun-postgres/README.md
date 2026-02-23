# `@prisma/adapter-bun-postgres`

Prisma driver adapter for Bun SQL (PostgreSQL).

## Usage

```ts
import { PrismaBunPostgres } from '@prisma/adapter-bun-postgres'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaBunPostgres({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })
```

This adapter requires running Prisma Client on Bun.
