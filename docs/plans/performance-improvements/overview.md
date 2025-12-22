# Performance Improvement Overview

This document outlines the analysis, strategy, and prioritized tasks for achieving 100x performance improvement in Prisma Client query execution.

## Table of Contents

1. [Baseline Analysis](#baseline-analysis)
2. [Bottleneck Identification](#bottleneck-identification)
3. [Performance Targets](#performance-targets)
4. [Strategy Overview](#strategy-overview)
5. [Track 1: Comprehensive Optimization](#track-1-comprehensive-optimization)
6. [Track 2: Query Plan Caching](#track-2-query-plan-caching)
7. [Prioritized Task List](#prioritized-task-list)

---

## Baseline Analysis

Baseline measurements from Apple M1 Pro, Node.js 24.11.1 (2025-12-22).

### Performance by Component

| Component       | Operation            | Performance       | Notes                            |
| --------------- | -------------------- | ----------------- | -------------------------------- |
| **Serializer**  | 10 rows × 3 cols     | 2,432,520 ops/sec | Extremely fast, not a bottleneck |
| **Serializer**  | 100 rows × 8 cols    | 97,447 ops/sec    | Still very fast                  |
| **Interpreter** | findUnique           | 337,297 ops/sec   | Fast, ~3μs per operation         |
| **Interpreter** | simple select        | 221,216 ops/sec   | Fast                             |
| **Interpreter** | deep nested join     | 34,935 ops/sec    | ~29μs, scales with complexity    |
| **Data Mapper** | 10 rows              | 155,396 ops/sec   | Fast for small result sets       |
| **Data Mapper** | 100 rows             | 12,321 ops/sec    | ~81μs, O(n) scaling              |
| **Compilation** | findUnique simple    | 11,065 ops/sec    | ~90μs per compilation            |
| **Compilation** | blog post page       | 2,176 ops/sec     | ~460μs for complex queries       |
| **Compilation** | instantiate compiler | 1,180 ops/sec     | ~847μs, one-time cost            |
| **End-to-End**  | findUnique by id     | 5,870 ops/sec     | ~170μs total                     |
| **End-to-End**  | blog post page       | 1,124 ops/sec     | ~890μs total                     |

### Key Observations

1. **Query compilation dominates execution time**: For a simple `findUnique`, compilation takes ~90μs while interpreter execution takes ~3μs. Compilation is **30x slower** than execution.

2. **End-to-end performance is capped by compilation**:
   - `findUnique` compilation: 11,065 ops/sec
   - `findUnique` end-to-end: 5,870 ops/sec
   - Compilation accounts for ~53% of total time, with JSON serialization, Wasm boundary crossing, and other overhead accounting for the rest.

3. **Serializer is not a bottleneck**: At 2.4M ops/sec for small results, this is negligible.

4. **Data mapper scales linearly**: 155k ops/sec for 10 rows vs 12k ops/sec for 100 rows suggests room for optimization with larger result sets.

5. **Interpreter is efficient**: At 337k ops/sec for findUnique, interpreter overhead is minimal.

---

## Bottleneck Identification

### Time Budget Analysis (findUnique by id)

Total time: ~170μs (5,870 ops/sec)

| Step                                                | Estimated Time | % of Total |
| --------------------------------------------------- | -------------- | ---------- |
| Query compilation (Wasm)                            | ~90μs          | 53%        |
| JSON.stringify query                                | ~5-10μs        | 3-6%       |
| Wasm boundary crossing                              | ~10-20μs       | 6-12%      |
| Interpreter execution                               | ~3μs           | 2%         |
| Data mapping                                        | ~6μs           | 4%         |
| Result serialization                                | <1μs           | <1%        |
| Other overhead (async, promises, object allocation) | ~40-50μs       | 24-30%     |

### Primary Bottlenecks (in order)

1. **Query Compilation** (~53%): The Wasm query compiler recompiles identical queries on every request.
2. **JavaScript/Wasm Boundary** (~10%): String serialization and crossing Wasm boundary.
3. **Async/Promise Overhead** (~15%): Every query goes through async paths even for sync operations.
4. **Object Allocation** (~10%): Creating intermediate objects throughout the pipeline.
5. **Data Mapping** (4-8%): Recursive object traversal and type conversions.

---

## Performance Targets

| Query Type          | Current       | 100x Target     | 1000x Target      |
| ------------------- | ------------- | --------------- | ----------------- |
| findUnique simple   | 5,870 ops/sec | 587,000 ops/sec | 5,870,000 ops/sec |
| findMany 10 records | 6,799 ops/sec | 679,900 ops/sec | 6,799,000 ops/sec |
| blog post page      | 1,124 ops/sec | 112,400 ops/sec | 1,124,000 ops/sec |

**Reality check**: The interpreter alone achieves 337k ops/sec for findUnique. With query plan caching, we should approach this, achieving **~50-60x improvement**. To reach 100x, we need additional optimizations to the interpreter, data mapper, and overall pipeline.

---

## Strategy Overview

Two parallel, independent tracks:

### Track 1: Comprehensive Optimization

Focus on reducing overhead in each pipeline component:

- Optimize data mapper performance
- Reduce interpreter overhead
- Minimize object allocations
- Optimize hot paths

### Track 2: Query Plan Caching

Eliminate query compilation overhead for repeated queries:

- Auto-parameterize queries to enable caching
- Cache compiled query plans keyed by parameterized query shape
- Bind concrete values at execution time

---

## Track 1: Comprehensive Optimization

### 1.1 Data Mapper Optimization

**Current state**: 155k ops/sec for 10 rows, 12k ops/sec for 100 rows (linear scaling).

**Opportunities**:

- Reduce object allocations in `mapObject()` and `mapField()`
- Pre-compute field mappings instead of iterating `Object.entries()` per row
- Use typed arrays or pre-allocated buffers for large result sets
- Inline common type conversions

### 1.2 Interpreter Optimization

**Current state**: 337k ops/sec for findUnique, 35k ops/sec for deep nested.

**Opportunities**:

- Reduce per-node allocation in `interpretNode()`
- Flatten tail-recursive patterns
- Optimize `attachChildrenToParents()` join logic
- Consider specialized fast paths for common query patterns

### 1.3 Serializer Optimization

**Current state**: Already very fast (2.4M ops/sec for small results).

**Opportunities** (low priority):

- Pre-allocate result arrays
- Avoid `reduce()` overhead with direct indexing

### 1.4 Pipeline Optimization

**Opportunities**:

- Reduce JSON.stringify calls on the query (consider structured cloning or direct Wasm memory access)
- Pool interpreter instances instead of creating new ones per query
- Reduce promise/async overhead for synchronous code paths
- Object pooling for frequently allocated types

---

## Track 2: Query Plan Caching

### Overview

The query compiler already supports parameterized queries (using `{ $type: "Param" }` placeholders). The strategy is to:

1. **Parameterize incoming queries**: Replace scalar values with named placeholders
2. **Cache compiled query plans**: Key by the parameterized query structure
3. **Bind values at execution**: Pass placeholder values to the interpreter

### 2.1 Parameterization Algorithm

**Current state**: `@prisma/sqlcommenter-query-insights` has a strawman implementation in `parameterize.ts`.

**Key insight**: The existing parameterizer uses context-aware traversal:

- `default` context: Most values become params
- `selection` context: Booleans preserved (field selection flags)
- `orderBy` context: Sort directions preserved
- `data` context: All values become params

**Limitations of current approach**:

- Designed for observability, not compilation
- May over-parameterize (e.g., pagination values like `take`/`skip`)
- Doesn't leverage query schema for precise parameterization

### 2.2 Cache Key Generation

**Approach**: Use the parameterized query as the cache key.

**Options**:

1. **JSON.stringify** the parameterized query (simple, moderate performance)
2. **Structural hashing** (compute hash during traversal, faster for cache hits)
3. **Interned query shapes** (pre-compute during client generation)

### 2.3 Placeholder Value Extraction

During parameterization, extract values with their paths:

```typescript
// Input query
{ where: { id: 42, name: "test" } }

// Parameterized
{ where: { id: { $type: "Param" }, name: { $type: "Param" } } }

// Extracted values
{ "where.id": 42, "where.name": "test" }
```

### 2.4 Value Binding

The interpreter already accepts `placeholderValues: Record<string, unknown>`. The query plan's `templateSql` nodes reference placeholders that need to be resolved.

### 2.5 Future: Schema-Driven Parameterization

For correctness and performance, parameterization should be driven by the query schema (DMMF):

- Know exactly which fields can be parameterized
- Handle edge cases (e.g., `mode: 'insensitive'` shouldn't be parameterized)
- Generate parameterization logic at client build time

---

## Prioritized Task List

### Phase 1: Quick Wins (1-2 weeks)

#### T1.1: Implement Strawman Query Plan Cache

**Priority**: P0 (Critical)  
**Track**: 2  
**Effort**: Medium  
**Impact**: High (estimated 10-30x improvement for repeated queries)

Implement a basic query plan cache using the existing `sqlcommenter-query-insights` parameterizer:

1. Create `QueryPlanCache` class with LRU eviction
2. Integrate into `ClientEngine.request()` and `requestBatch()`
3. Extract placeholder values during parameterization
4. Cache key = JSON.stringify(parameterizedQuery)

**Files to modify**:

- `packages/client/src/runtime/core/engines/client/ClientEngine.ts`
- Create `packages/client/src/runtime/core/engines/client/QueryPlanCache.ts`

**Success metric**: Simple findUnique should approach 100k+ ops/sec

---

#### T1.2: Add Query Plan Caching Benchmark

**Priority**: P0 (Critical)  
**Track**: 2  
**Effort**: Small  
**Impact**: Enables measurement

Add benchmarks that specifically measure cached vs uncached query performance:

1. Add "findUnique (cached)" benchmark variant
2. Add "repeated query batch" benchmark
3. Measure cache hit/miss overhead

**Files to modify**:

- `packages/client/src/__tests__/benchmarks/query-performance/query-performance.bench.ts`

---

#### T1.3: Optimize Data Mapper for Hot Paths

**Priority**: P1  
**Track**: 1  
**Effort**: Medium  
**Impact**: Medium (10-20% improvement for large result sets)

Optimize the most frequently executed code paths:

1. Pre-allocate result arrays in `mapArrayOrObject()`
2. Use `for...of` with indices instead of `Object.entries()`
3. Inline trivial type conversions

**Files to modify**:

- `packages/client-engine-runtime/src/interpreter/data-mapper.ts`

---

#### T1.4: Reduce Object Allocations in Interpreter

**Priority**: P1  
**Track**: 1  
**Effort**: Medium  
**Impact**: Medium (5-15% overall improvement)

Minimize object creation in hot paths:

1. Reuse scope objects where possible
2. Pool `QueryInterpreter` instances
3. Avoid intermediate object creation in value handling

**Files to modify**:

- `packages/client-engine-runtime/src/interpreter/query-interpreter.ts`

---

### Phase 2: Core Caching Infrastructure (2-4 weeks)

#### T2.1: Implement Proper Parameterization with Named Placeholders

**Priority**: P0  
**Track**: 2  
**Effort**: Large  
**Impact**: Critical for correctness

Extend parameterization to generate named placeholders matching query compiler expectations:

1. Generate unique placeholder names during traversal
2. Build placeholder value map alongside parameterized query
3. Handle array values correctly (e.g., `{ in: [1, 2, 3] }`)
4. Preserve structural values (`take`, `skip`, `mode`, etc.)

**Files to create/modify**:

- Create `packages/client/src/runtime/core/engines/client/parameterize.ts`
- Reuse/adapt logic from `packages/sqlcommenter-query-insights/src/parameterize/`

---

#### T2.2: Optimize Cache Key Generation

**Priority**: P1  
**Track**: 2  
**Effort**: Medium  
**Impact**: Medium (reduces cache lookup overhead)

Replace JSON.stringify with faster cache key generation:

1. Implement structural hash computation during parameterization
2. Use hash as primary cache key
3. Fall back to full comparison on hash collision

---

#### T2.3: Add Cache Configuration Options

**Priority**: P2  
**Track**: 2  
**Effort**: Small  
**Impact**: Low (developer experience)

Add PrismaClient constructor options for cache tuning:

1. `queryPlanCache.enabled` (default: true)
2. `queryPlanCache.maxSize` (default: 1000)
3. `queryPlanCache.ttl` (optional, default: unlimited)

**Files to modify**:

- `packages/client/src/runtime/getPrismaClient.ts`
- `packages/client/src/runtime/utils/validatePrismaClientOptions.ts`
- Generator files for types

---

### Phase 3: Schema-Driven Optimization (4-8 weeks)

#### T3.1: Extend DMMF with Parameterization Metadata

**Priority**: P1  
**Track**: 2  
**Effort**: Large  
**Impact**: High (enables correct parameterization)

Add information to DMMF/query schema about which values can be parameterized:

1. Mark scalar filter fields as parameterizable
2. Mark `data` object fields as parameterizable
3. Identify structural fields that must not be parameterized

**Requires**: Changes to prisma-engines (schema crate, DMMF generation)

---

#### T3.2: Generate Parameterization Logic at Build Time

**Priority**: P2  
**Track**: 2  
**Effort**: Large  
**Impact**: High (eliminates runtime traversal)

Generate model-specific parameterization functions during client generation:

1. Each model gets a `parameterize[Model][Action]()` function
2. Functions are specialized for the specific query shape
3. Eliminates runtime object traversal for known shapes

**Files to modify**:

- `packages/client-generator-js/`
- `packages/client-generator-ts/`

---

#### T3.3: Implement Pre-compiled Query Templates

**Priority**: P3  
**Track**: 2  
**Effort**: Extra Large  
**Impact**: Very High (compile common queries at build time)

For known query shapes, pre-compile query plans during client generation:

1. Identify common query patterns
2. Compile parameterized query plans at build time
3. Store compiled plans in generated client
4. At runtime, just bind values and execute

---

### Phase 4: Advanced Optimizations (Ongoing)

#### T4.1: Optimize Wasm Boundary Crossing

**Priority**: P2  
**Track**: 1  
**Effort**: Large  
**Impact**: Medium (10-15% improvement)

Reduce overhead of crossing JS/Wasm boundary:

1. Explore SharedArrayBuffer for query passing
2. Consider batching multiple compile requests
3. Profile and optimize memory allocation patterns

---

#### T4.2: Implement Synchronous Fast Path

**Priority**: P3  
**Track**: 1  
**Effort**: Large  
**Impact**: Medium (reduces promise overhead for simple queries)

For simple cached queries that don't need transactions:

1. Provide synchronous execution path
2. Avoid unnecessary async wrapping
3. Reduce microtask queue pressure

---

#### T4.3: Connection Pool Optimization

**Priority**: P2  
**Track**: 1  
**Effort**: Medium  
**Impact**: Medium (reduces latency for concurrent queries)

Optimize connection handling for high-throughput scenarios:

1. Pre-warm connection pool
2. Optimize transaction manager for batch operations
3. Reduce lock contention

---

## Appendix: Quick Reference

### Current Query Flow

```
PrismaClient.user.findUnique({ where: { id: 1 } })
    ↓
JSON.stringify(query)                    [~5-10μs]
    ↓
queryCompiler.compile(queryStr)          [~90μs] ← MAJOR BOTTLENECK
    ↓
executor.execute(plan, placeholders)     [~3μs]
    ↓
QueryInterpreter.run(plan, queryable)
    ↓
driverAdapter.query(sql, params)         [~0μs in benchmarks]
    ↓
serializeSql(resultSet)                  [<1μs]
    ↓
applyDataMap(data, structure)            [~6μs]
    ↓
Return result
```

### Target Query Flow (with caching)

```
PrismaClient.user.findUnique({ where: { id: 1 } })
    ↓
parameterize(query) → (key, values)      [~5μs target]
    ↓
cache.get(key) → plan (HIT)              [~1μs target]
    ↓
executor.execute(plan, values)           [~3μs]
    ↓
QueryInterpreter.run(plan, queryable)
    ↓
driverAdapter.query(sql, params)
    ↓
serializeSql(resultSet)                  [<1μs]
    ↓
applyDataMap(data, structure)            [~6μs]
    ↓
Return result

Total target: ~15-20μs = ~50,000-66,000 ops/sec
```

### Files to Understand

| File                                                                    | Purpose                                       |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| `packages/client/src/runtime/core/engines/client/ClientEngine.ts`       | Query compilation and execution orchestration |
| `packages/client/src/runtime/core/engines/client/LocalExecutor.ts`      | Local query execution with driver adapters    |
| `packages/client-engine-runtime/src/interpreter/query-interpreter.ts`   | Query plan interpretation                     |
| `packages/client-engine-runtime/src/interpreter/data-mapper.ts`         | Result set to object mapping                  |
| `packages/client-engine-runtime/src/interpreter/serialize-sql.ts`       | SQL result set serialization                  |
| `packages/sqlcommenter-query-insights/src/parameterize/parameterize.ts` | Strawman parameterization                     |
| `packages/client-common/src/QueryCompiler.ts`                           | Query compiler interface                      |

### Related Benchmarks

| Benchmark          | Location                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- |
| End-to-end queries | `packages/client/src/__tests__/benchmarks/query-performance/query-performance.bench.ts` |
| Query compilation  | `packages/client/src/__tests__/benchmarks/query-performance/compilation.bench.ts`       |
| Interpreter        | `packages/client-engine-runtime/bench/interpreter.bench.ts`                             |
| Data mapper        | `packages/client-engine-runtime/bench/data-mapper.bench.ts`                             |
| Serializer         | `packages/client-engine-runtime/bench/serializer.bench.ts`                              |
