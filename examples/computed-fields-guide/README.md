# Computed/Generated Fields in Prisma

This guide demonstrates how to use database-level computed/generated columns with Prisma ORM.

> **Note:** This example addresses [GitHub Issue #28378](https://github.com/prisma/prisma/issues/28378) by showing how to implement computed fields until native schema syntax support is added.

## Running this Example

This project is configured to use **SQLite** for demonstration purposes.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize the database:**
   ```bash
   # This applies the migration which includes the generated columns
   export DATABASE_URL="file:./dev.db"
   npx prisma migrate deploy
   ```

3. **Run the demo:**
   ```bash
   export DATABASE_URL="file:./dev.db"
   npm run dev
   ```

## Overview

Many databases support **generated columns** (also called computed columns) that automatically calculate their values based on other columns in the same row. This guide shows you how to use this feature with Prisma.

**Supported Databases:**
- PostgreSQL 12+ (STORED generated columns)
- MySQL 5.7+ (STORED and VIRTUAL generated columns)
- SQLite 3.31+ (STORED and VIRTUAL generated columns)
- SQL Server (computed columns)

## Quick Start

### 1. Define Your Schema

Create a standard Prisma schema with the fields you want to compute from:

```prisma
// schema.prisma
generator client {
  provider = "prisma-client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  firstName     String
  lastName      String
  countryCode   String
  phone         String
  
  // These will become generated columns
  fullName      String?
  formattedPhone String?
}
```

### 2. Create Initial Migration

```bash
npx prisma migrate dev --name init
```

### 3. Manually Edit the Migration

Open the generated migration file in `prisma/migrations/XXXXXX_init/migration.sql` and add the generated column definitions:

**PostgreSQL:**
```sql
-- Add this AFTER the CREATE TABLE statement
ALTER TABLE "User" 
  DROP COLUMN "fullName",
  ADD COLUMN "fullName" TEXT GENERATED ALWAYS AS ("firstName" || ' ' || "lastName") STORED;

ALTER TABLE "User"
  DROP COLUMN "formattedPhone", 
  ADD COLUMN "formattedPhone" TEXT GENERATED ALWAYS AS ("countryCode" || ' ' || "phone") STORED;
```

**MySQL:**
```sql
-- Add this AFTER the CREATE TABLE statement
ALTER TABLE `User`
  DROP COLUMN `fullName`,
  ADD COLUMN `fullName` VARCHAR(255) GENERATED ALWAYS AS (CONCAT(firstName, ' ', lastName)) STORED;

ALTER TABLE `User`
  DROP COLUMN `formattedPhone`,
  ADD COLUMN `formattedPhone` VARCHAR(255) GENERATED ALWAYS AS (CONCAT(countryCode, ' ', phone)) STORED;
```

**SQLite:**
```sql
-- SQLite requires recreating the table with generated columns
-- This is more complex, see the full example below
```

### 4. Apply the Migration

```bash
npx prisma migrate dev
```

### 5. Use in Your Code

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Create a user - computed fields are automatically calculated
const user = await prisma.user.create({
  data: {
    firstName: 'John',
    lastName: 'Doe',
    countryCode: '+1',
    phone: '5551234567',
  },
})

console.log(user.fullName)         // "John Doe"
console.log(user.formattedPhone)   // "+1 5551234567"

// Query using computed fields
const users = await prisma.user.findMany({
  where: {
    fullName: {
      contains: 'John',
    },
  },
})

// Note: You CANNOT directly set computed fields
// This will fail at the database level:
// await prisma.user.create({
//   data: {
//     fullName: "Won't work",  // ❌ Error!
//   },
// })
```

## Complete Examples

### Example 1: Full Name Concatenation

**Use Case:** Combine first and last names into a searchable full name.

```prisma
model User {
  id        String  @id @default(cuid())
  firstName String
  lastName  String
  fullName  String? // Will be generated
}
```

**Migration (PostgreSQL):**
```sql
ALTER TABLE "User"
  DROP COLUMN "fullName",
  ADD COLUMN "fullName" TEXT GENERATED ALWAYS AS ("firstName" || ' ' || "lastName") STORED;
```

### Example 2: Price Calculations

**Use Case:** Automatically calculate total price with tax.

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  basePrice   Decimal  @db.Decimal(10, 2)
  taxRate     Decimal  @db.Decimal(5, 4)
  totalPrice  Decimal? @db.Decimal(10, 2) // Will be generated
}
```

**Migration (PostgreSQL):**
```sql
ALTER TABLE "Product"
  DROP COLUMN "totalPrice",
  ADD COLUMN "totalPrice" DECIMAL(10,2) GENERATED ALWAYS AS ("basePrice" * (1 + "taxRate")) STORED;
```

### Example 3: Email Domain Extraction

**Use Case:** Extract domain from email for filtering/grouping.

```prisma
model User {
  id           String  @id @default(cuid())
  email        String  @unique
  emailDomain  String? // Will be generated
}
```

**Migration (PostgreSQL):**
```sql
ALTER TABLE "User"
  DROP COLUMN "emailDomain",
  ADD COLUMN "emailDomain" TEXT GENERATED ALWAYS AS (
    SUBSTRING("email" FROM POSITION('@' IN "email") + 1)
  ) STORED;
```

**Migration (MySQL):**
```sql
ALTER TABLE `User`
  DROP COLUMN `emailDomain`,
  ADD COLUMN `emailDomain` VARCHAR(255) GENERATED ALWAYS AS (
    SUBSTRING(email, LOCATE('@', email) + 1)
  ) STORED;
```

## STORED vs VIRTUAL

### STORED Generated Columns
- Value is computed when row is inserted/updated
- Value is physically stored on disk
- **Pros:** Faster reads, can be indexed
- **Cons:** Takes disk space, slower writes
- **Use when:** You need to index the column or query it frequently

### VIRTUAL Generated Columns  
- Value is computed on-the-fly when queried
- Value is NOT stored on disk
- **Pros:** No disk space, faster writes
- **Cons:** Slower reads, cannot be indexed (in most databases)
- **Use when:** Disk space is a concern and the column isn't queried often

**Note:** PostgreSQL currently only supports STORED. MySQL and SQLite support both.

## Handling Existing Tables

If you're adding a generated column to an existing table with data:

```sql
-- PostgreSQL: Safe to add, will compute for existing rows
ALTER TABLE "User"
  ADD COLUMN "fullName" TEXT GENERATED ALWAYS AS ("firstName" || ' ' || "lastName") STORED;

-- MySQL: Same behavior
ALTER TABLE `User`
  ADD COLUMN `fullName` VARCHAR(255) GENERATED ALWAYS AS (CONCAT(firstName, ' ', lastName)) STORED;
```

## Limitations

1. **Cannot reference other tables:** Generated columns can only use columns from the same row
2. **Cannot be directly written to:** Database will reject attempts to set the value
3. **Database-specific syntax:** Expression syntax varies between databases
4. **Schema drift:** Prisma Introspection may not perfectly capture generated columns

## Best Practices

1. **Document in comments:** Add comments to your schema explaining which fields are generated
   ```prisma
   /// @generated ALWAYS AS (firstName || ' ' || lastName) STORED
   fullName String?
   ```

2. **Use nullable types:** Mark generated fields as optional (`String?`) to avoid TypeScript errors

3. **Test migrations:** Always test migrations in development before applying to production

4. **Keep expressions simple:** Complex expressions can impact write performance (for STORED columns)

5. **Consider indexing:** If you query by a generated column frequently, add an index:
   ```sql
   CREATE INDEX "User_fullName_idx" ON "User"("fullName");
   ```

## TypeScript Type Safety

To make generated fields read-only in TypeScript, you can use Prisma Client extensions:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient().$extends({
  result: {
    user: {
      // Make fullName readonly
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`
        },
      },
    },
  },
})

// Now TypeScript knows fullName is computed
const user = await prisma.user.create({
  data: {
    firstName: 'John',
    lastName: 'Doe',
    // fullName: 'test', // TypeScript error!
  },
})
```

## Troubleshooting

### Migration fails with "column already exists"

**Solution:** The migration file likely has both CREATE TABLE with the column AND ALTER TABLE to make it generated. Remove the column from CREATE TABLE:

```sql
-- ❌ Wrong
CREATE TABLE "User" (
  "fullName" TEXT
);
ALTER TABLE "User" ADD COLUMN "fullName" TEXT GENERATED...

-- ✅ Correct
CREATE TABLE "User" (
  -- fullName not in CREATE TABLE
);
ALTER TABLE "User" ADD COLUMN "fullName" TEXT GENERATED...
```

### Prisma Introspection removes generated columns

**Solution:** After introspection, manually add the generated columns back to your schema and create a migration to re-add them.

### Cannot insert/update generated column

**Solution:** This is expected! Remove the generated field from your `create` or `update` data.

## Future Prisma Support

This guide shows a workaround using manual migration editing. In the future, Prisma may add first-class support for generated columns with syntax like:

```prisma
// Potential future syntax (not currently supported)
model User {
  firstName String
  lastName  String
  fullName  String @db.generated("firstName || ' ' || lastName")
}
```

Track the feature request: https://github.com/prisma/prisma/issues/28378

## Additional Resources

- [PostgreSQL Generated Columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html)
- [MySQL Generated Columns](https://dev.mysql.com/doc/refman/8.0/en/create-table-generated-columns.html)
- [SQLite Generated Columns](https://www.sqlite.org/gencol.html)
- [Prisma Client Extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
