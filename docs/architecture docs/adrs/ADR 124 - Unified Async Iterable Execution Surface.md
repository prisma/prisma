# ADR 037 — Unified Async Iterable Execution Surface

## Context

Existing ORMs (including the current Prisma ORM) were designed around the assumption that queries return complete result sets: `Promise<Row[]>`. This architectural foundation, while simpler to reason about, creates fundamental coupling across the entire system:

- Result handling logic assumes all rows are buffered in memory
- Type inference and result mapping depends on knowing the full shape upfront
- Plugins, middleware, and extensions expect to observe complete results
- Relation loading strategies (eager/lazy) depend on controlling the entire fetch lifecycle
- Pagination and filtering are bolted on after the fact as separate concerns

Retrofitting streaming into such systems requires breaking these coupled assumptions throughout the codebase, making it nearly impossible without a ground-up redesign.

Prisma Next takes a different approach: one unified execution surface (`AsyncIterable<Row>`) with an intelligent runtime that decides whether to buffer or stream based on size estimates. This preserves composability and API simplicity while maintaining safety and resource efficiency.

## Decision

Provide a single execution API that always returns `AsyncIterable<Row>`:

- **One entrypoint**: `runtime.execute(plan)` → `AsyncIterable<Row>` for all lanes and workloads
- **Runtime-managed strategy**: Before first emission, the runtime uses EXPLAIN or a probe fetch to estimate size and decide internally whether to buffer or stream
- **Transparent to users**: No API bifurcation, no `stream()` vs `execute()` choice. Developers never pick between features and execution modes
- **Safe defaults**: Configuration lets operators tune thresholds; guardrails protect resource usage

**See ADR 125 for execution mode selection algorithm, config, adapter capabilities, and budgets.**

## Result Types

All Plans execute to async iterables:

```typescript
type ExecuteResult<T> = AsyncIterable<T> & {
  toArray(): Promise<T[]>
  info: {
    executionMode: 'buffer' | 'stream'
    estimatedRows?: number
    estimatedBytes?: number
  }
}
```

Type inference remains unchanged. The result is always wrapped in `AsyncIterable`:

```typescript
const plan = db.user
  .select('id', 'email')
  .build()

// TypeScript infers AsyncIterable<{ id: number; email: string }>
for await (const user of runtime.execute(plan)) {
  // user.id is number, user.email is string
}

// Or collect all rows
const allUsers = await runtime.execute(plan).toArray()
```

## Execution Strategy

Before the first row is emitted:

1. Runtime runs contract verification and pre-execution lints/budgets
2. Runtime obtains size estimates via EXPLAIN (if available) or a small probe fetch
3. Decision is made: buffer or stream (based on config thresholds)
4. Decision is locked and never changes for the life of this iterator
5. Results are yielded according to strategy:
   - **Buffered**: Fetch all rows, close cursor, yield from buffer
   - **Streamed**: Yield chunks as they arrive, keep cursor open

This guarantees:
- ✅ No mid-stream mode flips
- ✅ No partial results on budget violations for buffered queries
- ✅ Efficient resource use (large sets don't buffer unnecessarily)
- ✅ Connection pool protection via cursor limits and idle timeouts

## Configuration

```typescript
const rt = createRuntime({
  ir: contract,
  adapter: postgresAdapter,
  driver,
  execution: {
    defaultMode: 'auto',        // 'auto' | 'buffer' | 'stream'
    thresholds: {
      rows: 1_000,              // if EXPLAIN rows > N → stream
      bytes: 2_000_000,         // if est bytes > N → stream
      firstFetchRows: 256       // probe chunk size for adapters w/o EXPLAIN
    },
    cursor: {
      fetchSize: 1_000,         // rows per batch
      holdable: true,           // prefer holdable cursors to avoid txn pinning
      idleTimeoutMs: 15_000     // abort if no consumer pulls for N ms
    }
  }
})
```

## Why This Design

### Problem it solves
- Most queries are small (< 1K rows) and buffering is faster than cursor setup
- Some queries are large (exports, reports) and need streaming for memory
- Adapters have different streaming capabilities (Postgres good, SQLite less so)
- Users shouldn't pay complexity tax for the rare case

### Benefits
- **One API surface** eliminates false choices between features and modes
- **Composability preserved**: All lanes (DSL, ORM, raw SQL) work identically
- **Resource-efficient**: Small queries fast, large queries memory-safe
- **Adapter-neutral**: Runtime treats streaming as a capability, not a promise
- **Safe defaults**: Configuration + guardrails protect pool and memory
- **Observability**: `.info.executionMode` tells frameworks what happened

### Trade-offs
- Requires EXPLAIN support or probe logic (overhead is minimal and pre-amortized)
- Decision happens before first row (no mid-stream mode switches, more predictable)
- Adapters must implement cursor semantics (see ADR 038)

## Lane Examples

All lanes produce the same result type and behavior. The SQL builder's
`.build()` returns a `SqlQueryPlan` that is iterated through
`runtime.execute(plan)`; the builder itself surfaces eager helpers
(`.all()`, `.first()`, `.firstOrThrow()`) rather than being iterated
directly.

```typescript
// DSL
for await (const user of runtime.execute(db.user.select('id').build())) { }

// ORM with includes
for await (const user of orm.User.include('posts').all()) { }

// Raw SQL
for await (const row of raw({ sql: '...', params: [...], annotations: { ... } })) { }

// All return AsyncIterable<Row> with identical execution mode semantics
```

## Observability & Introspection

The iterator exposes its execution decision:

```typescript
const it = runtime.execute(plan)
console.log(it.info.executionMode)     // 'buffer' | 'stream'
console.log(it.info.estimatedRows)     // from EXPLAIN or probe
console.log(it.info.estimatedBytes)    // estimated memory footprint

for await (const row of it) {
  // ...
}

const summary = it.summary               // available after iteration
console.log(summary.actualRows)          // total rows
console.log(summary.executionMode)       // final mode
```

## Budgets & Guardrails

Budgets apply in both modes:

- **Pre-execution** (fail fast):
  - EXPLAIN row/byte estimates vs maxRows/maxBytes
  - SQL length budget
  - Policy/capability checks
- **In-stream** (terminate on violation):
  - Rows emitted vs maxRows
  - Estimated bytes vs maxBytes
  - Elapsed time vs maxLatencyMs
  - Idle time vs maxIdleMs

On budget violation during streaming, the stream is terminated and the consumer sees an error on `for await`.

## Testing Strategy

- Golden tests asserting execution mode decision (buffer vs stream) for various EXPLAIN outputs
- Probe fetch tests for adapters without EXPLAIN
- Budget enforcement tests (pre-execution and in-stream)
- Resource leak tests (connections returned, cursors closed, timeouts honored)
- Adapter conformance tests for cursor semantics
- End-to-end tests with various result sizes and framework integrations

## Open Questions

- Adaptive heuristics that learn typical patterns per plan
- Optional sampling for high-volume stream telemetry
- Integration with PPg preflight and streaming preview

## Decision Record

Adopt a unified `AsyncIterable<Row>` execution surface with intelligent runtime-managed buffering. The runtime decides whether to buffer (for small queries) or stream (for large queries) based on EXPLAIN estimates or a probe fetch, before the first row is emitted. This preserves API simplicity and composability while maintaining resource efficiency and safety. See ADR 125 for implementation details on mode selection, adapter capabilities, budgets, and observability.
