# PostgreSQL Extension Support for Raw Queries

This document describes Prisma's support for PostgreSQL extensions that require custom type casting in raw queries, such as ParadeDB.

## Problem

PostgreSQL extensions like ParadeDB use custom type casting syntax that Prisma's parameter binding system doesn't understand. For example:

```sql
SELECT * FROM table WHERE column &&& $1::pdb.boost(5)
```

Previously, when using `$queryRawUnsafe` with parameters, Prisma would strip the custom type casting, causing errors like:

```
Raw query failed. Code: XX000 Message: ERROR: The right-hand side of the &&&(field, TEXT) operator must be a text value
```

## Solution

Prisma now supports custom type casting through the `createCustomTypeCast` helper function.

### Usage

```typescript
import { PrismaClient, createCustomTypeCast } from '@prisma/client'

const prisma = new PrismaClient()

// ParadeDB search with custom type casting
const results = await prisma.$queryRawUnsafe(
  `
  SELECT
    sv."songId",
    AVG(pdb.score(sv.id))::numeric as "avgScore"
  FROM song_variants sv
  WHERE
    (sv."searchTitle" &&& $1
     OR sv."lyrics" &&& $2
     OR sv."searchTitle" &&& $3
     OR sv."lyrics" &&& $4)
    AND sv."deletedAt" IS NULL
  GROUP BY sv."songId"
  ORDER BY AVG(pdb.score(sv.id)) DESC
  LIMIT 10
  `,
  createCustomTypeCast('search term', '::pdb.boost(5)'),
  createCustomTypeCast('search term', '::pdb.boost(5)'),
  createCustomTypeCast('search term', '::pdb.fuzzy(1)::pdb.boost(3)'),
  createCustomTypeCast('search term', '::pdb.fuzzy(1)::pdb.boost(3)')
)
```

### API

#### `createCustomTypeCast(value: unknown, typeCast: string): CustomTypeCastParameter`

Creates a parameter that preserves PostgreSQL extension-specific type casting.

- `value`: The actual parameter value
- `typeCast`: The type casting syntax (e.g., `'::pdb.boost(5)'`, `'::pdb.fuzzy(1)::pdb.boost(3)'`)

#### `CustomTypeCastParameter`

```typescript
interface CustomTypeCastParameter {
  value: unknown
  typeCast: string
}
```

### Examples

#### Basic ParadeDB Search

```typescript
const searchTerm = 'javascript'

const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM articles WHERE content &&& $1`,
  createCustomTypeCast(searchTerm, '::pdb.boost(5)')
)
```

#### Complex ParadeDB Query

```typescript
const query = 'machine learning'

const results = await prisma.$queryRawUnsafe(
  `
  SELECT title, pdb.score(id) as relevance_score
  FROM articles 
  WHERE content &&& $1 OR content &&& $2
  ORDER BY pdb.score(id) DESC
  `,
  createCustomTypeCast(query, '::pdb.boost(5)'),
  createCustomTypeCast(query, '::pdb.fuzzy(1)::pdb.boost(3)')
)
```

#### Mixed Parameters

```typescript
const results = await prisma.$queryRawUnsafe(
  `
  SELECT * FROM articles 
  WHERE content &&& $1 
    AND created_at > $2 
    AND category = $3
  `,
  createCustomTypeCast('search term', '::pdb.boost(5)'),
  new Date('2023-01-01'),
  'technology'
)
```

### Supported Providers

This feature is available for:
- PostgreSQL (`postgresql`)
- CockroachDB (`cockroachdb`)

For other database providers, the custom type casting parameters are ignored and treated as regular parameters.

### Limitations

1. Only works with `$queryRawUnsafe` - template literal queries (`$queryRaw`) are not supported
2. Only available for PostgreSQL-compatible providers
3. The type casting syntax must be valid PostgreSQL syntax

### Migration from Manual String Interpolation

**Before (unsafe):**
```typescript
const searchTerm = 'user input'
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM table WHERE column &&& '${searchTerm}'::pdb.boost(5)`
)
```

**After (safe):**
```typescript
const searchTerm = 'user input'
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM table WHERE column &&& $1`,
  createCustomTypeCast(searchTerm, '::pdb.boost(5)')
)
```

The new approach maintains SQL injection protection while supporting custom type casting.