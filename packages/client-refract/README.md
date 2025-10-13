# @refract/client-refract

Unified TypeScript-native client for Refract ORM with two clean usage paths.

## Usage Patterns

### Blessed Path (Recommended)

Use `unplugin-refract` for automatic type discovery:

```typescript
// unplugin-refract makes this import work seamlessly
import { RefractClient } from '@refract/client-refract'
import { PostgresJSDialect } from 'kysely'

const client = new RefractClient(new PostgresJSDialect({ connectionString: process.env.DATABASE_URL }))

// Types are automatically available via unplugin virtual modules
await client.user.findMany()
```

### Manual Fallback

When unplugin isn't available, import types explicitly:

```typescript
import { RefractClient } from '@refract/client-refract'
import { PostgresJSDialect } from 'kysely'
import type { DatabaseSchema } from './.refract/types'

const client = new RefractClient<DatabaseSchema>(new PostgresJSDialect({ connectionString: process.env.DATABASE_URL }))

await client.user.findMany()
```

## Direct Kysely Access

Access the underlying Kysely instance for advanced queries:

```typescript
// Direct Kysely access for complex queries
const result = await client.$kysely.selectFrom('user').innerJoin('post', 'user.id', 'post.userId').selectAll().execute()
```

## Installation

```bash
npm install @refract/client-refract kysely
npm install unplugin-refract # Recommended for best experience
```
