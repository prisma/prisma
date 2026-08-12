# ADR 187 — MongoDB schema representation for migration diffing

## At a glance

A user adds an index to their Prisma schema:

```prisma
model User {
  email     String @unique
  lastName  String
  firstName String

  @@index([lastName, firstName])
}
```

The migration system must figure out what changed. It has two inputs: a **prior contract** (what the database looks like now) and the user's **desired contract**. It needs to compare them and produce a list of MongoDB commands — in this case, `createIndex` for the new compound index.

The problem is that these two inputs come from different places. Today, the prior state comes from a stored contract. In the future, it may come from introspecting a live database via `listIndexes()` and `listCollections()`. Those sources have different shapes. To diff them, both must be normalized into the same representation.

That representation is the **`MongoSchemaIR`**.

Here is what the IR looks like for the prior state (one collection, one index):

```ts
const prior: MongoSchemaIR = {
  collections: {
    users: new MongoSchemaCollection({
      name: 'users',
      indexes: [
        new MongoSchemaIndex({
          keys: [{ field: 'email', direction: 1 }],
          unique: true,
        }),
      ],
    }),
  },
};
```

The desired state adds the compound index. The planner diffs the two IRs and emits one operation: create `{ lastName: 1, firstName: 1 }`.

## Where this fits in the system

The IR has two producers and one consumer:

```text
Contract (prior version)         Live MongoDB instance (future)
    │                                     │
    ▼                                     ▼
contractToMongoSchemaIR()        introspectSchema() (future)
    │                                     │
    └──────────┐          ┌───────────────┘
               ▼          ▼
           MongoSchemaIR (prior state)
               │
               ▼
    Planner diffs prior IR vs desired contract
               │
               ▼
    MongoMigrationPlanOperation[]
```

Today, `contractToMongoSchemaIR(contract)` reads `contract.storage.collections` and constructs a `MongoSchemaIR`. In the future, live introspection will query `listIndexes()` and `listCollections()` to build an IR from the actual database. Both producers emit the same type, so the planner doesn't need to know where the IR came from.

## What MongoDB has that we need to model

MongoDB has a small set of server-side objects that migrations manage. Each one maps to an IR node:


| IR node                        | MongoDB concept                     | Example                                       |
| ------------------------------ | ----------------------------------- | --------------------------------------------- |
| `MongoSchemaCollection`        | A collection                        | `users`                                       |
| `MongoSchemaIndex`             | An index on a collection            | `{ email: 1 }`, unique                        |
| `MongoSchemaValidator`         | A `$jsonSchema` validator           | `{ bsonType: 'object', required: ['email'] }` |
| `MongoSchemaCollectionOptions` | Capped, timeseries, collation, etc. | `{ capped: true, size: 1048576 }`             |


All four node types are implemented. `MongoSchemaValidator` holds `$jsonSchema`, `validationLevel`, and `validationAction`. `MongoSchemaCollectionOptions` holds capped, timeseries, collation, clusteredIndex, and changeStreamPreAndPostImages.

## Decision

We represent MongoDB server-side state as `MongoSchemaIR` — an immutable, class-based AST with visitor dispatch. Each node represents one kind of server-side object. The design is motivated by three properties explained below: immutability, exhaustive visitor dispatch, and structural identity for indexes.

### The nodes

The top-level container is a plain interface — a lookup from collection name to collection node:

```ts
interface MongoSchemaIR {
  readonly collections: Record<string, MongoSchemaCollection>;
}
```

An empty IR (for a new project with no prior contract) is `{ collections: {} }`.

A collection groups its indexes, validator, and options:

```ts
class MongoSchemaCollection extends MongoSchemaNode {
  readonly kind = 'collection' as const;
  readonly name: string;
  readonly indexes: ReadonlyArray<MongoSchemaIndex>;
  readonly validator?: MongoSchemaValidator;
  readonly options?: MongoSchemaCollectionOptions;
}
```

An index is defined by its keys and options:

```ts
class MongoSchemaIndex extends MongoSchemaNode {
  readonly kind = 'index' as const;
  readonly keys: ReadonlyArray<MongoIndexKey>;
  readonly unique: boolean;
  readonly sparse?: boolean;
  readonly expireAfterSeconds?: number;
  readonly partialFilterExpression?: Record<string, unknown>;
  readonly wildcardProjection?: Record<string, 0 | 1>;
  readonly collation?: Record<string, unknown>;
  readonly weights?: Record<string, number>;
  readonly default_language?: string;
  readonly language_override?: string;
}
```

`MongoIndexKey` is `{ field: string; direction: MongoIndexKeyDirection }`, where `MongoIndexKeyDirection` is `1 | -1 | 'text' | '2dsphere' | '2d' | 'hashed'`. This type is defined in `@internal/mongo-contract` and shared between contract types and the schema IR.

### Immutability

Every node calls `Object.freeze(this)` in its constructor. The IR is a snapshot — it must not change after construction.

This matters because the planner traverses both prior and desired IRs during diffing. Accidental mutation would produce subtle, hard-to-diagnose comparison bugs. `readonly` type annotations catch some of this at compile time, but `Object.freeze()` catches it at runtime too.

### Visitor dispatch

Each node extends `MongoSchemaNode` and implements `accept<R>(visitor: MongoSchemaVisitor<R>): R`. The visitor interface has one method per node type:

```ts
interface MongoSchemaVisitor<R> {
  collection(node: MongoSchemaCollection): R;
  index(node: MongoSchemaIndex): R;
  validator(node: MongoSchemaValidator): R;
  collectionOptions(node: MongoSchemaCollectionOptions): R;
}
```

Adding a new node type requires adding a method to this interface. Every existing visitor implementation gets a compile error until it handles the new case. This is the same exhaustiveness guarantee used by the DDL command visitors and filter expression visitors elsewhere in the codebase.

### Structural identity for indexes

Two indexes are equivalent if and only if they have the same keys (fields, order, directions) and the same semantic options (unique, sparse, TTL, partial filter expression). **Name is not part of identity.** An index named `email_1` and an index named `idx_users_email` with identical keys and options are functionally the same index — the planner treats them as a no-op.

This is a deliberate choice. MongoDB auto-generates index names, users can override them, and different environments may have different names for the same index. Making name part of identity would cause unnecessary drop-and-create cycles. This follows [ADR 009 (Deterministic Naming Scheme)](ADR%20009%20-%20Deterministic%20Naming%20Scheme.md), which establishes that names are derived metadata, not identity. The matching algorithm is detailed in [ADR 189](ADR%20189%20-%20Structural%20index%20matching%20for%20MongoDB%20migrations.md).

## Package placement

`@internal/mongo-schema-ir` in `packages/2-mongo-family/3-tooling/mongo-schema-ir/`, the tooling layer on the migration plane. This mirrors `@internal/sql-schema-ir` in the SQL domain.

## Alternatives considered

### Plain interfaces instead of classes

`SqlSchemaIR` uses plain TypeScript interfaces (`SqlTableIR`, `SqlColumnIR`). We considered the same approach. We chose classes because:

- **Runtime immutability.** `Object.freeze()` is enforced at runtime, not just via `readonly` annotations. The IR flows through diffing and serialization — runtime freezing catches mutation bugs that type-level `readonly` cannot.
- **Visitor dispatch.** `accept(visitor)` on each node is cleaner than a `switch (node.kind)` in every consumer. Adding a node type is a compile error in all visitors, not a silent fallthrough.
- **Consistency.** Every other AST in the Mongo family (queries, pipeline stages, filter expressions, DDL commands) uses this pattern. A developer working on Mongo migrations encounters the same idioms they already know.

The trade-off is that class-based AST nodes are heavier than plain objects. This is acceptable because schema IRs are small (tens of collections, hundreds of indexes at most) and short-lived (constructed for one planning operation, then discarded).

### A shared "document family" IR

We considered a generic `DocumentSchemaIR` shared across all document databases (Mongo, DynamoDB, etc.). We rejected this because MongoDB's server-side objects (validators, capped collections, timeseries, collation) are specific enough that a generic abstraction would either be too sparse to be useful or too leaky to be portable. Each document target provides its own IR, and the framework's `TargetMigrationsCapability.contractToSchema()` returns `unknown` — the planner knows the concrete type.

### Define only the nodes needed today

We considered defining nodes only for indexes and adding collection/validator/options nodes later. We chose to define the full visitor interface up front so that future additions produce compile errors in existing code. All four node types (`MongoSchemaCollection`, `MongoSchemaIndex`, `MongoSchemaValidator`, `MongoSchemaCollectionOptions`) are now implemented.
