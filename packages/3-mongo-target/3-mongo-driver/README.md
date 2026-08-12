# @internal/driver-mongo

MongoDB driver for Prisma Next. Executes wire-protocol documents against a MongoDB connection.

## Responsibilities

- **Command execution**: Sends lowered wire-protocol documents to MongoDB and returns raw results
- **Connection management**: Creates and manages the MongoDB client connection

## Dependencies

- **Depends on**:
  - `@internal/mongo-core` (driver interface types)
