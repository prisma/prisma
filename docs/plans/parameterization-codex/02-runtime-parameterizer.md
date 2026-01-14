# Runtime Parameterizer

This is the runtime algorithm that replaces the heuristic parameterizer. It
uses ParamGraph to walk the JsonQuery tree and only parameterize values when
both schema rules and runtime value types agree.

## Value Classification

We classify values into a small set of categories before applying schema rules:

- **Null**: `null` or `undefined`
- **Primitive**: string, number, boolean
- **Tagged scalar**: `{ $type: 'DateTime' | 'Decimal' | 'BigInt' | 'Bytes', ... }`
- **Tagged structural**: `{ $type: 'FieldRef' | 'Enum' | 'Param' | 'Raw', ... }`
- **Array**
- **Plain object** (no `$type`)

Tagged structural values are never parameterized.

## Core Rules

Given a field edge `edge` and value `v`:

1. **Structural tags** (`FieldRef`, `Enum`, `Param`, `Raw`) are preserved.
2. **Arrays**:
   - If `edge` has `ListObject` and every element is a plain object, recurse
     into each element using `edge.c`.
   - Else if `edge` has `ListScalar`, validate every element against `edge.m`
     and enum membership. If any element fails, preserve the list as-is so the
     query compiler can surface a precise validation error.
   - Otherwise preserve as-is.
3. **Plain objects**:
   - If `edge` has `Object`, recurse into `edge.c`.
   - Else if `edge` allows Json scalars (`edge.m` has `Json`), parameterize the
     whole object.
   - Otherwise preserve as-is.
4. **Primitives / tagged scalars**:
   - Parameterize only if the scalar category matches `edge.m` and any enum
     membership checks pass.

## Stable Cache Keys

When traversing objects, iterate keys in sorted order. This preserves stable
cache keys even if the input object property order changes.

## Placeholder Naming

- Placeholder name is the full JSON path (same as the existing strawman).
- Array elements use `[i]` in the path.
- Batch queries are prefixed with `batch[i]`.

This keeps cache keys consistent with current naming conventions.

## Placeholder Values

When parameterizing tagged scalars, decode to the same raw values expected by
the query compiler (e.g., Bytes should be base64-decoded to a Buffer).

## Enum Membership

Enum membership is checked against `runtimeDataModel.enums[enumName].values`.
`enumName` comes from `graph.en[edge.e]`. If a string does not match a user
enum value, do not parameterize it.

## ParamGraphView

Build a `ParamGraphView` once in `getPrismaClient` using
`config.parameterizationSchema` and `config.runtimeDataModel`. The view hides
the compact one-letter fields and exposes a readable API:

```ts
export type ParamGraphView = {
  root(key: string): RootEntry | undefined

  inputNode(id?: number): InputNode | undefined
  outputNode(id?: number): OutputNode | undefined

  inputEdge(node: InputNode | undefined, fieldName: string): InputEdge | undefined
  outputEdge(node: OutputNode | undefined, fieldName: string): OutputEdge | undefined

  enumValues(edge: InputEdge | undefined): readonly string[] | undefined
}

export function createParamGraphView(
  graph: ParamGraph,
  runtimeDataModel: RuntimeDataModel,
): ParamGraphView
```

Suggested helpers for bitmask handling (module-level functions):

```ts
export function hasFlag(edge: InputEdge, flag: EdgeFlag): boolean
export function scalarMask(edge: InputEdge): number
```

Traversal code should accept the view instead of raw `ParamGraph` so it only
deals with semantic names.

## Algorithm Sketch

```ts
function parameterizeQuery(query, view): Result {
  if (!view) return legacyParameterize(query)

  const rootKey = query.modelName
    ? `${query.modelName}.${query.action}`
    : query.action

  const root = view.root(rootKey)
  const { parameterized, placeholders } = parameterizeFieldSelection(
    query.query,
    root?.a,
    root?.o,
    'query',
    view
  )

  return { parameterizedQuery: { ...query, query: parameterized }, placeholders }
}

function parameterizeFieldSelection(sel, argsNodeId, outNodeId, path, view) {
  // Parameterize arguments
  const args = sel.arguments
    ? parameterizeObject(sel.arguments, argsNodeId, `${path}.arguments`, view)
    : sel.arguments

  // Traverse selection for nested arguments
  const selection = parameterizeSelection(sel.selection, outNodeId, `${path}.selection`, view)

  return { arguments: args, selection }
}
```

## Selection Traversal

Selection traversal uses **output nodes** to reach nested `arguments`:

- If a selection field has an args node, parameterize its `arguments`.
- If a selection field has a nested output node, recurse into its `selection`.
- Fields that are boolean or `$scalars`/`$composites` are preserved.

This avoids guessing relation types and matches the DMMF output schema exactly.

## Null Handling

Null values are preserved and never parameterized. This keeps validation
behavior identical to the pre-parameterized query.
