# Deferred

Items found while shaping this project that it does not do. Each is filed as a ticket at close-out unless a slice picks it up.

- **Pool options on the serverless `connect()`.** It has a fixed 20-second connect timeout and no pool settings (`packages/3-extensions/postgres/src/runtime/postgres-serverless.ts`). ADR 263 chose this deliberately; revisit only if a user asks.
- **`cursor` on SQLite and Supabase.** Postgres and the serverless client take `cursor`; SQLite and Supabase do not.
- **MongoDB `prepare` and `extensions`.** The MongoDB client has neither. MongoDB transactions belong to the "SQLite & MongoDB transactions" project (TML-2875).
- **Custom collection classes for MongoDB.** The MongoDB ORM has none. A new feature with its own design.
- **Plans for writes.** `create`, `update` and `delete` run immediately and have no plan form, so tools cannot inspect them.
- **Supabase's `pg` option ignores a `pg.Client`.** Found by the facade audit.
- **`mongoQuery({ contract })` does not validate.** It sits in the Mongo query-builder package, below the facade, and casts the value to its type without validating it. Every other entry that takes `{ contract }` validates once. Found in the slice 1 design review.
- **`enums` and `nativeEnums` on Supabase role-bound clients and their transactions.** The Postgres client and its transactions have them; Supabase's do not. Left out of slice 3, which covers query members only.
- **One `forRole(binding)` object in `SupabaseRuntime`.** The runtime has a separate method for each operation that runs under a role (query, execute, prepared query, prepared execute, and more). One object implemented once would replace them. Found in the slice 3 design review.
- **Members that return a promise throw synchronously after `close()`.** On every client, `query`, `execute`, `prepare`, `transaction` and `runtime().execute` throw before returning a promise once the client is closed, so `.catch()` on the result does not see the error. One change should make all of them reject instead. Found in the slice 4 code review.
- **`SqlExecutionStackWithDriver` is misnamed.** Its `driver` is optional, and the static entries pass a stack with no driver under this name. Found in the slice 4 design review.
