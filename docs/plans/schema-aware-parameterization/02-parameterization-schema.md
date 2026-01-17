# ParamGraph: Compact Schema for Runtime Parameterization

## Design Principles

1. **Only store parameterizable paths**. If a subtree has no parameterizable leaves, it is omitted so runtime can skip it entirely.

2. **Union types collapse into a single node**. A field that accepts multiple input object types points to a union node that merges their fields. This avoids runtime branching while still preserving correctness.

3. **Fast lookup with compact encoding**. Field names are interned into a string table and edges are keyed by integer indices.

4. **Type-aware edges**. Each edge carries expected value categories so the runtime can decide whether to parameterize a given value.

5. **Separate input and output nodes**. Input nodes describe argument objects; output nodes describe selection traversal to reach nested arguments.

## Data Structure

```typescript
/**
 * Compact schema embedded in the generated client.
 */
export type ParamGraph = {
  /**
   * String table to avoid repeating field names.
   * Field names are referenced by index throughout the graph.
   */
  s: string[]

  /**
   * User enum names for runtime membership checks.
   * Values are looked up via `runtimeDataModel.enums[enumName].values`.
   */
  en: string[]

  /**
   * Input nodes used for argument objects and input types.
   * Each node describes which fields are parameterizable or lead to
   * parameterizable descendants.
   */
  i: InputNode[]

  /**
   * Output nodes used for selection traversal.
   * Each node describes which fields have arguments or lead to
   * nested selections with arguments.
   */
  o: OutputNode[]

  /**
   * Root mapping: "Model.action" or "action" (for non-model ops).
   * Points to the args node (input) and root output node.
   */
  r: Record<string, RootEntry>
}

/**
 * Entry point for a root operation.
 */
export type RootEntry = {
  /** Args node id (into `i` array) */
  a?: NodeId
  /** Output node id (into `o` array) */
  o?: NodeId
}

/**
 * Node ID is an index into `i` or `o` array.
 */
export type NodeId = number

/**
 * Input node: describes parameterizable fields in an input object.
 * Only fields that are parameterizable or lead to parameterizable
 * descendants are present.
 */
export type InputNode = {
  /**
   * Map from string-table index to edge descriptor.
   * Omitted if the node has no fields (shouldn't happen in practice).
   */
  f?: Record<number, InputEdge>
}

/**
 * Output node: describes fields in a selection set that have args
 * or nested selections that may contain parameterizable args.
 */
export type OutputNode = {
  /**
   * Map from string-table index to edge descriptor.
   */
  f?: Record<number, OutputEdge>
}

/**
 * Edge descriptor for input fields.
 * Encodes what kinds of values the field accepts and how to handle them.
 */
export type InputEdge = {
  /**
   * Bit flags describing field capabilities.
   * See EdgeFlag enum below.
   */
  k: number

  /**
   * Child input node id (for object values or list of objects).
   * Present when the field accepts input object types.
   */
  c?: NodeId

  /**
   * Scalar type mask for allowed scalar categories.
   * Present when field accepts scalar values.
   * See ScalarMask enum below.
   */
  m?: number

  /**
   * Enum name id (index into `en` array).
   * Present when field accepts a user enum without a plain String scalar.
   * Used for runtime membership validation.
   */
  e?: number
}

/**
 * Edge descriptor for output fields.
 */
export type OutputEdge = {
  /** Args node for this field (if it accepts arguments) */
  a?: NodeId
  /** Next output node for nested selection traversal */
  o?: NodeId
}
```

## InputEdge Flags

```typescript
/**
 * Bit flags for InputEdge.k describing what the field accepts.
 */
export const enum EdgeFlag {
  /**
   * Field may be parameterized as a scalar value.
   * Check ScalarMask to validate the value type.
   */
  ParamScalar = 1 << 0,

  /**
   * Field accepts list-of-scalar values.
   * Parameterize the whole list if all elements match ScalarMask.
   */
  ListScalar = 1 << 1,

  /**
   * Field accepts list-of-object values.
   * Recurse into each element using the child node.
   */
  ListObject = 1 << 2,

  /**
   * Field accepts object values.
   * Recurse into child input node.
   */
  Object = 1 << 3,

  /**
   * Field accepts null as a valid value.
   * Note: Null values are NEVER parameterized at runtime regardless of this flag.
   * This flag is informational only (reflects isNullable from DMMF).
   */
  Nullable = 1 << 4,
}
```

## Scalar Type Mask

```typescript
/**
 * Bit mask for scalar type categories.
 * Used in InputEdge.m to validate runtime value types.
 */
export const enum ScalarMask {
  String   = 1 << 0,
  Number   = 1 << 1,  // Int, Float
  Boolean  = 1 << 2,
  DateTime = 1 << 3,
  Decimal  = 1 << 4,
  BigInt   = 1 << 5,
  Bytes    = 1 << 6,
  Json     = 1 << 7,
}
```

## Enum Handling

### User-Defined Enums

User-defined enums (from the Prisma schema) are serialized as plain strings at runtime. To validate that a string is a valid enum value:

1. Look up the enum name from `graph.en[edge.e]`
2. Resolve values via `runtimeDataModel.enums[enumName].values`
3. Check if the string is in the values array

This avoids embedding enum values in ParamGraph (they're already in runtimeDataModel).

### Prisma Enums

Prisma-internal enums (`QueryMode`, `TransactionIsolationLevel`, `JsonNull`, `DbNull`, `AnyNull`) are tagged with `$type: 'Enum'` at runtime. These are **structural** and never parameterized, regardless of `isParameterizable`.

## Union Nodes

When a field accepts multiple input object types (union), we build a **union node** whose fields are the merged union of all variant fields. This avoids runtime branching.

### Merge Strategy

The merge is conservative to ensure correctness with untyped placeholders:

1. **Scalar rules**: A field is parameterizable only if ALL variants that define it agree on `isParameterizable: true` and have compatible scalar types. If variants disagree, the field is **omitted** from the union node (no parameterization, no recursion) and a debug log is emitted during generation.

2. **Object children**: Child edges are unioned. If any variant provides a child input type, the union node points to a merged child node for all those object types.

### Example

For `UserWhereInput.OR` which accepts `UserWhereInput[]`:

```typescript
// Single type, no union needed
{ k: EdgeFlag.ListObject, c: nodeId(UserWhereInput) }
```

For a filter field with `[StringFilter, String]`:

```typescript
// Union: scalar + object
{
  k: EdgeFlag.ParamScalar | EdgeFlag.Object,
  m: ScalarMask.String,
  c: nodeId(StringFilter)
}
```

### Initial Implementation Note

Because placeholders are currently **untyped**, union conflicts must disable parameterization at that field. A follow-up task introduces typed placeholders to safely re-enable parameterization with merged scalar masks (see [06-typed-placeholders-client.md](./06-typed-placeholders-client.md)).

## Output Nodes

Output nodes enable traversal of **selection** trees to reach nested `arguments`. They are built from DMMF output object types.

Each output edge points to:
- An args node (input node) if the field accepts arguments
- A child output node if the field is an object type with nested selection

### Pruning

Output nodes are pruned to only include fields that either:
- Have `arguments` that lead to parameterizable input nodes, OR
- Lead to child output nodes that can reach parameterizable args

This keeps the graph minimal.

### Example

For `User.posts` relation with nested args:

```typescript
// Output node for User
{
  f: {
    [strId('posts')]: {
      a: nodeId(UserPostsArgs),  // Arguments like where, orderBy, take
      o: nodeId(PostOutput)      // Nested selection traversal
    }
  }
}
```

## Size Characteristics

- Nodes and edges exist only for parameterizable paths
- String table de-duplicates field names across all nodes
- Union nodes avoid explosive branching
- Output nodes pruned to reachable args

**Typical schemas should compress to 2-5KB gzipped.**

## Complete Example

For a schema with:

```prisma
model User {
  id    String @id
  email String
  name  String?
  posts Post[]
}

model Post {
  id       String @id
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}

enum Status {
  DRAFT
  PUBLISHED
}
```

The ParamGraph might look like:

```typescript
{
  // String table
  s: ['id', 'email', 'name', 'posts', 'title', 'where', 'data', 'equals',
      'contains', 'in', 'orderBy', 'take', 'skip', 'author', 'authorId',
      'AND', 'OR', 'NOT'],

  // User enum names (values looked up via runtimeDataModel)
  en: ['Status'],

  // Input nodes
  i: [
    // Node 0: UserWhereInput
    {
      f: {
        0: { k: 0b1001, m: 1, c: 1 },  // id: ParamScalar|Object, String, -> StringFilter
        1: { k: 0b1001, m: 1, c: 1 },  // email: ParamScalar|Object, String, -> StringFilter
        2: { k: 0b1001, m: 1, c: 2 },  // name: ParamScalar|Object, String, -> StringNullableFilter
        15: { k: 0b0100, c: 0 },       // AND: ListObject -> UserWhereInput
        16: { k: 0b0100, c: 0 },       // OR: ListObject -> UserWhereInput
        17: { k: 0b1000, c: 0 },       // NOT: Object -> UserWhereInput
      }
    },
    // Node 1: StringFilter
    {
      f: {
        7: { k: 0b0001, m: 1 },        // equals: ParamScalar, String
        8: { k: 0b0001, m: 1 },        // contains: ParamScalar, String
        9: { k: 0b0010, m: 1 },        // in: ListScalar, String
      }
    },
    // Node 2: StringNullableFilter (same as StringFilter, nulls preserved not parameterized)
    {
      f: {
        7: { k: 0b0001, m: 1 },        // equals: ParamScalar, String (null preserved)
        8: { k: 0b0001, m: 1 },        // contains: ParamScalar, String
        9: { k: 0b0010, m: 1 },        // in: ListScalar, String
      }
    },
    // Node 3: UserCreateInput
    {
      f: {
        0: { k: 0b0001, m: 1 },        // id: ParamScalar, String
        1: { k: 0b0001, m: 1 },        // email: ParamScalar, String
        2: { k: 0b0001, m: 1 },        // name: ParamScalar, String (null preserved)
      }
    },
    // Node 4: FindManyUserArgs
    {
      f: {
        5: { k: 0b1000, c: 0 },        // where: Object -> UserWhereInput
        11: { k: 0b0001, m: 2 },       // take: ParamScalar, Number
        12: { k: 0b0001, m: 2 },       // skip: ParamScalar, Number
      }
    },
    // Node 5: CreateUserArgs
    {
      f: {
        6: { k: 0b1000, c: 3 },        // data: Object -> UserCreateInput
      }
    },
    // ... more input nodes
  ],

  // Output nodes
  o: [
    // Node 0: UserOutput
    {
      f: {
        3: { a: 6, o: 1 }              // posts: args -> PostFindManyArgs, output -> PostOutput
      }
    },
    // Node 1: PostOutput
    {
      f: {
        13: { o: 0 }                   // author: output -> UserOutput (for nested selections)
      }
    },
  ],

  // Roots
  r: {
    'User.findMany': { a: 4, o: 0 },   // FindManyUserArgs, UserOutput
    'User.findUnique': { a: 7, o: 0 }, // FindUniqueUserArgs, UserOutput
    'User.create': { a: 5, o: 0 },     // CreateUserArgs, UserOutput
    'Post.findMany': { a: 8, o: 1 },   // FindManyPostArgs, PostOutput
    // ... more operations
  }
}
```

## Runtime Lookup Flow

1. **Find root**: `graph.r[`${modelName}.${action}`]` or `graph.r[action]`
2. **Process arguments**: Walk `query.arguments` using input node from `root.a`
3. **Process selection**: Walk `query.selection` using output node from `root.o`
4. **For each field**:
   - Look up string index: `stringToIndex.get(fieldName)` (pre-built Map)
   - Look up edge: `node.f[stringIndex]`
   - Apply rules based on edge flags and runtime value type

## String Table Optimization

At runtime, build a reverse lookup map for O(1) string-to-index conversion:

```typescript
function buildStringIndex(graph: ParamGraph): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < graph.s.length; i++) {
    map.set(graph.s[i], i)
  }
  return map
}
```

This map is built once at client initialization.

## Size Comparison

| Approach | Estimated Size (uncompressed) | Gzipped |
|----------|------------------------------|---------|
| Full DMMF mirror | 80-100KB | 15-20KB |
| Simple graph without type info | 10-15KB | 3-5KB |
| **ParamGraph with type masks** | **5-10KB** | **2-4KB** |

The ParamGraph approach achieves compact size while providing precise type information for correct parameterization.
