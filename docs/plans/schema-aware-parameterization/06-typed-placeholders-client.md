# Typed Placeholders in Client (Follow-up Task)

## Status

**NOT PART OF INITIAL IMPLEMENTATION**

This document describes a follow-up enhancement to enable typed placeholders, which allows more aggressive parameterization by carrying type information in placeholder values.

## Problem Statement

With untyped placeholders, union conflicts force conservative behavior:

```typescript
// Field accepts both String and Int (hypothetical)
// With untyped placeholders, we can't parameterize because:
// - Value "123" could be String or Int
// - Query compiler doesn't know which type to use
{ field: "123" }  // Don't parameterize - ambiguous

// With typed placeholders:
{ field: { $type: 'Param', value: { name: 'path.field', type: 'String' } } }
// Now query compiler knows the intended type
```

## Goal

Enable typed placeholders so:
1. Union-merged scalar masks can be parameterized without ambiguity
2. Query compiler can validate placeholder types precisely
3. Cache keys remain correct and stable

## Proposed Placeholder Shape

### Current (Untyped)

```typescript
{ $type: 'Param', value: '<path>' }
```

### Proposed (Typed)

```typescript
{ $type: 'Param', value: { name: '<path>', type: '<ScalarType>' } }
```

Where `type` is one of:
- `String`
- `Int`
- `Float`
- `Boolean`
- `DateTime`
- `Decimal`
- `BigInt`
- `Bytes`
- `Json`
- `<EnumName>` (for user enums)

## Scope

### Client Changes

1. **Runtime parameterizer**: Emit typed placeholders with scalar type

```typescript
// parameterization/traverse.ts
function handlePrimitive(
  value: string | number | boolean,
  edge: InputEdge,
  path: string,
  ctx: TraversalContext,
): unknown {
  // ... validation ...

  const scalarType = inferScalarType(value, edge.m)
  ctx.placeholders.set(path, value)
  return {
    $type: 'Param',
    value: { name: path, type: scalarType }
  }
}

function inferScalarType(value: unknown, mask: number): string {
  if (typeof value === 'string') return 'String'
  if (typeof value === 'number') {
    // Use mask to distinguish Int vs Float
    if (mask & ScalarMask.Number) {
      return Number.isInteger(value) ? 'Int' : 'Float'
    }
  }
  if (typeof value === 'boolean') return 'Boolean'
  return 'String' // fallback
}
```

2. **ParamGraph builder**: Allow union-merged scalar masks instead of omitting

```typescript
// When variants disagree, merge masks instead of omitting
function mergeScalarMasks(masks: number[]): number {
  return masks.reduce((acc, m) => acc | m, 0)
}
```

3. **JSON protocol types**: Add typed param variant

```typescript
// packages/json-protocol/src/index.ts
export type JsonInputTaggedValue =
  | { $type: 'DateTime'; value: string }
  | { $type: 'Decimal'; value: string }
  | { $type: 'BigInt'; value: string }
  | { $type: 'Bytes'; value: string }
  | { $type: 'FieldRef'; value: { _ref: string; _container?: string } }
  | { $type: 'Enum'; value: string }
  | { $type: 'Raw'; value: unknown }
  | { $type: 'Param'; value: string }  // Untyped (legacy)
  | { $type: 'Param'; value: { name: string; type: string } }  // Typed (new)
```

### Query Compiler Changes

Required in `prisma-engines`:

1. Parse typed placeholder format
2. Validate placeholder type matches expected input type
3. Reject mismatched types with clear error message

See: `docs/plans/parameterization/tasks/05-typed-placeholders-qc.md` in prisma-engines

## Implementation Notes

### Backward Compatibility

- Query compiler must accept BOTH untyped and typed placeholders
- Runtime should detect query compiler capability before emitting typed placeholders
- Fallback to untyped when query compiler doesn't support typed

### Enum Handling

For user enums, emit the enum name as the type:

```typescript
{ $type: 'Param', value: { name: 'path.role', type: 'Role' } }
```

Query compiler validates the value is a valid member of the enum.

### Migration Path

1. **Phase 1**: Ship typed placeholders with feature flag
2. **Phase 2**: Enable by default after validation
3. **Phase 3**: Consider deprecating untyped placeholders

## Files to Modify

| Package | File | Change |
|---------|------|--------|
| `@prisma/json-protocol` | `src/index.ts` | Add typed Param variant |
| `@prisma/client` | `parameterization/traverse.ts` | Emit typed placeholders |
| `@prisma/client-generator-*` | `buildParamGraph.ts` | Merge masks instead of omitting |

## Dependencies

- Requires query compiler parser changes
- Requires coordination with prisma-engines team
- Should ship after initial schema-aware parameterization is stable

## Acceptance Criteria

1. Typed placeholders carry scalar type for all parameterized values
2. Query compiler validates and accepts typed placeholders
3. Union-merged fields are parameterized when safe
4. Cache keys remain stable
5. No regression for existing queries

## Example

### Before (Untyped)

```typescript
// Field accepts String | StringFilter
// Runtime value is "abc" (string)
// Union with StringFilter causes ambiguity concern
// Result: might not parameterize due to conservative rules

{ where: { name: "abc" } }
// Output: { where: { name: "abc" } }  // Not parameterized (worst case)
```

### After (Typed)

```typescript
// Same field, same value
// Now we can safely parameterize because type is explicit

{ where: { name: "abc" } }
// Output: { where: { name: { $type: 'Param', value: { name: 'query.arguments.where.name', type: 'String' } } } }
```

## Future Extensions

### Type-Aware Cache Keys

With typed placeholders, cache keys could include type information:

```typescript
// Cache key structure
{
  query: { ... },
  placeholderTypes: {
    'query.arguments.where.name': 'String',
    'query.arguments.where.age': 'Int',
  }
}
```

This enables same-path-different-type scenarios to have distinct cache entries (if ever needed).

### Placeholder Validation

Query compiler could surface better error messages:

```
Error: Placeholder 'query.arguments.where.age' has type 'String' but field expects 'Int'
```

This helps catch client-side bugs during development.
