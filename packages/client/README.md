# @refract/client

TypeScript-native client runtime for Refract ORM with two clean usage paths.

## Usage Patterns

### Blessed Path (Recommended)

Use `unplugin-refract` for automatic type discovery:

```typescript
// unplugin-refract makes this import work seamlessly
import { RefractClient } from '@refract/client'
import { PostgresDialect } from 'kysely'

const client = new RefractClient(new PostgresDialect({ connectionString: process.env.DATABASE_URL }))

// Types are automatically available via unplugin virtual modules
await client.user.findMany()
```

### Manual Fallback

When unplugin isn't available, import types explicitly:

```typescript
import { RefractClient } from '@refract/client'
import { PostgresDialect } from 'kysely'
import type { DatabaseSchema } from './.refract/types'

const client = new RefractClient<DatabaseSchema>(new PostgresDialect({ connectionString: process.env.DATABASE_URL }))

await client.user.findMany()
```

## Relation Loading

Load related data using the `include` option:

```typescript
// Load user with their posts
const post = await client.post.findUnique({
  where: { id: 1 },
  include: { user: true }
})
// post.user is now populated with User data

// Load multiple posts with their authors
const posts = await client.post.findMany({
  where: { published: true },
  include: { user: true }
})
// Each post.user contains the related User
```

**Current Support (Phase 0)**:
- ✅ Many-to-one relations (e.g., Post → User)
- ✅ One-to-one relations
- ✅ One-to-many relations (e.g., User → Post[])
- ✅ Relation filters in `where` (`some`, `every`, `none`, `is`, `isNot`)
- ⏳ Nested includes - Coming in Phase 1

## Direct Kysely Access

Access the underlying Kysely instance for advanced queries:

```typescript
// Direct Kysely access for complex queries
const result = await client.$kysely.selectFrom('user').innerJoin('post', 'user.id', 'post.userId').selectAll().execute()
```

## Installation

```bash
npm install @refract/client kysely
npm install unplugin-refract # Recommended for best experience
```

## Client Code Generation

- Runtime usage imports `RefractClient` from this package and passes a Kysely dialect directly.
- Build tools can emit client code ahead of time via the exported `ClientGenerator` class. This is what the CLI and `unplugin-refract` consume to bake CRUD operations and field translations ahead of time.
- Lower-level type generation utilities remain available through `TypeGenerator` for bespoke workflows.
