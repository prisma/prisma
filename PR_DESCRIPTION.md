# feat(client): Add PostgreSQL extension support for custom type casting in raw queries

## Problem

PostgreSQL extensions like ParadeDB use custom type casting syntax that Prisma's parameter binding system doesn't understand. When using `$queryRawUnsafe` with parameters that require custom type casting (e.g., `$1::pdb.boost(5)`), Prisma strips the type casting, causing errors:

```
Raw query failed. Code: XX000 Message: ERROR: The right-hand side of the &&&(field, TEXT) operator must be a text value
```

This forces developers to use unsafe string interpolation or write custom escaping functions, both of which are error-prone and defeat the purpose of parameterized queries.

## Solution

This PR introduces support for PostgreSQL extension-specific type casting through a new `createCustomTypeCast` helper function that preserves custom type casting syntax while maintaining SQL injection protection.

### Key Changes

1. **New utility module** (`preserveCustomTypeCasting.ts`):
   - `createCustomTypeCast(value, typeCast)` - Creates a parameter with custom type casting
   - `processCustomTypeCastParameters()` - Processes parameters to preserve type casting
   - `hasCustomTypeCasting()` - Type guard for custom type cast parameters

2. **Enhanced raw query processing** (`rawQueryArgsMapper.ts`):
   - Modified to detect and process custom type cast parameters
   - Only applies to PostgreSQL and CockroachDB providers
   - Maintains backward compatibility

3. **Exported API** (`runtime/index.ts`):
   - Exports `createCustomTypeCast` and `CustomTypeCastParameter` type
   - Available to end users through `@prisma/client`

### Usage Example

**Before (unsafe):**
```typescript
const searchTerm = 'user input'
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM table WHERE column &&& '${searchTerm}'::pdb.boost(5)`
)
```

**After (safe):**
```typescript
import { createCustomTypeCast } from '@prisma/client'

const searchTerm = 'user input'
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM table WHERE column &&& $1`,
  createCustomTypeCast(searchTerm, '::pdb.boost(5)')
)
```

### ParadeDB Example

```typescript
const results = await prisma.$queryRawUnsafe(
  `
  SELECT sv."songId", AVG(pdb.score(sv.id))::numeric as "avgScore"
  FROM song_variants sv
  WHERE (sv."searchTitle" &&& $1 OR sv."lyrics" &&& $2)
  GROUP BY sv."songId"
  ORDER BY AVG(pdb.score(sv.id)) DESC
  `,
  createCustomTypeCast(query, '::pdb.boost(5)'),
  createCustomTypeCast(query, '::pdb.fuzzy(1)::pdb.boost(3)')
)
```

## Testing

- ✅ Unit tests for all new utility functions
- ✅ Integration tests for ParadeDB use cases
- ✅ Backward compatibility tests
- ✅ Cross-provider compatibility tests

## Impact

- **Breaking Changes**: None - fully backward compatible
- **New Features**: PostgreSQL extension support for raw queries
- **Security**: Maintains SQL injection protection while enabling custom type casting
- **Performance**: Minimal overhead - only processes parameters when custom type casting is detected

## Documentation

- Added comprehensive documentation in `PARADEDB_SUPPORT.md`
- Includes usage examples, API reference, and migration guide
- Documents limitations and supported providers

Closes #[issue-number]