# @internal/mongo-orm

MongoDB ORM client for Prisma Next.

## Responsibilities

- **ORM client factory**: `mongoOrm()` creates a typed client with root-based collection accessors
- **Typed queries**: `findMany` with equality filters (`MongoWhereFilter`) and reference includes (`MongoIncludeSpec`)
- **Row type inference**: `InferFullRow` (scalar fields + embedded documents), `InferRootRow` (discriminated union for polymorphic roots), `IncludeResultFields`
- **Polymorphic narrowing**: Discriminator field carries literal variant values, enabling TypeScript `switch`/`if` narrowing
- **Execution interface**: Declares `MongoQueryExecutor` interface structurally satisfied by the runtime layer

## Dependencies

- **Depends on**:
  - `@internal/mongo-core` (contract types, row inference, query plan types)
  - `@internal/framework-components` (`AsyncIterableResult` return type, imported from `@internal/framework-components/runtime`)
- **Depended on by**:
  - `@internal/mongo-runtime` (structurally satisfies `MongoQueryExecutor`)
