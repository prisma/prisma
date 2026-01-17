# ParamGraph: Compact Schema for Runtime Parameterization

## Design Principles

1. **Only store parameterizable paths**. If a subtree has no parameterizable
   leaves, it is omitted so runtime can skip it entirely.
2. **Union types collapse into a single node**. A field that accepts multiple
   input object types points to a union node that merges their fields. This
   avoids runtime branching while still preserving correctness.
3. **Fast lookup with compact encoding**. Field names are interned into a
   string table and edges are keyed by integer indices.
4. **Type-aware edges**. Each edge carries expected value categories so the
   runtime can decide whether to parameterize a given value.

## Data Structure

```ts
// Compact schema embedded in the generated client.
type ParamGraph = {
  // String table to avoid repeating field names.
  s: string[]

  // User enum names for runtime membership checks.
  // Values are looked up via runtimeDataModel.enums.
  en: string[]

  // Input nodes used for argument objects and input types.
  i: InputNode[]

  // Output nodes used for selection traversal.
  o: OutputNode[]

  // Root mapping: "Model.action" or "action" (for non-model ops).
  // Points to the args node and root output node.
  r: Record<string, RootEntry>
}

type RootEntry = {
  a?: NodeId // args node id
  o?: NodeId // output node id
}

type NodeId = number

// Input node: describes parameterizable fields in an input object.
type InputNode = {
  // Map from string-table index to edge descriptor.
  // Only fields that are parameterizable or lead to parameterizable
  // descendants are present.
  f?: Record<number, InputEdge>
}

// Output node: describes fields in a selection set that have args or nested
// selections that may contain parameterizable args.
type OutputNode = {
  f?: Record<number, OutputEdge>
}

// Edge descriptor for input fields.
// Encoded as flags + optional metadata for children and enums.
type InputEdge = {
  // Bit flags described below.
  k: number

  // Child input node id (for object values or list of objects).
  c?: NodeId

  // Scalar type mask for allowed scalar categories.
  m?: number

  // Enum name id (index into `en`) when field accepts a user enum and no plain
  // String scalar.
  e?: number
}

// Edge descriptor for output fields.
type OutputEdge = {
  // Args node for this field (if it accepts arguments).
  a?: NodeId

  // Next output node for nested selection traversal.
  o?: NodeId
}
```

### InputEdge Flags

```ts
const enum EdgeFlag {
  // Field may be parameterized as a scalar value.
  ParamScalar = 1 << 0,

  // Field accepts list-of-scalar values (parameterize the whole list).
  ListScalar = 1 << 1,

  // Field accepts list-of-object values (recurse into each element).
  ListObject = 1 << 2,

  // Field accepts object values (recurse into child input node).
  Object = 1 << 3,

  // Field accepts null as a scalar (if enabled).
  Nullable = 1 << 4,
}
```

### Scalar Mask

```ts
const enum ScalarMask {
  String   = 1 << 0,
  Number   = 1 << 1,
  Boolean  = 1 << 2,
  DateTime = 1 << 3,
  Decimal  = 1 << 4,
  BigInt   = 1 << 5,
  Bytes    = 1 << 6,
  Json     = 1 << 7,
}
```

## Enum Membership

Enum validation uses `runtimeDataModel.enums`. `InputEdge.e` points to a user
enum name in `ParamGraph.en`, which is then resolved to
`runtimeDataModel.enums[enumName].values` at runtime. This avoids embedding enum
values in the ParamGraph.

## Union Nodes

If a field accepts multiple input object types, we build a **union node** whose
fields are the merged union of all variant fields. This avoids runtime
branching and lets the parameterizer decide solely based on the runtime value
class (scalar vs object). The merge strategy is conservative:

- Parameterizable scalar rules are kept only when they are compatible across
  all variants that define the field. If they disagree, the field is omitted
  and a debug log is emitted during generation.
- Child object edges are unioned; if any variant provides a child, the union
  node points to the merged child node for those object types.

This keeps correctness even when the input object type union is ambiguous.

**Initial implementation note:** because placeholders are currently untyped,
union conflicts must disable parameterization at that field (omit it from the
union node) and emit a debug log. A follow-up task introduces typed
placeholders to safely re-enable parameterization with merged scalar masks
(see `docs/plans/parameterization-codex/06-typed-placeholders-client.md`).

## Output Nodes

Output nodes are used only to traverse **selection** trees and reach nested
`arguments`. Each output edge points to:

- An args node (input node) if the field accepts arguments
- A child output node if the field is an object type with nested selection

Only output types that can reach parameterizable args are included.

## Size Characteristics

- Nodes and edges exist only for parameterizable paths.
- String table de-duplicates field names across all nodes.
- Union nodes avoid explosive branching while keeping runtime logic simple.

Typical schemas should compress to a few KB gzipped.

## Mini Example

For a field `id` in `UserWhereInput` with input types:

- `String` (scalar, parameterizable)
- `StringFilter` (input object)

the edge becomes:

```ts
// id: union of scalar + object
// - ParamScalar allows scalar parameterization
// - Object points to StringFilter node
{
  k: EdgeFlag.ParamScalar | EdgeFlag.Object,
  m: ScalarMask.String,
  c: <nodeId(StringFilter)>
}
```

At runtime:

- `where: { id: 'abc' }` -> parameterize `id`
- `where: { id: { equals: 'abc' } }` -> recurse into `StringFilter`
