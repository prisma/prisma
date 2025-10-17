# Refract Kysely Example

This example demonstrates the low-level `$kysely` API for direct Kysely query access without generated client code.

## Features Demonstrated

- ✅ PostgreSQL setup with Testcontainers
- ✅ Refract client instantiation with Kysely dialect
- ✅ Schema parsing and migration generation
- ✅ Programmatic migrations via `RefractMigrate`
- ✅ Direct CRUD operations via `$kysely`
- ✅ Manual type definitions for database schema
- ✅ Relation loading (manual with Kysely queries)
- ✅ Transactions with `$transaction`

## Prerequisites

- Node.js >= 20
- Docker (for Testcontainers)
- pnpm >= 9

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the demo:
   ```bash
   pnpm demo
   ```

The demo will:
1. Start a PostgreSQL container via Testcontainers
2. Create a Refract client with PostgreSQL dialect
3. Parse the schema and generate migrations
4. Apply migrations to create tables
5. Perform CRUD operations using raw Kysely queries
6. Demonstrate manual relation handling
7. Demonstrate transactions
8. Clean up and shut down

## Schema

The schema includes three models with relations:

- **User**: Has many posts and one profile
- **Profile**: Belongs to one user (one-to-one)
- **Post**: Belongs to one user as author (many-to-one)

## Example Usage

```typescript
import { RefractClientBase } from '@refract/client'
import type { Generated } from 'kysely'

// Define database schema types manually
interface DatabaseSchema {
  User: {
    id: Generated<number>
    email: string
    name: string | null
    createdAt: Date
    updatedAt: Date
  }
  // ... other models
  [modelName: string]: Record<string, any>
}

const client = new RefractClientBase<DatabaseSchema>(dialect)
await client.$connect()

// Create a user with direct Kysely query
const user = await client.$kysely
  .insertInto('User')
  .values({
    email: 'alice@example.com',
    name: 'Alice',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  .returning(['id', 'email', 'name'])
  .executeTakeFirstOrThrow()

// Query with Kysely API
const users = await client.$kysely
  .selectFrom('User')
  .selectAll()
  .where('email', '=', 'alice@example.com')
  .execute()

// Relations require manual queries
const posts = await client.$kysely
  .selectFrom('Post')
  .selectAll()
  .where('authorId', '=', user.id)
  .execute()
```

## When to Use This Approach

The `$kysely` API is ideal for:

- **Maximum flexibility**: Complex queries that benefit from Kysely's full API
- **Performance tuning**: Direct control over SQL generation
- **Learning**: Understanding how Refract works under the hood
- **Gradual migration**: Use raw Kysely while transitioning from another ORM
- **Power users**: Teams already familiar with Kysely who want explicit control

For most applications, prefer the high-level API shown in the `basic` example.

## Comparison with Basic Example

| Feature | `kysely` Example | `basic` Example |
|---------|-----------------|-----------------|
| Client Type | `RefractClientBase<T>` | Generated `RefractClient` |
| Type Definitions | Manual interface | Auto-generated from schema |
| Query Style | `client.$kysely.insertInto()` | `client.user.create()` |
| Relations | Manual separate queries | Automatic with `include` |
| Code Generation | Not required | Required (`refract generate`) |
| Use Case | Power users, complex queries | Prisma-like DX, rapid development |

## Next Steps

- Compare with the `basic` example to see the high-level API
- Explore Kysely's query builder capabilities
- Try complex joins and aggregations
- Experiment with raw SQL queries via `sql` template tag
- Use `$kysely` alongside generated client operations for hybrid queries
