# Ork Basic Example

This example demonstrates the high-level Prisma-like API with generated client code, PostgreSQL, and Testcontainers.

## Features Demonstrated

- ✅ PostgreSQL setup with Testcontainers
- ✅ Generated Ork client with typed model operations
- ✅ Schema parsing and client code generation
- ✅ Programmatic migrations via `OrkMigrate`
- ✅ Type-safe CRUD operations (`create`, `findUnique`, `findMany`, `update`, `count`)
- ✅ Relation loading with `include`
- ✅ Filtering with `where` clauses (including relation filters: `some`, `every`, `none`, `is`, `isNot`)
- ✅ Ordering with `orderBy`
- ✅ Transactions with `$transaction`

## Prerequisites

- Node.js >= 20
- Docker (for Testcontainers)
- pnpm >= 10

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate the typed client:
   ```bash
   pnpm generate
   ```

   This runs `ork generate` to create the typed client in `./.ork/` based on your `schema.prisma`.

3. Run the demo:
   ```bash
   pnpm demo
   ```

The demo will:
1. Start a PostgreSQL container via Testcontainers
2. Create a Ork client with PostgreSQL dialect
3. Parse the schema and generate migrations
4. Apply migrations to create tables
5. Perform CRUD operations using the generated client
6. Demonstrate relation loading with `include`
7. Demonstrate transactions
8. Clean up and shut down

## Schema

The schema includes three models with relations:

- **User**: Has many posts and one profile
- **Profile**: Belongs to one user (one-to-one)
- **Post**: Belongs to one user as author (many-to-one)

## Example Usage

```typescript
import { OrkClient } from './.ork/index.js'

const client = new OrkClient(dialect)
await client.$connect()

// Create a user with type safety
const user = await client.user.create({
  data: {
    email: 'alice@example.com',
    name: 'Alice',
  }
})

// Query with relation loading
const userWithProfile = await client.user.findUnique({
  where: { id: user.id },
  include: { profile: true }
})

// Filter and order
const publishedPosts = await client.post.findMany({
  where: { published: true },
  orderBy: { createdAt: 'desc' }
})

// Relation filtering
const usersWithPublishedPosts = await client.user.findMany({
  where: { posts: { some: { published: true } } }
})
```

## Client Generation

The `ork generate` command reads `schema.prisma` and generates:

- `.ork/index.ts` - Main client with model delegates
- `.ork/models.d.ts` - TypeScript type definitions for models
- `.ork/schema.d.ts` - Database schema types

All operations are fully type-safe based on your schema.

## Next Steps

- Explore the generated client code in `./.ork/`
- Modify the schema and regenerate to see type changes
- Compare with the `kysely` example to see low-level `$kysely` API usage
- Try filtering, pagination, and complex queries
- Test nested writes (Phase 1+)
