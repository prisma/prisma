# @internal/mongo-schema-ir

MongoDB Schema Intermediate Representation (IR) for migration diffing.

## Overview

This package defines the in-memory representation of MongoDB collection schemas used by the migration planner to diff desired vs. actual state. It provides an immutable AST of collections, indexes, validators, and collection options, plus comparison utilities for index equivalence.

## Responsibilities

- **Schema AST nodes**: `MongoSchemaIR` (root), `MongoSchemaCollection`, `MongoSchemaIndex`, `MongoSchemaValidator`, `MongoSchemaCollectionOptions` — frozen, visitable AST nodes representing MongoDB schema elements. `MongoSchemaIR` is the root node holding collections as sorted children with name-based lookup via `collection(name)`.
- **Index options**: `MONGO_INDEX_OPTION_KEYS` lists the options that tell two indexes on the same keys apart. `indexesEquivalent()` compares two `MongoSchemaIndex` nodes by their keys and those options. `indexLookupKey()` turns an index into a string key from the same list; the planner and the verifier match indexes by it, and the migration `createIndex` postcheck checks every option in the list.
- **Deep equality**: `deepEqual()` provides key-order-sensitive structural comparison for MongoDB values. For key-order-independent comparison, use `canonicalize()`.
- **Canonical serialization**: `canonicalize()` produces a key-order-independent string representation of values. Used for index lookup keys.
- **Visitor pattern**: `MongoSchemaVisitor<R>` enables extensible traversal without modifying AST nodes.

## Usage

```typescript
import {
  MongoSchemaIR,
  MongoSchemaCollection,
  MongoSchemaIndex,
  indexesEquivalent,
} from '@internal/mongo-schema-ir';

const index = new MongoSchemaIndex({
  keys: [{ field: 'email', direction: 1 }],
  unique: true,
});

const collection = new MongoSchemaCollection({
  name: 'users',
  indexes: [index],
});

const ir = new MongoSchemaIR([collection]);

ir.collection('users');     // MongoSchemaCollection
ir.collectionNames;         // ['users']
ir.collections;             // sorted ReadonlyArray<MongoSchemaCollection>

indexesEquivalent(index, index); // true
```

## Architecture

- **Domain**: `mongo`
- **Layer**: `tooling`
- **Plane**: `shared` (migration-plane)
