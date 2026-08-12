# ADR 025 — Plan caching & memoization in runtime

## Context

Plans are immutable units of execution produced by lanes and consumed by the runtime. Lowering and compilation are deterministic but non-zero cost, especially under bursty load. Some runtime guardrails (lints, EXPLAIN budgets) and adapter work benefit from reuse across identical or structurally equivalent Plans. We must avoid caching anything that leaks secrets or ties cache entries to a specific environment, contract, or adapter version.

## Decision

Introduce a two-tier memoization strategy inside the runtime:
- **Shape cache (primary)**: Reuses results for structurally equivalent Plans that differ only by parameter values. Keyed by a stable SQL fingerprint and environment guards, it stores lowered templates, parameter order, normalized annotations, and optional prepared statement handles
- **Exact Plan cache (opportunistic)**: Reuses work for byte-identical Plans produced repeatedly within a process. Keyed by planHash, it is smaller and mostly useful for factories that emit the same Plan object across calls

Both caches are strictly in-process, non-persistent, and evicted by LRU with size and TTL caps. Cache entries are invalidated on contract change or capability profile change (discovery results), or on adapter version change that affects lowering shape

## What we cache

### Shape cache entries
- **Lowered template**:
  - SQL targets: normalized SQL with placeholders, stable parameter ordering, identifier quoting decisions
  - Non-SQL targets: normalized pipeline or command array with placeholder markers
- **Derived metadata**:
  - Normalized annotations that are parameter-independent (e.g., intent, isMutation, projection keys)
  - Lint precomputation that does not depend on parameter values
  - Optional adapter hints such as safe prepare strategy or cursor usage
- **Optional handles**:
  - Prepared statement handle ids per connection when the adapter supports safe reuse
  - These handles are stored in a secondary per-connection PS cache, not in the shared shape cache

### Exact Plan cache entries
- Fully lowered payload identical to the incoming Plan
- Parameter-independent lint results and policy classification
- Never stores the concrete parameter values for telemetry or replay

## Keys

### Fingerprints and guards
- **sqlFingerprint**: Normalized text that removes literal values, canonicalizes whitespace, stable aliasing, and placeholder forms
- **Guards for environment and determinism**:
  - coreHash
  - profileHash (declared capability set)
  - adapterVersion
  - laneVersion optional, used only if the lane affects lowering shape
- Note that cache keys remain (sqlFingerprint, profileHash, coreHash) regardless of authoring mode
- Clarify invalidation when canonicalVersion changes without coreHash change (no invalidation required)

### Keys per tier
- **Shape cache key**: key = hash(sqlFingerprint, coreHash, profileHash, adapterVersion)
- **Exact Plan cache key**: key = planHash as defined in ADR 013

## Invalidation
- **Contract change**: When the runtime's active contract changes, invalidate both caches
- **Capability profile change**: On capability discovery change (profileHash differs), invalidate both caches
- **Adapter version change**: On adapter upgrade that affects lowering shape, invalidate both caches
- **Lane upgrade that affects shape**: If a lane release changes lowering shape, bump laneVersion so fingerprints diverge naturally
- **Adapter signaled invalidation**: Adapters may signal a shape family is invalid (e.g., DDL that changes identifier quoting) to flush matching entries
- **Time-based TTL**: Default TTL 10–30 minutes for shape entries, 1–5 minutes for exact Plan entries
- **LRU eviction**: Memory pressure evicts least-recently used entries within size caps

## Memory limits
- **Global shape cache**: Default 5k–20k entries with an approximate 1–2 KB per entry budget; Configured by entry count and optional byte ceiling, evicted by LRU
- **Exact Plan cache**: Default 0–1k entries as a small opportunistic cache
- **Prepared statement caches**: Per-connection caches sized 500–2k handles with LRU eviction; Managed by the adapter and governed by ADR 095

## Execution flow with caches
1. Runtime receives Plan and computes planHash and sqlFingerprint
2. Attempt shape cache lookup using sqlFingerprint + guards
   - On hit, reuse lowered template and parameter order, materialize concrete payload with current params
   - Optionally bind to a prepared statement handle from the per-connection PS cache
3. If shape miss, perform lowering, populate shape cache, then proceed
4. Optionally record into exact Plan cache if repeated byte-identical Plans are expected
5. Execute via adapter driver and proceed with hooks

## What we do not cache
- Concrete parameter values or rows
- Raw SQL text in artifacts unless explicitly enabled for debug
- EXPLAIN results in the Plan caches (EXPLAIN uses a separate cache keyed by sqlFingerprint + coreHash + profileHash + adapterVersion with its own TTL policy per ADR 088 and ADR 023)

## Observability
- **Expose counters and gauges**:
  - Shape cache hit ratio, miss ratio, evictions, current size
  - Exact Plan cache hit ratio and size
  - PS cache hit ratio per connection and invalidations
- **Trace attributes**:
  - plan.cache.shape = hit|miss
  - plan.cache.exact = hit|miss
  - plan.sqlFingerprint for high-cardinality-controlled environments only

## Security and privacy
- No parameters or row data stored in caches
- Keys avoid embedding sensitive identifiers beyond fingerprints and hashes
- Caches live only in process memory and are never serialized to disk

## Alternatives considered
- **Single exact Plan cache only**: Simpler but poor hit rates because params differ frequently
- **Persistent shared cache**: Higher hit rates across processes but increases complexity, leak risk, and cross-env coupling
- **AST cache pre-lowering**: Viable but offers less benefit than shape caching because AST build cost is already sub-millisecond

## Risks
- **Over-aggressive caching can retain outdated lowering decisions if invalidation paths are missed**: Mitigated by conservative guard set and adapter signaled invalidation
- **Prepared statement handle reuse may cause server-side errors after DDL**: Mitigated by adapter-managed PS invalidation and safe fallbacks

## Configuration defaults
```json
{
  "runtime": {
    "caching": {
      "shape": { "maxEntries": 10000, "ttlMs": 1800000 },
      "exact": { "maxEntries": 500, "ttlMs": 300000 },
      "preparedStatements": { "perConnectionMax": 1000 }
    }
  }
}
```

## Open questions
- Should we expose a cache API for lanes that want to memoize expensive projection typing results
- Do we include laneVersion in the shape key by default or only for lanes known to influence lowering shape
- Should the runtime opportunistically pre-warm shapes on startup from a recorded fingerprint set for latency-critical paths
