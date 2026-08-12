# Follow-up refactorings

Out-of-scope work surfaced during M1 implementation. None of these block the April stop condition; they're recorded so they're not lost.

## Drop the `Row` generic from `runWithMiddleware`

**Status:** deferred. Not blocking; the existing casts work.

**Where it surfaced:** TML-2143 M1.3, code review on the `intercept` wiring.

### The smell

`runWithMiddleware<TExec, Row>` is generic over `Row`, but the orchestrator never knows or cares what `Row` is. Its job is to flow rows from a source (driver or interceptor) to the consumer. The middleware contract says rows are `Record<string, unknown>` — that's what `onRow` already sees, what `runDriver` produces, and what `InterceptResult.rows` carries. The consumer's `Row` is whatever the caller asked for at the outer `execute<Row>(plan)` boundary.

The `Row` generic on `runWithMiddleware` serves no purpose other than letting the runtime layer pretend the structural mismatch doesn't exist. The cost is two compounding `as`-casts:

1. In `RuntimeCore.execute`, `runDriver(exec) as AsyncIterable<Row>` — pre-existing.
2. In `runWithMiddleware`'s intercept hit path (M1.3), `result.rows as unknown as AsyncIterable<Row> | Iterable<Row>` — added for `intercept`, compounds the lie.

Both casts work because the orchestrator only ever yields rows through, never inspects them. But they're load-bearing fictions: change the contract and they break silently.

### Why making `intercept` generic over `Row` doesn't help

The intuitive alternative — `intercept?<Row>(plan, ctx): Promise<InterceptResult<Row> | undefined>` — pushes the problem onto middleware authors:

- Cache middleware stores wire-format rows. It can't materialize typed `Row`s on a hit; it doesn't know what `Row` the caller asked for.
- It would be asymmetric with `onRow`, which is `Record<string, unknown>`. Making `intercept` typed but `onRow` untyped is incoherent.
- It hides the cast inside every middleware implementation instead of fixing it.

### The actual fix

Drop the `Row` generic from `runWithMiddleware` entirely. The orchestrator only flows `Record<string, unknown>`. A single `as Row` cast lives in exactly one place — `RuntimeCore.execute` — where the contract is honest: "the driver and interceptors produce Records; the consumer asked for a typed `Row`; here's where we bridge."

Proposed shape:

```typescript
// run-with-middleware.ts
export function runWithMiddleware<TExec extends ExecutionPlan>(
  exec: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec>>,
  ctx: RuntimeMiddlewareContext,
  runDriver: () => AsyncIterable<Record<string, unknown>>,
): AsyncIterableResult<Record<string, unknown>>;

// runtime-core.ts — one cast at the consumer boundary
execute<Row>(plan: TPlan & { readonly _row?: Row }): AsyncIterableResult<Row> {
  const self = this;
  async function* generator(): AsyncGenerator<Row, void, unknown> {
    const compiled = await self.runBeforeCompile(plan);
    const exec = await self.lower(compiled);
    for await (const row of runWithMiddleware(
      exec,
      self.middleware,
      self.ctx,
      () => self.runDriver(exec),
    )) {
      yield row as Row;
    }
  }
  return new AsyncIterableResult(generator());
}
```

This matches the pattern `SqlRuntimeImpl.executeAgainstQueryable` already uses: it calls `runWithMiddleware<…, Record<string, unknown>>` (raw rows) and casts to `Row` only after `decodeRow` runs. Both family runtimes converge on the same shape: orchestrator flows Records, family runtime does decode + cast in one wrapping pass.

### Net effect on the codebase

Small and localized.

1. **`packages/1-framework/1-core/framework-components/src/run-with-middleware.ts`** — drop the `Row` generic. `rowSource` becomes `AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>`. The `as unknown as AsyncIterable<Row> | Iterable<Row>` cast on the intercept path goes away entirely.
2. **`packages/1-framework/1-core/framework-components/src/runtime-core.ts`** — `RuntimeCore.execute` rewraps the orchestrator output with `yield row as Row`. The pre-existing `runDriver(exec) as AsyncIterable<Row>` cast goes away — `runDriver` is passed through unchanged.
3. **`packages/2-sql/5-runtime/src/sql-runtime.ts`** — `executeAgainstQueryable` drops its `<SqlExecutionPlan, Record<string, unknown>>` type arguments on the `runWithMiddleware` call (there's only one generic now). Decode wrapping is otherwise unchanged.
4. **Test files** — the existing `runWithMiddleware<MockExec, Record<string, unknown>>` calls in `framework-components/test/run-with-middleware.test.ts`, `framework-components/test/run-with-middleware.intercept.test.ts`, `framework-components/test/mock-family.test.ts`, `framework-components/test/runtime-core.test.ts`, and `test/integration/test/cross-package/cross-family-middleware.test.ts` become `runWithMiddleware<MockExec>` (or equivalent). Mostly mechanical — drop the second type arg.

### Why deferred

- The TML-2143 PR is already substantial. Folding in a refactor of the orchestrator signature would expand its review surface materially.
- The casts work today and are not a correctness hazard — both families flow `Record<string, unknown>` through the orchestrator and decode/cast at the boundary.
- A standalone PR can be reviewed against just the framework-components and family-runtime packages without dragging in the cache middleware project's other concerns.

### Sequencing

Land after TML-2143 M1 merges. Doesn't block M2 or M3.

## Thread user annotations into nested-mutation and MTI-variant internal SQL statements

**Status:** deferred. Not blocking the April stop condition.

**Where it surfaced:** TML-2143 M2.5 / M2.6 / aggregate-terminal implementation.

### What landed in M2

> **Status update.** The variadic shape described below shipped in M2 and is the current behavior. It is being replaced by a meta-callback configurator (`(meta) => meta.annotate(...)`); see `api-revision-meta-callback.md` for the delta spec. The threading paths described here (state-driven for `all`/`first`, post-wrap for aggregates and writes) carry over unchanged — only the call-site shape and the per-terminal entry-point methods change.

The variadic annotation argument is now available on every user-facing query-issuing terminal of `Collection` and `GroupedCollection`:

- **Read terminals (state-driven):** `all`, `first`. Annotations flow via `state.userAnnotations`, which `compileSelect` and `compileSelectWithIncludes` thread to `buildOrmQueryPlan`.
- **Read terminals (post-wrap):** `Collection.aggregate`, `GroupedCollection.aggregate`. Annotations are merged into the compiled plan via `mergeUserAnnotations` after `compileAggregate` / `compileGroupedAggregate` runs.
- **Write terminals (post-wrap):** `create`, `createAll`, `createAndCount`, `update`, `updateAll`, `updateAndCount`, `delete`, `deleteAll`, `deleteAndCount`, `upsert`. Each post-wraps the compiled mutation plan(s) before dispatch.

The runtime gate (`assertAnnotationsApplicable`) fires inside `#withAnnotations` (read state path) or `#buildAnnotationsMap` (post-wrap path), so cast-bypass cases throw `RUNTIME.ANNOTATION_INAPPLICABLE`.

`count`, `sum`, `avg`, `min`, `max` on `Collection` are deliberately not in scope: they live in include-refinement mode (build a scalar projection descriptor inside an `include(...)` callback, not a query-issuing terminal). They're projection helpers, not terminals.

### What is deferred

Two paths intentionally do not yet thread user annotations into the constituent SQL statements they issue:

1. **Nested-mutation paths** — `executeNestedCreateMutation` / `executeNestedUpdateMutation`. When the input to `create()` / `update()` contains nested-mutation callbacks (e.g. `posts: (posts) => posts.create(...)` inside a `User.create({...})` call), the operation runs as a graph of internal queries via `withMutationScope` and `createGraph` / `updateFirstGraph`. The terminal validates the kind (the runtime gate fires) and the annotation is applied to the logical user-facing call, but the per-statement queries inside the graph do not see it.
2. **MTI variant create paths** — `#executeMtiCreate`. Same shape: a multi-statement transaction issuing one `INSERT` against the base table and another against the variant table, with reads stitching them. The terminal validates and the annotation is applied to the logical call, but the constituent INSERTs do not currently carry it.

### Why deferred

- The cache middleware (M3) intercepts only reads, so this affects no consumer in the April scope. Mutations are structurally rejected at the lane by the applicability gate (`cacheAnnotation` declares `applicableTo: ['read']`); the type system stops them before they reach the runtime.
- The semantics of "annotation applied to a logical operation that decomposes into many statements" is itself a design question. Should the annotation copy onto every statement, or only some of them? Should the runtime see one logical event or N statement-level events? Both choices are defensible; neither is forced by any current consumer. Leaving it unanswered until a real annotation needs the answer keeps us honest.

### Implementation note for the follow-up

For the nested-mutation path, the simplest mechanical approach: pass the annotations map into `executeNestedCreateMutation` / `executeNestedUpdateMutation` and have `createGraph` / `updateFirstGraph` (or the lower-level statement issuers they call) apply `mergeUserAnnotations` to each plan they build. The threading is wide but mechanical. For MTI, the `#executeMtiCreate` body already builds two compiled plans (`baseCompiled`, `variantCompiled`); each can be post-wrapped at the call site.

### Sequencing

Land if/when an annotation-consuming middleware needs visibility into the per-statement plans of these multi-statement operations. Until then, validating at the terminal and skipping the per-statement plumbing is a defensible default.