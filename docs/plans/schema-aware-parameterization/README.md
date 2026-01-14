# Schema-Aware Query Parameterization

## Overview

This document describes the implementation plan for schema-aware query parameterization in Prisma Client. The goal is to replace the current heuristic-based parameterization with a precise, DMMF-driven approach that correctly identifies which query values can be parameterized.

## Problem Statement

The current parameterization implementation in `packages/client/src/runtime/core/engines/client/parameterize.ts` uses context-based heuristics to determine what should be parameterized:

- Values in `where` clauses -> parameterize
- Values in `data` objects -> parameterize
- Values like `take`, `skip`, `mode` -> preserve

This approach has significant limitations:

1. **Cannot handle union types correctly**: A filter field like `{ id: 10 }` (shorthand) vs `{ id: { equals: 10 } }` (explicit) should produce different cache keys
2. **Cannot distinguish FieldRef from scalar values**: FieldRefs are structural and should never be parameterized
3. **Relies on hardcoded key lists**: Fragile and error-prone as the API evolves
4. **No schema validation**: Parameterizes values without knowing their actual types

## Solution: ParamGraph

### Key Insight from prisma-engines

The query compiler in prisma-engines now exposes `isParameterizable: boolean` on every input field in the DMMF. This flag indicates whether a field **can** accept parameterized values. At runtime we must also check the **actual value type** to determine if it **should** be parameterized.

### Summary of the Approach

1. **Compile DMMF into a compact ParamGraph** with two node families:
   - **Input nodes** for argument objects and input types
   - **Output nodes** for selection traversal (nested `arguments`)

2. **Runtime parameterizer walks the JsonQuery tree** guided by ParamGraph:
   - Parameterize scalars only when the field allows it and the value matches the expected type category
   - Recurse into objects only when the field points to a child node
   - Treat FieldRef and structural enum tags as structural (never parameterize)
   - Handle unions by encoding both scalar and object possibilities on the same edge, keyed by runtime value class

3. **Embed ParamGraph in the generated client** and pass it into the ClientEngine to replace the heuristic parameterizer (with legacy fallback)

### Parameterization Rules

1. **`isParameterizable: false`**: Never parameterize at this field. May still recurse into children if the value is an object.

2. **`isParameterizable: true`**: The field can be parameterized, but we must check the runtime value:
   - If the value is a **scalar** (matching a `location: 'scalar'` type) -> **parameterize it**
   - If the value is a **FieldRef** (`{ $type: 'FieldRef', ... }`) -> **preserve it** (structural)
   - If the value is an **object** (matching a `location: 'inputObjectTypes'` type) -> **recurse into it**
   - If the value is a **Prisma enum** (`{ $type: 'Enum', ... }`) -> **preserve it** (structural)
   - If the value is a **user enum** (plain string matching enum values) -> **parameterize it**

### Examples

#### Filter Shorthand vs Explicit

```typescript
// Shorthand: id field has inputTypes: [StringFilter, String] and isParameterizable: true
// Runtime value is scalar "abc" -> parameterize
{ where: { id: "abc" } }
// Result: { where: { id: { $type: 'Param', value: 'query.arguments.where.id' } } }

// Explicit: id field has inputTypes: [StringFilter, String] and isParameterizable: true
// Runtime value is object -> recurse into StringFilter
{ where: { id: { equals: "abc" } } }
// Result: { where: { id: { equals: { $type: 'Param', value: 'query.arguments.where.id.equals' } } } }
```

#### FieldRef Values

```typescript
// equals field has inputTypes: [String, StringFieldRefInput] and isParameterizable: true
// Runtime value is FieldRef -> preserve (don't parameterize)
{ where: { name: { equals: { $type: 'FieldRef', value: { _ref: 'nickname' } } } } }
// Result: unchanged (FieldRef is structural)
```

#### Structural Fields

```typescript
// mode field has inputTypes: [QueryMode] (enum) and isParameterizable: false
// Never parameterize, regardless of value
{ where: { name: { contains: "test", mode: "insensitive" } } }
// Result: { where: { name: { contains: { $type: 'Param', ... }, mode: "insensitive" } } }
```

## Goals

- Parameterize only when the schema allows and the runtime value matches the expected type (scalar vs object vs enum vs FieldRef)
- Skip whole branches that are statically known to contain no parameterizable leaves
- Preserve distinct cache keys for union shape differences (shorthand vs explicit filters, FieldRef vs scalar, etc.)
- Keep runtime overhead minimal (single pass, tiny data structure, no DMMF at runtime)

## Non-Goals

- Changing the query compiler or engine behavior (already implemented in prisma-engines)
- Adding new public API surface. This is internal to the generated client.

## Architecture

### 1. DMMF Types Update

Add `isParameterizable` to `SchemaArg` in `packages/dmmf/src/dmmf.ts`:

```typescript
export type SchemaArg = ReadonlyDeep<{
  name: string
  isNullable: boolean
  isRequired: boolean
  inputTypes: InputTypeRef[]
  isParameterizable: boolean  // NEW
  // ... existing fields
}>
```

### 2. ParamGraph Generation

At client generation time, build a compact data structure that enables fast runtime lookups. This structure will be embedded in the generated client alongside `runtimeDataModel`.

See [02-parameterization-schema.md](./02-parameterization-schema.md) for the detailed data structure design.

### 3. Runtime Parameterizer

Replace the current heuristic-based parameterizer with a schema-driven implementation that uses the generated ParamGraph.

See [03-runtime-parameterizer.md](./03-runtime-parameterizer.md) for the implementation details.

## Implementation Phases

### Phase 1: Types and Config
- Add `isParameterizable` to `SchemaArg` type in `@prisma/dmmf`
- Add `ParamGraph` types in `@prisma/client-common`
- Extend `GetPrismaClientConfig` with `parameterizationSchema`

### Phase 2: Generator (TS + JS)
- Build ParamGraph from DMMF in both generators
- Embed graph in generated client config

### Phase 3: Runtime Parameterizer
- Implement value classification
- Implement ParamGraph traversal
- Integrate with ClientEngine

### Phase 4: Testing & Validation
- Unit tests for generation and runtime
- Integration tests for cache key behavior
- Performance benchmarks

## Files to Modify

| Package | File | Change |
|---------|------|--------|
| `@prisma/dmmf` | `src/dmmf.ts` | Add `isParameterizable` to `SchemaArg` |
| `@prisma/client-common` | `src/paramGraph.ts` | New file for ParamGraph types |
| `@prisma/client-common` | `src/client-config.ts` | Add `parameterizationSchema` to config |
| `@prisma/client-generator-ts` | `src/utils/buildParamGraph.ts` | New file for graph generation |
| `@prisma/client-generator-ts` | `src/TSClient/file-generators/ClassFile.ts` | Embed graph in client |
| `@prisma/client-generator-js` | `src/utils/buildParamGraph.ts` | Same generation logic |
| `@prisma/client-generator-js` | `src/TSClient/TSClient.ts` | Embed graph in client |
| `@prisma/client` | `src/runtime/core/engines/client/parameterization/` | New module for parameterizer |
| `@prisma/client` | `src/runtime/core/engines/client/parameterize.ts` | Thin wrapper with fallback |
| `@prisma/client` | `src/runtime/core/engines/client/ClientEngine.ts` | Pass schema to parameterizer |
| `@prisma/client` | `src/runtime/getPrismaClient.ts` | Pass schema to engine config |

## Success Criteria

- [ ] Correct parameterization for all filter shorthands
- [ ] FieldRef values are never parameterized
- [ ] Structural fields (`mode`, `take`, `skip`, `orderBy`) are never parameterized
- [ ] Union types produce correct, distinct cache keys based on actual value type
- [ ] No performance regression in parameterization speed
- [ ] All existing tests pass
- [ ] New tests cover edge cases

## Related Documents

- [02-parameterization-schema.md](./02-parameterization-schema.md) - ParamGraph data structure
- [03-runtime-parameterizer.md](./03-runtime-parameterizer.md) - Runtime traversal algorithm
- [04-task-breakdown.md](./04-task-breakdown.md) - Concrete implementation tasks
- [05-open-questions.md](./05-open-questions.md) - Design decisions
- [06-typed-placeholders-client.md](./06-typed-placeholders-client.md) - Follow-up task (not initial)
