feat(client): add PostgreSQL extension support for custom type casting in raw queries

This change introduces support for PostgreSQL extensions like ParadeDB that require
custom type casting syntax in raw queries. Previously, Prisma's parameter binding
would strip custom type casting, causing XX000 errors.

Key changes:
- Add createCustomTypeCast() helper function for safe parameter type casting
- Modify rawQueryArgsMapper to preserve custom type casting for PostgreSQL/CockroachDB
- Export new API through @prisma/client package
- Add comprehensive tests and documentation

The solution maintains SQL injection protection while enabling PostgreSQL extension
functionality. It's fully backward compatible and only processes parameters when
custom type casting is explicitly requested.

Example usage:
```typescript
await prisma.$queryRawUnsafe(
  `SELECT * FROM table WHERE column &&& $1`,
  createCustomTypeCast('search term', '::pdb.boost(5)')
)
```

Fixes PostgreSQL extension compatibility issues with parameterized raw queries.