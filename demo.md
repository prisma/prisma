# Ork Demo Guide

This guide walks through demonstrating Ork's end-to-end workflow: schema parsing, code generation, migrations, and CRUD operations.

## Prerequisites

- **Node.js** 20+
- **pnpm** installed (`npm install -g pnpm`)
- **Docker Desktop** running (for PostgreSQL via Testcontainers)

## Setup

From the repository root:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Key Files to Explore

| File | Description |
|------|-------------|
| `examples/basic/schema.prisma` | Prisma schema with User, Post, Profile models |
| `examples/basic/ork.config.ts` | Ork configuration (datasource, generator output) |
| `examples/basic/generated/index.ts` | Generated type-safe client (~1600 lines) |
| `examples/basic/demo.ts` | Demo script showing all CRUD operations |

### Schema Highlights (`examples/basic/schema.prisma`)

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]      // One-to-many relation
  profile   Profile?    // One-to-one relation
}
```

## Demo Commands

### 1. Show CLI Help

```bash
# From repo root
node packages/cli/dist/bin.js --help
node packages/cli/dist/bin.js migrate --help
```

### 2. Generate Client from Schema

```bash
cd examples/basic

# Generate the client
node ../../packages/cli/dist/bin.js generate
```

Output:
```
- Generating Ork client...
✔ Client generation completed successfully!
```

### 3. Explore Generated Types

Open `examples/basic/generated/index.ts` and show:

- **Lines 14-40**: Generated interfaces (`User`, `Profile`, `Post`)
- **Lines 52-99**: Filter types (`NumericFilter`, `StringFilter`, `DateTimeFilter`)
- **Lines 163-174**: Where input with AND/OR/NOT support
- **Lines 184-194**: Create/Update input types
- **Lines 250-270**: Include types for relation loading

### 4. Run Full CRUD Demo

```bash
cd examples/basic
pnpm demo
```

Or from repo root:
```bash
pnpm demo:postgres
```

## What the Demo Shows

### Migrations
- Auto-generates DDL from schema
- Creates tables with proper types (`serial`, `timestamptz`, etc.)
- Creates unique indexes

### CRUD Operations

| Operation | Code Example |
|-----------|--------------|
| **Create** | `client.user.create({ data: { email: 'alice@example.com', name: 'Alice' } })` |
| **Read** | `client.user.findUnique({ where: { id: 1 } })` |
| **Update** | `client.post.update({ where: { id: 1 }, data: { published: true } })` |
| **Count** | `client.post.count({ where: { published: true } })` |

### Relations with `include`

```typescript
const userWithProfile = await client.user.findUnique({
  where: { id: 1 },
  include: { profile: true }
})
// Returns user with nested profile object
```

### Relation filtering

```typescript
// Users with at least one published post
const usersWithPublishedPosts = await client.user.findMany({
  where: { posts: { some: { published: true } } }
})

// Users where every post is published
const usersWithAllPublishedPosts = await client.user.findMany({
  where: { posts: { every: { published: true } } }
})

// Users with no published posts
const usersWithNoPublishedPosts = await client.user.findMany({
  where: { posts: { none: { published: true } } }
})

// Users that have a profile
const usersWithProfiles = await client.user.findMany({
  where: { profile: { isNot: null } }
})
```

### Transactions

```typescript
await client.$transaction(async (trx) => {
  await trx.user.update({ where: { id: 2 }, data: { name: 'Bob Smith' } })
  await trx.post.create({ data: { title: 'My Post', authorId: 2 } })
})
```

### Kysely Escape Hatch

```typescript
// Access underlying Kysely instance for complex queries
const result = await client.$kysely
  .selectFrom('User')
  .innerJoin('Post', 'Post.authorId', 'User.id')
  .select(['User.name', 'Post.title'])
  .execute()
```

## Expected Output

```
🚀 Starting Ork Basic Example (High-Level API)

📦 Starting PostgreSQL container...
✅ PostgreSQL running at: postgres://test:test@localhost:55006/test

🔧 Creating Kysely dialect...
✅ Kysely dialect created

🔧 Creating Ork client...
✅ Ork client connected

📝 Running migrations...
Generated migration SQL:
create table "User" ("id" serial primary key, ...)
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_User_email" ON "User" ("email")
...
✅ Migrations applied

📊 Creating sample data with high-level API...
✅ Created user: { id: 1, email: 'alice@example.com', name: 'Alice', ... }
✅ Created profile: { id: 1, bio: 'Software engineer...', userId: 1 }
✅ Created post: { id: 1, title: 'Getting Started with Ork', ... }

🔍 Querying user with profile relation...
User with profile: {
  "id": 1,
  "email": "alice@example.com",
  "profile": { "id": 1, "bio": "Software engineer...", "userId": 1 }
}

🔍 Finding published posts...
Published posts: [{ id: 1, title: 'Getting Started with Ork', published: true, ... }]

📝 Updating post...
✅ Updated post: { id: 2, published: true, ... }

📊 Creating additional user...
✅ Created user: { id: 2, email: 'bob@example.com', name: 'Bob', ... }
✅ Created profile: { id: 2, bio: 'Database enthusiast', userId: 2 }
✅ Created user: { id: 3, email: 'charlie@example.com', name: null, ... }

💰 Testing transaction for atomic operations...
✅ Transaction completed (user updated & post created atomically)

🔍 Relation filtering examples...
Users with published posts: ['alice@example.com', 'bob@example.com']
Users where every post is published: ['bob@example.com', 'alice@example.com']
Users with no published posts: ['charlie@example.com']
Users with profiles: ['alice@example.com', 'bob@example.com']

📊 Final counts:
Users: 3
Posts: 3
Published posts: 3

🎉 Demo completed successfully!
```

## Troubleshooting

### Docker not running
```
Error: Could not find a working container runtime strategy
```
**Fix**: Start Docker Desktop and wait for it to fully initialize.

### Port conflicts
If you see connection errors, ensure no other PostgreSQL instances are running on conflicting ports.

### Build errors
```bash
# Clean and rebuild
pnpm build
```

## Architecture Overview

```
schema.prisma
     │
     ▼
┌─────────────────┐
│ @ork/schema │  Parse .prisma files
│    -parser      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ @ork/field  │  Generate dialect-specific
│   -translator   │  type transformations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ @ork/client │  Generate typed client with
│                 │  embedded CRUD operations
└────────┬────────┘
         │
         ▼
   generated/index.ts
         │
         ▼
┌─────────────────┐
│    Kysely       │  Execute queries against
│                 │  PostgreSQL/SQLite/MySQL
└─────────────────┘
```
