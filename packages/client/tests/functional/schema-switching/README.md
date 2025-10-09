## Testing PostgreSQL Schema Switching

This test suite validates the dynamic PostgreSQL schema switching functionality via the `.schema()` method.

The `.schema()` method enables multi-tenant applications where each tenant has isolated data in separate PostgreSQL schemas while sharing the same database connection pool.

```typescript
const prisma = new PrismaClient()
const tenant1 = prisma.schema('tenant_1')
const tenant2 = prisma.schema('tenant_2')
// Both share the same connection pool
```

How to run these tests?

```sh
pnpm test:functional schema-switching
```
