# ADR 121 — Contract.d.ts structure and relation typing

## Context

The emitter produces `contract.d.ts` to provide TypeScript types for the DSL and ORM layers. This ADR establishes the complete structure and typing rules for relation fields in generated TypeScript declarations.

Proper relation typing is critical because:
- Developers rely on accurate autocomplete for relation fields in queries
- Type inference must work correctly for nested includes and joins
- The DSL needs to distinguish between scalar columns and relation navigations
- Cardinality (1:1, 1:N, N:1) affects whether a relation is typed as `T` or `T[]`
- Nullability from optional relations and LEFT JOINs must propagate correctly

This specification ensures consistency between PSL-first and TS-first emission, and provides clear guidance for building type-safe relation navigation in the DSL.

## Decision

### Complete contract.d.ts structure

`contract.d.ts` exports four namespaces with clear separation of concerns:

1. **Tables** — Storage-level types mapping directly to database columns
2. **Models** — Application-level types with relation fields for developer ergonomics
3. **Relations** — Metadata describing relation structure for the DSL and runtime
4. **Mappings** — Essential connections between models and storage

### Complete example

Given this PSL schema:

```prisma
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  active  Boolean  @default(true)
  posts   Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

The emitter generates this complete `contract.d.ts`:

```typescript
export declare namespace Contract {
  // Symbol for metadata property to avoid collisions
  const META = Symbol('metadata');

  type Meta<T extends { [META]: unknown }> = T[typeof META];

  // Metadata interfaces for extensibility
  interface TableMetadata<Name extends string> {
    name: Name;
  }

  interface ModelMetadata<Name extends string> {
    name: Name;
  }

  // Base interfaces with metadata
  interface TableDef<Name extends string> {
    readonly [META]: TableMetadata<Name>;
  }
  interface ModelDef<Name extends string> {
    readonly [META]: ModelMetadata<Name>;
  }

  // Storage-level types (raw database structure)
  export namespace Tables {
    export interface user extends TableDef<'user'> {
      id: number;
      email: string;
      active: boolean;
    }
    export interface post extends TableDef<'post'> {
      id: number;
      title: string;
      user_id: number;
      createdAt: Date;
    }
  }

  // Application-level types (with relations)
  export namespace Models {
    export interface User extends ModelDef<'User'> {
      id: number;
      email: string;
      active: boolean;
      posts: Post[]; // 1:N relation
    }
    export interface Post extends ModelDef<'Post'> {
      id: number;
      title: string;
      userId: number;
      createdAt: Date;
      user: User; // N:1 relation
    }
  }

  // Relation metadata for DSL and runtime
  export namespace Relations {
    export interface post {
      user: {
        to: 'User';
        cardinality: 'N:1';
        fields: ['userId'];
        references: ['id'];
        required: true;
      };
    }
    export interface user {
      posts: {
        to: 'Post';
        cardinality: '1:N';
        fields: ['id'];
        references: ['userId'];
        required: false;
      };
    }
  }

  // Model-table-field-column mappings
  export namespace Mappings {
    export interface ModelToTable {
      User: 'user';
      Post: 'post';
    }
    export interface TableToModel {
      user: 'User';
      post: 'Post';
    }
    export interface FieldToColumn {
      User: {
        id: 'id';
        email: 'email';
        active: 'active';
      };
      Post: {
        id: 'id';
        title: 'title';
        userId: 'user_id';
        createdAt: 'createdAt';
      };
    }
    export interface ColumnToField {
      user: {
        id: 'id';
        email: 'email';
        active: 'active';
      };
      post: {
        id: 'id';
        title: 'title';
        user_id: 'userId';
        createdAt: 'createdAt';
      };
    }
  }
}

export type Tables = Contract.Tables;
export type Models = Contract.Models;
export type Relations = Contract.Relations;
export type Mappings = Contract.Mappings;
```

This structure enables:
- **DSL type safety**: `db.user` (field-proxy `f.id`) → `Tables.user.id` (via Mappings)
- **ORM includes**: `User & { posts: Post[] }` (via Models + Relations)
- **Query results**: Proper typing for joins and projections
- **Extension support**: Branded types for domain-specific values

### Tables namespace (storage-level)

Tables represent the raw database structure without relations. See the complete example above for the full structure.

**Rules:**
- Use storage names (table names, column names) from `contract.storage`
- Include only scalar columns, no relations
- Foreign key columns appear as regular scalars (`user_id: number`)
- Used for result typing when querying without includes

### Models namespace (application-level)

Models represent the application domain with relation fields. See the complete example above for the full structure.

**Rules:**
- Use model names and field names from `contract.models`
- Include relation fields with proper cardinality typing:
  - `1:1` and `N:1` → `RelatedModel`
  - `1:N` and `N:M` → `RelatedModel[]`
- FK fields use model field names, not storage column names
- Relation fields are always non-null in the base model type
- Optional relations are typed differently (see Nullability Rules below)

### Relations namespace (metadata)

Relations provide structural metadata for runtime and DSL. See the complete example above for the full structure.

**Rules:**
- Keys are storage table names (lowercase)
- Relation names match model field names
- `to` references the model name
- `cardinality` is `'1:1' | '1:N' | 'N:1' | 'N:M'`
- `fields` and `references` use model field names
- `required` indicates if the relation is mandatory

### Mappings namespace (model-table-field-column connections)

Mappings provide the essential connections between models and storage. See the complete example above for the full structure.

**Rules:**
- `ModelToTable` maps model names to storage table names
- `TableToModel` maps storage table names to model names
- `FieldToColumn` maps model field names to storage column names per model
- `ColumnToField` maps storage column names to model field names per table
- All mappings are bidirectional and type-safe
- Used by DSL for `db.user` field-proxy access (`f.id`) → `Tables.user.id` type inference

## Cardinality typing rules

### 1:1 relations

```prisma
model User {
  id      Int      @id
  profile Profile?
}

model Profile {
  id     Int  @id
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique
}
```

Generated types:
```typescript
export interface User {
  id: number
  profile: Profile | null  // optional side
}

export interface Profile {
  id: number
  userId: number
  user: User  // required side
}
```

### 1:N relations

```prisma
model User {
  id    Int    @id
  posts Post[]
}

model Post {
  id     Int  @id
  user   User @relation(fields: [userId], references: [id])
  userId Int
}
```

Generated types:
```typescript
export interface User {
  id: number
  posts: Post[]  // always array, may be empty
}

export interface Post {
  id: number
  userId: number
  user: User
}
```

### N:1 relations

Inverse of 1:N; same as the "many" side of 1:N above.

### N:M relations (implicit join table)

```prisma
model Post {
  id         Int        @id
  categories Category[]
}

model Category {
  id    Int    @id
  posts Post[]
}
```

Generated types:
```typescript
export interface Post {
  id: number
  categories: Category[]
}

export interface Category {
  id: number
  posts: Post[]
}
```

**Note:** Both sides are arrays. The runtime must handle the join table transparently.

## Nullability rules

### Base model nullability

- **Required relations** (N:1 with non-nullable FK, or 1:1 required side): `RelatedModel`
- **Optional relations** (1:1 optional side, or nullable FK): `RelatedModel | null`
- **Array relations** (1:N, N:M): Always `RelatedModel[]`, never null (empty array represents no relations)

### Query result nullability

Result types from queries with joins follow ADR 020 nullability propagation:

```typescript
// INNER JOIN: relation is non-null if FK is non-null
db.post
  .innerJoin(db.user, (f, fns) => fns.eq(f.post.user_id, f.user.id))
  .select((f) => ({ /* ... */ }))
// Result: { ..., user: User }

// LEFT JOIN: relation becomes nullable regardless of FK
db.post
  .outerLeftJoin(db.user, (f, fns) => fns.eq(f.post.user_id, f.user.id))
  .select((f) => ({ /* ... */ }))
// Result: { ..., user: User | null }
```

The DSL layer applies these rules at query construction time, not at model definition time.

## DSL integration

### Column access via the field proxy

The runtime exposes tables through the `Db<C>` proxy returned by
`sql({ context })`. Columns are referenced via the field-proxy `f` argument
passed to `.select(...)`, `.where(...)`, `.orderBy(...)`, etc., which is
scoped to the current builder and typed via the Mappings namespace:

```typescript
db.user.select((f) => ({
  id: f.id,          // ColumnRef<number> - maps to Tables.user.id
  email: f.email,    // ColumnRef<string> - maps to Tables.user.email
}));
// Selecting a relation field directly is a type error; use ORM include.

// Type inference works through mappings and metadata:
// db.user → Tables.user (via TableToModel mapping)
// f.id within db.user.select(...) → Tables.user.id (via ColumnToField mapping)

// Runtime access for dynamic queries using metadata
const user: Contract.Models.User = {
  [META]: { name: 'User' },
  id: 1,
  email: 'test@test.com',
  active: true,
  posts: [],
};

// Type-safe table name lookup via metadata
const tableName: Contract.Mappings.ModelToTable[typeof user[META]['name']] = 'user';

// Access rich metadata for future extensions
const userMetadata = user[META];
const modelName = userMetadata.name; // 'User'
// Future: const indexes = userMetadata.indexes; // ['user_email_idx']
```

**Rules:**
- Scalar fields on the `f` proxy carry `ColumnRef<T>` for use in SELECT, WHERE, ORDER BY
- Relation fields are not exposed on `f`; relation navigation lives at the ORM-include layer
- Attempting to select a relation directly is a type error
- Type inference uses Mappings namespace to connect `db.tableName` to `Tables.tableName`
- Metadata dictionary provides extensible runtime access for dynamic query building

### Utility types for DSL implementation

The DSL implementation can use these utility types with metadata dictionary:

```typescript
// Get the model name from a model instance
type ModelName<M extends ModelDef<string>> = M[META]['name']

// Get the table name from a table interface
type TableName<T extends TableDef<string>> = T[META]['name']

// Get the model type for a table
type ModelForTable<T extends keyof Tables> = Mappings.TableToModel[T]

// Get the table type for a model
type TableForModel<M extends keyof Models> = Mappings.ModelToTable[M]

// Get column type for a field using metadata-based lookup
type ColumnForField<T extends keyof Tables, F extends keyof Mappings.ColumnToField[T]> =
  Tables[T][Mappings.ColumnToField[T][F]]

// Example usage in DSL:
type UserModelName = ModelName<Models.User>  // 'User'
type UserTableName = TableName<Tables.user>  // 'user'
type UserTable = TableForModel<'User'>  // 'user'
type UserModel = ModelForTable<'user'>  // 'User'
type UserIdColumn = ColumnForField<'user', 'id'>  // number

// Runtime usage for dynamic queries with metadata
function buildDynamicQuery<M extends ModelDef<string>>(
  db: Db<Contract>,
  model: M,
) {
  const modelName = model[META].name  // Runtime access to metadata
  const tableName = Mappings.ModelToTable[modelName]  // Type-safe lookup
  return db[tableName]  // Table proxy keyed by table name on Db<C>
}

// Future: Access extended metadata
function getTableIndexes<T extends TableDef<string>>(table: T): T[META]['indexes'] {
  return table[META].indexes  // Future extension
}
```

### ORM-level includes

```typescript
// ORM layer (built on DSL)
orm.query(User)
  .include({ posts: true })
  .findMany()

// Inferred type: Array<User & { posts: Post[] }>
```

The ORM layer uses the Relations metadata to construct appropriate joins or subqueries.

## Extension support

Extension values receive branded types:

```typescript
import type { Vector } from '@prisma/pack-pgvector'

export interface document {
  id: number
  content: string
  embedding: Vector<1536>  // Branded type from pack
}
```

**Rules:**
- Extension packs export their branded types
- `contract.d.ts` imports and uses these types
- Prevents mixing incompatible extension values (e.g., `Vector<1536>` vs `Vector<512>`)

## Alternatives considered

### Single unified type with both storage and model fields

```typescript
export interface User {
  id: number
  email: string
  posts: Post[]        // relation
  user_id?: number     // FK from other tables
}
```

**Rejected:** Mixes concerns, leads to confusion about which fields are queryable vs navigable.

### Relations as separate lookup via utility types

```typescript
type WithRelations<T, R> = T & R
```

**Rejected:** Requires manual composition, worse DX, harder to infer in complex queries.

### Inline relation metadata

```typescript
export interface Post {
  user: User & { __meta: { cardinality: 'N:1' } }
}
```

**Rejected:** Pollutes application types with metadata, complicates inference.

## Implementation notes

### Emission order

1. Parse contract.json
2. Extract models, storage, and relations
3. Generate metadata symbol (`META`) and interfaces (`TableMetadata`, `ModelMetadata`)
4. Generate base interfaces (`TableDef`, `ModelDef`) with metadata dictionary properties
5. Generate Tables namespace from storage (extends `TableDef`)
6. Generate Models namespace from models + relations (extends `ModelDef`)
7. Generate Relations namespace from contract.relations using metadata lookups
8. Generate Mappings namespace using metadata-based computed property keys
9. Write to contract.d.ts

### Type imports

Extension packs must be imported if used:

```typescript
import type { Vector } from '@prisma/pack-pgvector/types'
import type { Geography } from '@prisma/pack-postgis/types'
```

The emitter scans `contract.extensions` to determine required imports.

### Determinism

- Interface order follows deterministic contract.json key ordering
- Relation field order within interfaces is deterministic
- Import statements are sorted lexicographically

## Testing

### Golden tests

- PSL → contract.d.ts for various relation patterns
- TS builder → contract.d.ts with identical output
- Extension packs → proper branded type imports

### Type tests

```typescript
// Relations are typed correctly
const user: Models.User = { id: 1, email: 'a@b.com', posts: [] }

// Cardinality enforced
user.posts = singlePost  // error: Type 'Post' is not assignable to 'Post[]'

// Branded types prevent mixing
const vec1: Vector<1536> = ...
const vec2: Vector<512> = ...
vec1 = vec2  // error: incompatible branded types
```

### Inference tests

```typescript
// Query result types infer correctly
const result = await db.user
  .outerLeftJoin(db.post, (f, fns) => fns.eq(f.user.id, f.post.user_id))
  .select((f) => ({ uid: f.user.id, postId: f.post.id, postTitle: f.post.title }))
  .all();

// result: Array<{ uid: number, postId: number | null, postTitle: string | null }>
```

The SQL builder currently projects individual columns rather than whole
relation proxies, so the aspirational `post: Tables.post` projection is
expressed as the LEFT-JOIN-nullable scalar columns the join exposes; nesting
a full related row stays at the ORM-include layer.

## Consequences

### Positive

- Clear separation between storage and application domain
- Type safety for relation navigation
- Proper cardinality enforcement
- Extension values are type-safe
- Works with both PSL and TS builder

### Trade-offs

- Three namespaces increase cognitive load slightly
- Branded types require pack authors to export types
- Generated file size grows with relation count

### Migration impact

- Existing code using incomplete types may need updates
- New relation fields in Models may cause type errors if code assumed they didn't exist
- Extension adoption requires updating imports

## Related

- ADR 006 — Dual authoring modes
- ADR 007 — Types only emission
- ADR 020 — Result typing and projection inference rules
- ADR 114 — Extension codecs & branded types
