# Implementation Task Breakdown

## Overview

This document provides a detailed breakdown of implementation tasks for schema-aware parameterization, including specific files to modify, expected changes, and testing requirements.

## Phase 1: Types and Config

### Task 1.1: Add `isParameterizable` to SchemaArg type

**File**: `packages/dmmf/src/dmmf.ts`

**Change**: Add the `isParameterizable` property to `SchemaArg` type.

```typescript
export type SchemaArg = ReadonlyDeep<{
  name: string
  comment?: string
  isNullable: boolean
  isRequired: boolean
  inputTypes: InputTypeRef[]
  isParameterizable: boolean  // ADD THIS
  requiresOtherFields?: string[]
  deprecation?: Deprecation
}>
```

**Testing**: Run `pnpm --filter @prisma/dmmf test` to ensure type changes don't break anything.

**Status**: ✅ Completed

---

### Task 1.2: Create ParamGraph types

**New File**: `packages/client-common/src/paramGraph.ts`

**Content**: Define all ParamGraph types as specified in [02-parameterization-schema.md](./02-parameterization-schema.md).

```typescript
/**
 * Compact schema for runtime parameterization.
 */
export type ParamGraph = {
  s: string[]           // String table
  en: string[]          // User enum names
  i: InputNode[]        // Input nodes
  o: OutputNode[]       // Output nodes
  r: Record<string, RootEntry>  // Roots
}

export type RootEntry = {
  a?: NodeId  // Args node
  o?: NodeId  // Output node
}

export type NodeId = number

export type InputNode = {
  f?: Record<number, InputEdge>
}

export type OutputNode = {
  f?: Record<number, OutputEdge>
}

export type InputEdge = {
  k: number   // Flags
  c?: NodeId  // Child node
  m?: number  // Scalar mask
  e?: number  // Enum name id
}

export type OutputEdge = {
  a?: NodeId  // Args node
  o?: NodeId  // Output node
}

// Constants
export const enum EdgeFlag {
  ParamScalar = 1 << 0,
  ListScalar  = 1 << 1,
  ListObject  = 1 << 2,
  Object      = 1 << 3,
  Nullable    = 1 << 4,  // Informational only, nulls never parameterized at runtime
}

export const enum ScalarMask {
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

**Update File**: `packages/client-common/src/index.ts`

Add export for the new types:

```typescript
export * from './paramGraph'
```

---

### Task 1.3: Add ParamGraph to GetPrismaClientConfig

**File**: `packages/client-common/src/client-config.ts`

**Change**: Add `parameterizationSchema` to the config type.

```typescript
import type { ParamGraph } from './paramGraph'

export type GetPrismaClientConfig = {
  // ... existing fields
  parameterizationSchema?: ParamGraph
}
```

---

## Phase 2: ParamGraph Generation

### Task 2.1: Create ParamGraph builder for client-generator-ts

**New File**: `packages/client-generator-ts/src/utils/buildParamGraph.ts`

**Implementation**: Build ParamGraph from DMMF following the algorithm in [03-schema-generation.md](../parameterization-codex/03-schema-generation.md).

Key functions to implement:

```typescript
import type { DMMF } from '@prisma/dmmf'
import type { ParamGraph, InputNode, OutputNode, InputEdge, OutputEdge, EdgeFlag, ScalarMask } from '@prisma/client-common'

export function buildParamGraph(dmmf: DMMF.Document): ParamGraph {
  const context = new BuildContext(dmmf)

  // Step 1: Collect user enum names
  context.collectEnumNames()

  // Step 2: Build input nodes from reachable input types
  context.buildInputNodes()

  // Step 3: Build output nodes from output types
  context.buildOutputNodes()

  // Step 4: Build root entries for all operations
  context.buildRoots()

  // Step 5: Finalize string table
  return context.finalize()
}

class BuildContext {
  private dmmf: DMMF.Document
  private stringTable: string[] = []
  private stringIndex = new Map<string, number>()
  private enumNames: string[] = []
  private enumIndex = new Map<string, number>()
  private inputNodes: InputNode[] = []
  private outputNodes: OutputNode[] = []
  private inputTypeToNode = new Map<string, number>()
  private outputTypeToNode = new Map<string, number>()
  private roots: Record<string, { a?: number; o?: number }> = {}

  constructor(dmmf: DMMF.Document) {
    this.dmmf = dmmf
  }

  // ... implementation
}
```

**Key implementation details**:

1. **String table building**: Collect all field names used in edges, assign indices
2. **Enum name collection**: Only user-defined enums (from `dmmf.datamodel.enums`)
3. **Reachability analysis**: Only include types that have parameterizable paths
4. **Union node merging**: Merge fields conservatively when a field accepts multiple input types
5. **Output node pruning**: Only include output fields that lead to parameterizable args

---

### Task 2.2: Integrate ParamGraph into generated client (client-generator-ts)

**File**: `packages/client-generator-ts/src/TSClient/file-generators/ClassFile.ts`

**Changes**:

1. Import the build function
2. Call it during client generation
3. Embed result in generated code

```typescript
import { buildParamGraph } from '../../utils/buildParamGraph'

// In the clientConfig generation:
function clientConfig(context: GenerateContext, options: TSClientOptions) {
  // ... existing code

  const paramGraph = buildParamGraph(context.dmmf)

  return `
const config: runtime.GetPrismaClientConfig = ${JSON.stringify(config, null, 2)}
${buildRuntimeDataModel(context.dmmf.datamodel, runtimeName)}
config.parameterizationSchema = ${JSON.stringify(paramGraph)}
// ... rest
`
}
```

---

### Task 2.3: Port ParamGraph builder to client-generator-js

**New File**: `packages/client-generator-js/src/utils/buildParamGraph.ts`

**Content**: Same logic as Task 2.1. Consider extracting to a shared module if code duplication becomes problematic.

**File**: `packages/client-generator-js/src/TSClient/TSClient.ts`

**Changes**: Same integration as Task 2.2, in the `toJS()` method.

---

## Phase 3: Runtime Parameterizer

### Task 3.1: Create parameterization module structure

**New Directory**: `packages/client/src/runtime/core/engines/client/parameterization/`

**New Files**:

```
parameterization/
├── index.ts       # Re-exports
├── types.ts       # Internal type definitions
├── classify.ts    # Value classification logic
├── traverse.ts    # ParamGraph traversal
└── legacy.ts      # Renamed current implementation
```

---

### Task 3.2: Implement value classification

**File**: `packages/client/src/runtime/core/engines/client/parameterization/classify.ts`

**Content**: Implement `classifyValue` function as specified in [03-runtime-parameterizer.md](./03-runtime-parameterizer.md).

Test cases:
- Primitive values (string, number, boolean)
- Null/undefined
- Tagged scalars (DateTime, Decimal, BigInt, Bytes, Json)
- Tagged structural (FieldRef, Enum, Param, Raw)
- Arrays
- Plain objects

---

### Task 3.3: Implement traversal logic

**File**: `packages/client/src/runtime/core/engines/client/parameterization/traverse.ts`

**Content**: Implement the core traversal functions:
- `parameterizeQuery`
- `parameterizeBatch`
- `parameterizeFieldSelection`
- `parameterizeObject`
- `parameterizeValue`
- `parameterizeSelection`
- Helper functions

---

### Task 3.4: Move legacy implementation

**File**: `packages/client/src/runtime/core/engines/client/parameterization/legacy.ts`

**Content**: Move the existing parameterization logic from `parameterize.ts` to this file as a fallback implementation.

---

### Task 3.5: Update main entry point

**File**: `packages/client/src/runtime/core/engines/client/parameterize.ts`

**Content**: Replace with thin wrapper that delegates to schema-aware or legacy implementation.

```typescript
import type { ParamGraph } from '@prisma/client-common'
import type { RuntimeDataModel } from '@prisma/client-common'
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
  schema: ParamGraph | undefined,
  runtimeDataModel: RuntimeDataModel,
): ParameterizeResult {
  if (schema) {
    return schemaAwareParameterize(query, schema, runtimeDataModel)
  }
  return legacyParameterize(query)
}
```

---

### Task 3.6: Pass ParamGraph to parameterizer from ClientEngine

**File**: `packages/client/src/runtime/core/engines/client/ClientEngine.ts`

**Changes**: Update `request()` method to pass `parameterizationSchema` to parameterizer.

```typescript
// In request() method
const { parameterizedQuery, placeholderValues, placeholderPaths } = parameterizeQuery(
  query,
  this.#config.parameterizationSchema,
  this.#config.runtimeDataModel,
)
```

---

### Task 3.7: Update getPrismaClient to receive ParamGraph

**File**: `packages/client/src/runtime/getPrismaClient.ts`

**Changes**: Ensure `parameterizationSchema` flows through to `ClientEngine`.

```typescript
this._engineConfig = {
  // ... existing config
  parameterizationSchema: config.parameterizationSchema,
}
```

---

## Phase 4: Testing

### Task 4.1: Unit tests for ParamGraph generation

**New File**: `packages/client-generator-ts/src/utils/buildParamGraph.test.ts`

Test cases:
- Simple model with scalar fields
- Model with relations (output node generation)
- Complex filter types (StringFilter, etc.)
- Union types (shorthand notation)
- User enums vs Prisma enums
- All operation types (findMany, create, update, etc.)
- Pruning of non-parameterizable paths

---

### Task 4.2: Unit tests for value classification

**New File**: `packages/client/src/runtime/core/engines/client/parameterization/classify.test.ts`

Test cases:
- Primitive values (string, number, boolean)
- Null/undefined
- Tagged scalars (DateTime, Decimal, BigInt, Bytes, Json)
- FieldRef values
- Enum values (tagged)
- Arrays
- Plain objects
- Edge cases (empty objects, nested structures)

---

### Task 4.3: Unit tests for parameterization traversal

**New File**: `packages/client/src/runtime/core/engines/client/parameterization/traverse.test.ts`

Test cases:
- Basic scalar parameterization
- Filter shorthand vs explicit
- FieldRef preservation
- Nested structures (AND/OR/NOT)
- Array fields (in/notIn) with scalar lists
- Array fields with object lists (createMany)
- Create/update data
- Batch queries
- Nested selection with arguments
- User enum membership validation
- Json field (object value parameterization)
- Null handling (always preserved, never parameterized)
- Unknown fields (preservation)
- Stable cache key ordering

---

### Task 4.4: Integration tests

**New Directory**: `packages/client/tests/functional/schema-aware-parameterization/`

Test cases:
- Cache key correctness for various query shapes
- Shorthand vs explicit filter produces different cache keys
- FieldRef queries work correctly
- All query actions function properly
- Complex queries with multiple nested levels
- Batch queries with mixed operations

---

### Task 4.5: Update existing parameterization tests

**File**: `packages/client/src/runtime/core/engines/client/parameterize.test.ts`

Update tests to:
- Use schema-aware implementation when schema is provided
- Verify backward compatibility with legacy implementation
- Add comparison tests (schema-aware vs legacy produce same results for supported cases)

---

## Phase 5: Performance & Polish

### Task 5.1: Add benchmark tests

**New File**: `packages/client/src/__tests__/benchmarks/parameterization.bench.ts`

Benchmarks:
- Simple query parameterization
- Complex query parameterization (nested filters)
- Batch parameterization
- Compare with legacy implementation
- Measure ParamGraph lookup overhead

---

### Task 5.2: Size measurement

Add CI check for ParamGraph size:
- Generate ParamGraph for test schemas
- Measure uncompressed and gzipped size
- Alert if size exceeds threshold (e.g., 10KB gzipped)

---

### Task 5.3: Documentation

- Add CHANGELOG entry for new feature
- Update internal documentation for parameterization
- Add JSDoc comments to key exported functions

---

## Dependency Graph

```
Phase 1 (Types)
    │
    ├─► Task 1.1 (DMMF types) ✅
    │
    ├─► Task 1.2 (ParamGraph types)
    │         │
    └─► Task 1.3 (Client config)
              │
              ▼
Phase 2 (Generator)
    │
    ├─► Task 2.1 (Build function - TS)
    │         │
    ├─► Task 2.2 (Integration - TS)
    │         │
    ├─► Task 2.3 (Build function - JS)
    │
    ▼
Phase 3 (Runtime)
    │
    ├─► Task 3.1 (Module structure)
    │         │
    ├─► Task 3.2 (Classification)
    │         │
    ├─► Task 3.3 (Traversal)
    │         │
    ├─► Task 3.4 (Legacy move)
    │         │
    ├─► Task 3.5 (Entry point)
    │         │
    ├─► Task 3.6 (ClientEngine)
    │         │
    └─► Task 3.7 (getPrismaClient)
              │
              ▼
Phase 4 (Testing)
    │
    ├─► Task 4.1-4.5 (All tests)
    │
    ▼
Phase 5 (Polish)
    │
    └─► Task 5.1-5.3 (Benchmarks, size, docs)
```

---

## Estimated Impact

| Component | Estimated Size |
|-----------|---------------|
| ParamGraph types | ~1KB |
| Build function | ~3KB |
| Runtime parameterizer | ~4KB |
| ParamGraph data (20 models) | ~3-5KB gzipped |

Total bundle impact: ~10-15KB gzipped for a typical schema.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large ParamGraph size | Size monitoring in CI, pruning unused paths |
| Breaking change in parameterization | Keep legacy implementation, comparison tests |
| Performance regression | Benchmark tests, profile before shipping |
| Missing edge cases | Comprehensive test suite |
| Union type conflicts | Conservative merge, debug logging during generation |

---

## Success Metrics

1. **Correctness**: All existing tests pass + new tests for edge cases
2. **Performance**: No regression in parameterization speed
3. **Size**: ParamGraph adds <10KB gzipped to client bundle
4. **Coverage**: ParamGraph includes all parameterizable paths from DMMF
5. **Cache keys**: Shorthand vs explicit filters produce different, stable cache keys
