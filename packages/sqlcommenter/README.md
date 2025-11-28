# @prisma/sqlcommenter

Type definitions for SQL commenter plugins in Prisma Client.

## Overview

This package provides TypeScript types for creating SQL commenter plugins that add metadata to SQL queries as comments. The comments follow the [sqlcommenter format](https://google.github.io/sqlcommenter/) developed by Google.

SQL comments are useful for:

- **Observability**: Correlate database queries with application traces using `traceparent`
- **Query Insights**: Tag queries with metadata for analysis in database monitoring tools
- **Debugging**: Add custom context to queries for easier troubleshooting

## Installation

```bash
npm install @prisma/sqlcommenter
```

## Usage

### Creating a Plugin

A SQL commenter plugin is a function that receives query context and returns key-value pairs to be added as comments:

```typescript
import type { SqlCommenterPlugin, SqlCommenterContext } from '@prisma/sqlcommenter'

const myPlugin: SqlCommenterPlugin = (context: SqlCommenterContext) => {
  return {
    application: 'my-app',
    version: '1.0.0',
  }
}
```

### Using Plugins with PrismaClient

Pass your plugins to the `comments` option when creating a PrismaClient instance:

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const prisma = new PrismaClient({
  adapter,
  comments: [myPlugin],
})
```

### Query Context

Plugins receive a `SqlCommenterContext` object with information about the query being executed:

```typescript
interface SqlCommenterContext {
  query: SqlCommenterQueryInfo
}

type SqlCommenterQueryInfo =
  | { type: 'single'; modelName?: string; action: string; query: unknown }
  | { type: 'compacted'; queries: SqlCommenterSingleQueryInfo[] }
```

- **`type: 'single'`**: A single Prisma query is being executed
  - `modelName`: The model being queried (e.g., `"User"`, `"Post"`). Undefined for raw queries.
  - `action`: The Prisma operation (e.g., `"findMany"`, `"createOne"`, `"queryRaw"`)
  - `query`: The full query object with selection and arguments

- **`type: 'compacted'`**: Multiple queries have been batched into a single SQL statement (e.g., automatic `findUnique` batching or explicit `$transaction` batches)

### Example: Custom Application Tags

```typescript
import type { SqlCommenterPlugin } from '@prisma/sqlcommenter'

const applicationTags: SqlCommenterPlugin = (context) => {
  const tags: Record<string, string> = {
    application: 'my-service',
    environment: process.env.NODE_ENV ?? 'development',
  }

  if (context.query.type === 'single' && context.query.modelName) {
    tags.model = context.query.modelName
    tags.operation = context.query.action
  }

  return tags
}
```

### Example: Async Context Propagation

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SqlCommenterPlugin } from '@prisma/sqlcommenter'

const traceStorage = new AsyncLocalStorage<{ route: string }>()

const traceContext: SqlCommenterPlugin = () => {
  const store = traceStorage.getStore()
  if (store?.route) {
    return { route: store.route }
  }
  return {}
}
```

## Output Format

The plugin outputs are merged, sorted by key, URL-encoded, and formatted according to the [sqlcommenter specification](https://google.github.io/sqlcommenter/spec/):

```sql
SELECT "id", "name" FROM "User" /*application='my-app',environment='production',model='User'*/
```

## API Reference

### `SqlCommenterPlugin`

```typescript
interface SqlCommenterPlugin {
  (context: SqlCommenterContext): Record<string, string>
}
```

A function that receives query context and returns key-value pairs. Return an empty object to add no comments for a particular query.

### `SqlCommenterContext`

```typescript
interface SqlCommenterContext {
  query: SqlCommenterQueryInfo
}
```

Context provided to plugins containing information about the query.

### `SqlCommenterQueryInfo`

```typescript
type SqlCommenterQueryInfo =
  | ({ type: 'single' } & SqlCommenterSingleQueryInfo)
  | { type: 'compacted'; queries: SqlCommenterSingleQueryInfo[] }
```

Information about the query or queries being executed.

### `SqlCommenterSingleQueryInfo`

```typescript
interface SqlCommenterSingleQueryInfo {
  modelName?: string
  action: string
  query: unknown
}
```

Information about a single Prisma query.

## Notes

- Plugins are called synchronously in array order
- Later plugins override earlier ones if they return the same key
- Keys and values are URL-encoded per the sqlcommenter spec
- Single quotes in values are escaped as `\'`
- Comments are appended to the end of SQL queries

## License

Apache-2.0
