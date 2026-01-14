# Runtime Parameterizer Implementation

## Overview

This document details the implementation of the schema-aware runtime parameterizer that will replace the current heuristic-based implementation in `packages/client/src/runtime/core/engines/client/parameterize.ts`. It uses the ParamGraph data structure to walk the JsonQuery tree and only parameterize values when both schema rules and runtime value types agree.

## Current Implementation Analysis

The existing implementation uses context-based heuristics:

```typescript
type Context = 'default' | 'selection' | 'orderBy' | 'data'

const STRUCTURAL_VALUE_KEYS = new Set([
  'take', 'skip', 'sort', 'nulls', 'mode',
  'relationLoadStrategy', 'distinct', 'by',
])
```

### Limitations

1. **Hardcoded key lists**: Must be manually maintained
2. **No union type handling**: Can't distinguish `{ id: 10 }` from `{ id: { equals: 10 } }`
3. **No FieldRef awareness**: Would parameterize FieldRef if not explicitly checked
4. **Context leaking**: Complex nested structures can confuse the context tracking

## New Implementation

### Module Structure

```
packages/client/src/runtime/core/engines/client/
├── parameterize.ts                    # Main entry point (thin wrapper)
├── parameterization/
│   ├── index.ts                       # Re-exports
│   ├── types.ts                       # Type definitions
│   ├── classify.ts                    # Value classification
│   ├── traverse.ts                    # ParamGraph traversal
│   └── legacy.ts                      # Renamed current implementation (fallback)
```

## Value Classification

We classify runtime values into categories before applying schema rules:

```typescript
// parameterization/classify.ts

/**
 * Tagged value types that we recognize
 */
const SCALAR_TAGS = new Set(['DateTime', 'Decimal', 'BigInt', 'Bytes', 'Json'])
const STRUCTURAL_TAGS = new Set(['FieldRef', 'Enum', 'Param', 'Raw'])

/**
 * Classification result for a runtime value
 */
export type ValueClass =
  | { kind: 'null' }
  | { kind: 'primitive'; value: string | number | boolean }
  | { kind: 'taggedScalar'; tag: string; value: unknown }
  | { kind: 'structural'; tag: string; value: unknown }  // FieldRef, Enum, Param, Raw
  | { kind: 'array'; items: unknown[] }
  | { kind: 'object'; entries: Record<string, unknown> }

/**
 * Classifies a runtime value for parameterization purposes.
 */
export function classifyValue(value: unknown): ValueClass {
  if (value === null || value === undefined) {
    return { kind: 'null' }
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'primitive', value }
  }

  if (Array.isArray(value)) {
    return { kind: 'array', items: value }
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>

    // Check for tagged value
    if ('$type' in obj && typeof obj.$type === 'string') {
      const tag = obj.$type

      if (SCALAR_TAGS.has(tag)) {
        return { kind: 'taggedScalar', tag, value: obj.value }
      }

      if (STRUCTURAL_TAGS.has(tag)) {
        return { kind: 'structural', tag, value: obj.value }
      }
    }

    return { kind: 'object', entries: obj }
  }

  // Unknown type - treat as structural (don't parameterize)
  return { kind: 'structural', tag: 'unknown', value }
}
```

## ParamGraphView Abstraction

Build a `ParamGraphView` once in `getPrismaClient` using `config.parameterizationSchema` and `config.runtimeDataModel`. The view hides the compact one-letter fields and exposes a readable API:

```typescript
export type ParamGraphView = {
  /** Look up a root entry by "Model.action" or "action" */
  root(key: string): RootEntry | undefined

  /** Get an input node by ID */
  inputNode(id?: number): InputNode | undefined

  /** Get an output node by ID */
  outputNode(id?: number): OutputNode | undefined

  /** Get an input edge for a field name within a node */
  inputEdge(node: InputNode | undefined, fieldName: string): InputEdge | undefined

  /** Get an output edge for a field name within a node */
  outputEdge(node: OutputNode | undefined, fieldName: string): OutputEdge | undefined

  /** Get enum values for an edge that references a user enum */
  enumValues(edge: InputEdge | undefined): readonly string[] | undefined
}

export function createParamGraphView(
  graph: ParamGraph,
  runtimeDataModel: RuntimeDataModel,
): ParamGraphView {
  // Build string-to-index map once
  const stringIndex = new Map<string, number>()
  for (let i = 0; i < graph.s.length; i++) {
    stringIndex.set(graph.s[i], i)
  }

  return {
    root: (key) => graph.r[key],
    inputNode: (id) => id !== undefined ? graph.i[id] : undefined,
    outputNode: (id) => id !== undefined ? graph.o[id] : undefined,
    inputEdge: (node, fieldName) => {
      const idx = stringIndex.get(fieldName)
      return idx !== undefined ? node?.f?.[idx] : undefined
    },
    outputEdge: (node, fieldName) => {
      const idx = stringIndex.get(fieldName)
      return idx !== undefined ? node?.f?.[idx] : undefined
    },
    enumValues: (edge) => {
      if (edge?.e === undefined) return undefined
      const enumName = graph.en[edge.e]
      return runtimeDataModel.enums[enumName]?.values
    },
  }
}
```

### Helper Functions for Edge Flags

```typescript
export function hasFlag(edge: InputEdge, flag: EdgeFlag): boolean {
  return (edge.k & flag) !== 0
}

export function getScalarMask(edge: InputEdge): number {
  return edge.m ?? 0
}
```

Traversal code should accept the view instead of the raw `ParamGraph` so it only deals with semantic names, not one-letter compact fields.

## Core Parameterization Rules

Given an edge `edge` from the ParamGraph and a value `v`:

1. **Structural tags** (`FieldRef`, `Enum`, `Param`, `Raw`) are **always preserved**.

2. **Arrays**:
   - If `edge.k` has `ListObject` flag and every element is a plain object, **recurse** into each element using `edge.c`.
   - Else if `edge.k` has `ListScalar` flag, validate every element against `edge.m` (scalar mask) and enum membership. If all pass, **parameterize** the list. If any element fails, **preserve** the list as-is so the query compiler can surface a precise validation error.
   - Otherwise **preserve** as-is.

3. **Plain objects**:
   - If `edge.k` has `Object` flag, **recurse** into `edge.c`.
   - Else if `edge.m` includes `Json` scalar mask, **parameterize** the whole object.
   - Otherwise **preserve** as-is.

4. **Primitives / tagged scalars**:
   - **Parameterize** only if the scalar category matches `edge.m` and any enum membership checks pass.

5. **Null**:
   - **Always preserve** as-is. Null values are never parameterized because they affect query semantics (IS NULL vs = value).

## Stable Cache Keys

When traversing objects, iterate keys in **sorted order**. This preserves stable cache keys even if the input object property order changes.

```typescript
const sortedKeys = Object.keys(obj).sort()
for (const key of sortedKeys) {
  // process obj[key]
}
```

## Placeholder Format

- Placeholder name is the full JSON path (same as existing strawman)
- Array elements use `[i]` in the path
- Batch queries are prefixed with `batch[i]`

```typescript
const PARAM_MARKER = { $type: 'Param' } as const

function createPlaceholder(path: string): { $type: 'Param'; value: string } {
  return { ...PARAM_MARKER, value: path }
}
```

## Placeholder Values

When parameterizing tagged scalars, decode to the raw values expected by the query compiler:

```typescript
function decodeTaggedValue(tagged: { $type: string; value: unknown }): unknown {
  switch (tagged.$type) {
    case 'Bytes':
      return Buffer.from(tagged.value as string, 'base64')
    default:
      return tagged.value
  }
}
```

## Enum Membership Validation

User enum membership is checked against `runtimeDataModel.enums`:

```typescript
function isValidEnumValue(
  value: string,
  enumNameId: number,
  graph: ParamGraph,
  runtimeDataModel: RuntimeDataModel,
): boolean {
  const enumName = graph.en[enumNameId]
  const enumDef = runtimeDataModel.enums[enumName]
  if (!enumDef) return false
  return enumDef.values.includes(value)
}
```

If a string does not match a user enum value, **do not parameterize** it. Let validation surface the error.

## Algorithm Implementation

### Main Entry Point

```typescript
// parameterization/traverse.ts

import type { JsonQuery, JsonBatchQuery } from '@prisma/client-common'
import type { ParamGraph, InputNode, OutputNode, InputEdge, RootEntry } from './types'
import { classifyValue } from './classify'
import { EdgeFlag, ScalarMask, matchesScalarMask } from './types'

export interface ParameterizeResult {
  parameterizedQuery: JsonQuery
  placeholderValues: Record<string, unknown>
  placeholderPaths: string[]
}

export interface ParameterizeBatchResult {
  parameterizedBatch: JsonBatchQuery
  placeholderValues: Record<string, unknown>
  placeholderPaths: string[]
}

interface TraversalContext {
  graph: ParamGraph
  stringIndex: Map<string, number>
  runtimeDataModel: RuntimeDataModel
  placeholders: Map<string, unknown>
}

const PARAM_MARKER = { $type: 'Param' } as const

/**
 * Parameterizes a single query using ParamGraphView.
 */
export function parameterizeQuery(
  query: JsonQuery,
  view: ParamGraphView,
): ParameterizeResult {
  const placeholders = new Map<string, unknown>()

  // Find root entry for this operation
  // Roots are keyed by JSON protocol action names (createOne, updateOne, etc.)
  // No normalization needed - use query.action directly
  const rootKey = query.modelName
    ? `${query.modelName}.${query.action}`
    : query.action

  const root = view.root(rootKey)

  // Process the query
  const parameterizedQuery: JsonQuery = {
    ...query,
    query: parameterizeFieldSelection(query.query, root, 'query', view, placeholders),
  }

  return {
    parameterizedQuery,
    placeholderValues: Object.fromEntries(placeholders),
    placeholderPaths: [...placeholders.keys()],
  }
}
```

### Field Selection Processing

```typescript
/**
 * Parameterizes a field selection (arguments + selection).
 */
function parameterizeFieldSelection(
  sel: JsonFieldSelection,
  root: RootEntry | undefined,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): JsonFieldSelection {
  const argsNode = view.inputNode(root?.a)
  const outNode = view.outputNode(root?.o)

  const result: JsonFieldSelection = { ...sel }

  // Process arguments using input node
  if (sel.arguments && typeof sel.arguments === 'object') {
    result.arguments = parameterizeObject(
      sel.arguments as Record<string, unknown>,
      argsNode,
      `${path}.arguments`,
      view,
      placeholders,
    )
  }

  // Process selection using output node
  if (sel.selection) {
    result.selection = parameterizeSelection(
      sel.selection,
      outNode,
      `${path}.selection`,
      view,
      placeholders,
    )
  }

  return result
}
```

### Input Object Traversal

```typescript
/**
 * Parameterizes an object by traversing its fields with the input node.
 */
function parameterizeObject(
  obj: Record<string, unknown>,
  node: InputNode | undefined,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): Record<string, unknown> {
  if (!node) {
    // No parameterizable fields in this subtree
    return obj
  }

  const result: Record<string, unknown> = {}

  // Iterate in sorted order for stable cache keys
  const sortedKeys = Object.keys(obj).sort()

  for (const key of sortedKeys) {
    const value = obj[key]
    const edge = view.inputEdge(node, key)
    const fieldPath = `${path}.${key}`

    if (edge) {
      result[key] = parameterizeValue(value, edge, fieldPath, view, placeholders)
    } else {
      // Unknown field - preserve as-is
      result[key] = value
    }
  }

  return result
}
```

### Value Parameterization

```typescript
/**
 * Core parameterization logic for a single value.
 */
function parameterizeValue(
  value: unknown,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  const classified = classifyValue(value)

  switch (classified.kind) {
    case 'null':
      // Null values are never parameterized - they affect query semantics
      return value

    case 'structural':
      // FieldRef, Enum, Param, Raw - always preserve
      return value

    case 'primitive':
      return handlePrimitive(classified.value, edge, path, view, placeholders)

    case 'taggedScalar':
      return handleTaggedScalar(value as TaggedValue, classified.tag, edge, path, placeholders)

    case 'array':
      return handleArray(classified.items, edge, path, view, placeholders)

    case 'object':
      return handleObject(classified.entries, edge, path, view, placeholders)
  }
}

function handlePrimitive(
  value: string | number | boolean,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  // Check if this edge allows scalar parameterization
  if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
    return value
  }

  // Validate scalar type matches mask
  const mask = getScalarMask(edge)
  if (mask !== 0 && !matchesPrimitiveMask(value, mask)) {
    return value
  }

  // Check enum membership if required
  if (edge.e !== undefined && typeof value === 'string') {
    const enumValues = view.enumValues(edge)
    if (enumValues && !enumValues.includes(value)) {
      return value  // Invalid enum - let validation catch it
    }
  }

  placeholders.set(path, value)
  return { ...PARAM_MARKER, value: path }
}

function handleTaggedScalar(
  tagged: TaggedValue,
  tag: string,
  edge: InputEdge,
  path: string,
  placeholders: Map<string, unknown>,
): unknown {
  if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
    return tagged
  }

  // Validate tag matches scalar mask
  const mask = getScalarMask(edge)
  if (mask !== 0 && !matchesTaggedMask(tag, mask)) {
    return tagged
  }

  const decoded = decodeTaggedValue(tagged)
  placeholders.set(path, decoded)
  return { ...PARAM_MARKER, value: path }
}

function handleArray(
  items: unknown[],
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  // List of objects - recurse into each element
  if (hasFlag(edge, EdgeFlag.ListObject)) {
    const childNode = view.inputNode(edge.c)
    if (childNode) {
      return items.map((item, i) => {
        if (isPlainObject(item)) {
          return parameterizeObject(item, childNode, `${path}[${i}]`, view, placeholders)
        }
        return item  // Non-object in list-object field, preserve
      })
    }
  }

  // List of scalars - validate and parameterize whole list
  if (hasFlag(edge, EdgeFlag.ListScalar)) {
    const allValid = items.every(item => validateListElement(item, edge, view))
    if (allValid) {
      const decodedItems = items.map(item => decodeIfTagged(item))
      placeholders.set(path, decodedItems)
      return { ...PARAM_MARKER, value: path }
    }
  }

  // Preserve as-is
  return items
}

function handleObject(
  obj: Record<string, unknown>,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  // Object field - recurse into child node
  if (hasFlag(edge, EdgeFlag.Object)) {
    const childNode = view.inputNode(edge.c)
    if (childNode) {
      return parameterizeObject(obj, childNode, path, view, placeholders)
    }
  }

  // Json field - parameterize the whole object
  const mask = getScalarMask(edge)
  if (mask & ScalarMask.Json) {
    placeholders.set(path, obj)
    return { ...PARAM_MARKER, value: path }
  }

  // Unknown object structure - preserve
  return obj
}
```

### Selection Traversal

```typescript
/**
 * Parameterizes a selection set using output nodes.
 */
function parameterizeSelection(
  selection: JsonSelectionSet,
  node: OutputNode | undefined,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): JsonSelectionSet {
  if (!selection || !node) {
    return selection
  }

  const result: JsonSelectionSet = {}

  for (const [key, value] of Object.entries(selection)) {
    // Preserve special markers and boolean selections
    if (key === '$scalars' || key === '$composites' || typeof value === 'boolean') {
      result[key] = value
      continue
    }

    const edge = view.outputEdge(node, key)

    if (edge) {
      // Nested selection with possible args
      const nested = value as { arguments?: Record<string, unknown>; selection?: JsonSelectionSet }
      const fieldPath = `${path}.${key}`

      const argsNode = view.inputNode(edge.a)
      const childOutNode = view.outputNode(edge.o)

      result[key] = {
        arguments: nested.arguments
          ? parameterizeObject(nested.arguments, argsNode, `${fieldPath}.arguments`, view, placeholders)
          : undefined,
        selection: nested.selection
          ? parameterizeSelection(nested.selection, childOutNode, `${fieldPath}.selection`, view, placeholders)
          : undefined,
      }
    } else {
      // Unknown field - preserve as-is
      result[key] = value
    }
  }

  return result
}
```

### Helper Functions

```typescript
type TaggedValue = { $type: string; value: unknown }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !('$type' in value)
}

function matchesPrimitiveMask(value: string | number | boolean, mask: number): boolean {
  if (typeof value === 'string') return (mask & ScalarMask.String) !== 0
  if (typeof value === 'number') return (mask & ScalarMask.Number) !== 0
  if (typeof value === 'boolean') return (mask & ScalarMask.Boolean) !== 0
  return false
}

function matchesTaggedMask(tag: string, mask: number): boolean {
  switch (tag) {
    case 'DateTime': return (mask & ScalarMask.DateTime) !== 0
    case 'Decimal': return (mask & ScalarMask.Decimal) !== 0
    case 'BigInt': return (mask & ScalarMask.BigInt) !== 0
    case 'Bytes': return (mask & ScalarMask.Bytes) !== 0
    case 'Json': return (mask & ScalarMask.Json) !== 0
    default: return false
  }
}

function validateListElement(item: unknown, edge: InputEdge, view: ParamGraphView): boolean {
  const classified = classifyValue(item)

  switch (classified.kind) {
    case 'structural':
      return false  // FieldRef/Enum in list - don't parameterize list

    case 'primitive': {
      const mask = getScalarMask(edge)
      if (mask !== 0 && !matchesPrimitiveMask(classified.value, mask)) {
        return false
      }
      if (edge.e !== undefined && typeof classified.value === 'string') {
        const enumValues = view.enumValues(edge)
        return enumValues?.includes(classified.value) ?? false
      }
      return true
    }

    case 'taggedScalar': {
      const mask = getScalarMask(edge)
      return mask !== 0 && matchesTaggedMask(classified.tag, mask)
    }

    default:
      return false
  }
}

function decodeIfTagged(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && '$type' in value) {
    return decodeTaggedValue(value as TaggedValue)
  }
  return value
}

function decodeTaggedValue(tagged: TaggedValue): unknown {
  if (tagged.$type === 'Bytes') {
    return Buffer.from(tagged.value as string, 'base64')
  }
  return tagged.value
}
```

## Batch Parameterization

```typescript
/**
 * Parameterizes a batch of queries.
 */
export function parameterizeBatch(
  batch: JsonBatchQuery,
  view: ParamGraphView,
): ParameterizeBatchResult {
  const placeholders = new Map<string, unknown>()
  const parameterizedQueries: JsonQuery[] = []

  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]

    // Roots use JSON protocol action names directly
    const rootKey = query.modelName
      ? `${query.modelName}.${query.action}`
      : query.action

    const root = view.root(rootKey)

    parameterizedQueries.push({
      ...query,
      query: parameterizeFieldSelection(query.query, root, `batch[${i}].query`, view, placeholders),
    })
  }

  return {
    parameterizedBatch: { ...batch, batch: parameterizedQueries },
    placeholderValues: Object.fromEntries(placeholders),
    placeholderPaths: [...placeholders.keys()],
  }
}
```

## Fallback Behavior

When `parameterizationSchema` is not available (e.g., older generated clients), fall back to the existing heuristic-based implementation:

```typescript
// parameterize.ts (main entry point)

import type { ParamGraph } from '@prisma/client-common'
import type { RuntimeDataModel } from '@prisma/client-common'
import { createParamGraphView } from './parameterization'
import {
  parameterizeQuery as schemaAwareParameterize,
  parameterizeBatch as schemaAwareParameterizeBatch,
} from './parameterization'
import {
  parameterizeQuery as legacyParameterize,
  parameterizeBatch as legacyParameterizeBatch,
} from './parameterization/legacy'

export function parameterizeQuery(
  query: JsonQuery,
  view: ParamGraphView | undefined,
): ParameterizeResult {
  if (view) {
    return schemaAwareParameterize(query, view)
  }
  return legacyParameterize(query)
}

export function parameterizeBatch(
  batch: JsonBatchQuery,
  view: ParamGraphView | undefined,
): ParameterizeBatchResult {
  if (view) {
    return schemaAwareParameterizeBatch(batch, view)
  }
  return legacyParameterizeBatch(batch)
}
```

The `ParamGraphView` is created once in `getPrismaClient` and passed to the engine:

```typescript
// getPrismaClient.ts
const paramGraphView = config.parameterizationSchema
  ? createParamGraphView(config.parameterizationSchema, config.runtimeDataModel)
  : undefined

// Pass to engine config
this._engineConfig = {
  // ...
  paramGraphView,
}
```

## Edge Cases

### 1. Unknown Fields

Fields not in the ParamGraph (e.g., from client extensions or future API additions) are preserved as-is. This ensures forward compatibility.

### 2. Null Values in Filters

```typescript
// Null is meaningful: find users with no email
{ where: { email: null } }
// Result: { where: { email: null } } - null is NEVER parameterized
// Null affects query semantics (IS NULL vs = value), so it stays in the cache key
```

### 3. Empty Objects

```typescript
// Empty where clause - no fields to process
{ where: {} }
// Result: { where: {} } (unchanged)
```

### 4. Deeply Nested Structures

```typescript
// Complex nested query
{
  where: {
    AND: [
      { id: '1' },
      { OR: [{ name: 'Alice' }, { posts: { some: { title: 'Hello' } } }] }
    ]
  }
}
// Each scalar is parameterized at its correct path
```

### 5. Mixed Arrays

```typescript
// Array with mixed value types (shouldn't happen in valid queries)
{ where: { id: { in: [1, { $type: 'FieldRef', value: {...} }] } } }
// List contains FieldRef - entire list is preserved
```

### 6. Raw Query Arguments

```typescript
// Raw queries have special argument structure
{
  action: 'queryRaw',
  query: {
    arguments: { query: 'SELECT * FROM users WHERE id = $1', parameters: '[1]' }
  }
}
// Raw queries bypass schema-aware parameterization (not in ParamGraph)
```

## Performance Considerations

### Memory Allocation

- Reuse the `PARAM_MARKER` object instead of creating new ones
- Use a single `placeholders` Map instead of building intermediate results
- Build string index once per query (not per field)

### Time Complexity

- String index lookup: O(1) via Map
- Per-field processing: O(1) edge lookup
- Total traversal: O(n) where n = number of values in query

### Optimization Opportunities

1. **Object pooling**: Reuse result objects for hot paths
2. **Lazy string index**: Only build if ParamGraph exists
3. **Early bailout**: Skip entire subtrees with no edges
