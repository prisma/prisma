# API revision: ORM terminal annotations as a meta-callback

**Status:** landed. Supersedes the variadic `...annotations` shape on ORM terminals shipped in M2 and pinned by `spec.md` Functional Requirement #6.

**Scope:** ORM `Collection` and `GroupedCollection` terminals only. SQL DSL `.annotate(...)` is unaffected (see "Why SQL DSL is out of scope" below).

## Summary

Replace the variadic `...annotations: As & ValidAnnotations<K, As>` last argument on every ORM terminal with a single optional callback whose parameter is a typed `MetaBuilder<K>`:

```typescript
// Before (shipped in M2)
await db.orm.User.all(cacheAnnotation({ ttl }));
await db.orm.User.first({ id }, cacheAnnotation({ ttl }));
await db.orm.User.where({ id }).first(cacheAnnotation({ ttl }));

// After
await db.orm.User.all((meta) => meta.annotate(cacheAnnotation({ ttl })));
await db.orm.User.first({ id }, (meta) => meta.annotate(cacheAnnotation({ ttl })));
await db.orm.User.where({ id }).first(undefined, (meta) =>
  meta.annotate(cacheAnnotation({ ttl })),
);
```

The callback receives a `MetaBuilder<K>` whose `annotate(annotation)` method takes one annotation, validates it eagerly against the terminal's operation kind `K`, records it, and returns the builder for chaining.

**Note on `first(...)` shape.** `first` keeps its existing positional dispatch — a single function arg is interpreted as a filter callback (`first((model) => model.field.eq(...))`), matching shipped semantics. To attach a configurator without a filter, pass `undefined` as the first argument: `first(undefined, (meta) => …)`. The runtime cannot disambiguate "single function = filter vs. single function = configurator" without invoking it; explicit `undefined` keeps positional dispatch unambiguous and side-effect-free. The original spec example `where({ id }).first((meta) => …)` therefore becomes `where({ id }).first(undefined, (meta) => …)` — a minor ergonomic concession compared to a probe-based dispatcher, but the implementation is simpler and the semantics are predictable.

## Why

**The variadic forecloses on growth.** A terminal whose last positional argument is a variadic of annotations cannot grow new positional or named per-query options without a breaking change. There is no future shape `db.orm.User.find(input, { … }, ann1, ann2)` we can evolve into without churning every call site, and the variadic-tuple inference rules make alternatives like `find(input, { annotations: [ann1, ann2], timeout: 5_000 })` lose the applicability gate that the `As & ValidAnnotations<K, As>` intersection currently enforces. The callback shape sidesteps both: per-query options become methods on `MetaBuilder<K>`, and adding a method (`meta.timeout(...)`, `meta.tag(...)`, `meta.cancellation(signal)`) is a non-breaking surface extension.

**The callback drops a load-bearing TypeScript trick.** Today every variadic terminal carries the `As & ValidAnnotations<'read', As>` intersection (see `ValidAnnotations` TSDoc and `follow-ups.md` Open Items). The intersection exists because TypeScript's variadic-tuple inference is too forgiving: without it, an inapplicable annotation would silently typecheck. The callback hands one annotation at a time to `meta.annotate(...)`, which uses an ordinary conditional constraint — no variadic-tuple inference involved, no intersection, no documented "load-bearing trick".

**The callback removes the `isAnnotationValue` discriminator inside `first`.** The shipped `first(filterOrFirstAnnotation, ...rest)` runtime branches on `isAnnotationValue(filterOrFirstAnnotation)` to decide whether the first positional argument is a filter or an annotation (collection.ts:686). Once annotations move into the callback, `first(filter?, configure?)` is unambiguous: positional 1 is the filter, positional 2 is the configurator. The dispatch shrinks to a few lines.

**The callback aligns with the rest of the ORM client's mental model.** `.where((model) => …)`, `.include((collection) => …)`, `.aggregate((agg) => …)`, `.having((having) => …)` already use callback configurators. A meta-configurator slots into the same mental model — "the optional last argument is a function that receives a typed builder."

**A note on what "terminal variadic" means.** The user-facing concern is specifically variadics on terminal methods, where the next argument we want to add is a per-call option. Chainable builder methods like SQL DSL `.annotate(...)` are not terminals — they return a new builder that participates in further chaining — and growth of *that* surface happens via additional methods on the builder, not via additional arguments on `.annotate()` itself. SQL DSL stays as it is.

## The shape in detail

### `MetaBuilder<K>`

```typescript
// packages/1-framework/1-core/framework-components/src/meta-builder.ts (new)
import type { AnnotationValue, OperationKind } from './annotations';

/**
 * Per-terminal meta configurator. The terminal's operation kind `K` is fixed
 * by the terminal that constructed the builder; `annotate` accepts any
 * annotation whose declared `Kinds` includes `K`.
 *
 * The conditional `K extends Kinds ? AnnotationValue<P, Kinds> : never`
 * collapses the parameter type to `never` for inapplicable annotations,
 * surfacing the mismatch as a type error at the call site of `meta.annotate`.
 * No variadic-tuple inference is involved — TypeScript infers `Kinds` from
 * the annotation argument, then checks the conditional.
 */
export interface MetaBuilder<K extends OperationKind> {
  annotate<P, Kinds extends OperationKind>(
    annotation: K extends Kinds ? AnnotationValue<P, Kinds> : never,
  ): this;
}
```

The reference implementation is a small class (or factory) that holds the terminal's `kind`, the `terminalName` for error messages, and a `Map<string, AnnotationValue<unknown, OperationKind>>` of recorded annotations.

`annotate(...)` validates eagerly via `assertAnnotationsApplicable([annotation], this.kind, this.terminalName)` so cast-bypass cases (`as any`) throw `RUNTIME.ANNOTATION_INAPPLICABLE` at the configurator call site rather than later in the terminal. The terminal then reads `meta.annotations` (the recorded `Map`) and threads it into the existing plumbing.

### Terminal signatures (read)

```typescript
// Before
all<As extends readonly AnnotationValue<unknown, OperationKind>[]>(
  ...annotations: As & ValidAnnotations<'read', As>
): AsyncIterableResult<Row>;

// After
all(configure?: (meta: MetaBuilder<'read'>) => void): AsyncIterableResult<Row>;
```

```typescript
// Before — six overloads with variadic annotations + a runtime branch on isAnnotationValue
async first(): Promise<Row | null>;
async first(filter: (model: ModelAccessor<…>) => WhereArg): Promise<Row | null>;
async first(filter: ShorthandWhereFilter<…>): Promise<Row | null>;
async first<As extends … >(...annotations: As & ValidAnnotations<'read', As>): Promise<Row | null>;
async first<As extends … >(filter: (model: …) => WhereArg, ...annotations: As & ValidAnnotations<'read', As>): Promise<Row | null>;
async first<As extends … >(filter: ShorthandWhereFilter<…>, ...annotations: As & ValidAnnotations<'read', As>): Promise<Row | null>;

// After — four overloads, no runtime ambiguity (positional dispatch only)
async first(): Promise<Row | null>;
async first(
  filter: undefined,
  configure: (meta: MetaBuilder<'read'>) => void,
): Promise<Row | null>;
async first(
  filter: (model: ModelAccessor<…>) => WhereArg,
  configure?: (meta: MetaBuilder<'read'>) => void,
): Promise<Row | null>;
async first(
  filter: ShorthandWhereFilter<…>,
  configure?: (meta: MetaBuilder<'read'>) => void,
): Promise<Row | null>;
```

`aggregate(fn, configure?)` follows the same pattern: existing builder callback first, optional meta configurator second.

### Terminal signatures (write)

```typescript
// Before
async create<As extends … >(
  data: ResolvedCreateInput<…>,
  ...annotations: As & ValidAnnotations<'write', As>
): Promise<Row>;

// After
async create(
  data: ResolvedCreateInput<…>,
  configure?: (meta: MetaBuilder<'write'>) => void,
): Promise<Row>;
```

Same shape for `createAll`, `createAndCount`, `update`, `updateAll`, `updateAndCount`, `delete`, `deleteAll`, `deleteAndCount`, `upsert`. Each terminal pins the kind to `'write'` when constructing its `MetaBuilder`.

`delete` / `deleteAll` / `deleteAndCount` (which take only `this`-typed receiver guards today) gain a single optional `configure` argument:

```typescript
async delete(
  this: State['hasWhere'] extends true ? Collection<…> : never,
  configure?: (meta: MetaBuilder<'write'>) => void,
): Promise<Row | null>;
```

### `GroupedCollection.aggregate`

```typescript
// Before
async aggregate<Spec, As>(
  fn: (aggregate: AggregateBuilder<…>) => Spec,
  ...annotations: As & ValidAnnotations<'read', As>
): Promise<…>;

// After
async aggregate<Spec extends AggregateSpec>(
  fn: (aggregate: AggregateBuilder<…>) => Spec,
  configure?: (meta: MetaBuilder<'read'>) => void,
): Promise<…>;
```

### Multiple annotations per call

Chainable, since `annotate` returns `this`:

```typescript
await db.orm.User.find({ id }, (meta) =>
  meta
    .annotate(cacheAnnotation({ ttl }))
    .annotate(otelAnnotation({ traceId })),
);
```

Or block form, since the callback's return value is unused:

```typescript
await db.orm.User.find({ id }, (meta) => {
  meta.annotate(cacheAnnotation({ ttl }));
  meta.annotate(otelAnnotation({ traceId }));
});
```

Last-write-wins on duplicate namespaces, matching the existing semantics.

### Reading the annotations inside the terminal

The state-driven path (`all`, `first`) folds the meta builder's recorded map into `state.userAnnotations` at the terminal boundary, replacing the existing `#withAnnotations(annotations, 'read', 'all')` array entry point with a `#withAnnotationsFromMeta(meta)` map entry point. `compileSelect` continues to receive `state.userAnnotations` unchanged.

The post-wrap path (`aggregate`, all writes) calls `mergeUserAnnotations(compiled, meta.annotations)` directly with the meta builder's recorded map — the function already accepts a `ReadonlyMap<string, AnnotationValue<…>>`, so the call-site shape simplifies.

In both paths the runtime applicability check has already fired inside `meta.annotate(...)`. The terminal does not need to call `assertAnnotationsApplicable` again.

## What stays the same

- `defineAnnotation`, `AnnotationValue`, `AnnotationHandle`, `OperationKind`, `assertAnnotationsApplicable` — unchanged.
- SQL DSL `.annotate(...)` — unchanged.
- Annotation storage on `plan.meta.annotations[namespace]` — unchanged.
- `mergeUserAnnotations` and `buildOrmQueryPlan` — unchanged (their input signatures already accept a `ReadonlyMap`).
- Cache middleware behavior, contract semantics, error envelope codes — unchanged.
- Reserved namespaces, plan-identity invariant, transaction-scope guard — unchanged.

## What goes away

- `ValidAnnotations<K, As>` — kept exported for back-compat consumers, but the framework itself no longer relies on it. The variadic-tuple inference workaround (the `As & ValidAnnotations<K, As>` intersection) is no longer load-bearing on any first-party surface; the documentation can stop calling it out as a trap.
- The `first` runtime branch on `isAnnotationValue(filterOrFirstAnnotation)` — gone (the configurator's function-type identity makes the dispatch unambiguous).
- The `#withAnnotations(annotations, kind, terminal)` array entry point and the `#buildAnnotationsMap(annotations, kind, terminal)` array entry point — replaced by `MetaBuilder`-aware variants that consume the recorded map directly.

## Why SQL DSL is out of scope

`SelectQueryImpl.annotate(...)`, `InsertQueryImpl.annotate(...)`, etc. are chainable builder methods on intermediate builders, not terminals. The user-facing concern — that a variadic on a terminal blocks future per-call options — does not apply to a builder method whose host returns a new builder. The natural growth path on the SQL DSL is additional builder methods (`.cache(...)`, `.tag(...)`) that compose with `.annotate(...)` rather than additional positional arguments to `.annotate(...)` itself. Leaving the SQL DSL chainable form alone also keeps the SQL DSL's annotation surface mechanically the same as it is today — only the ORM client's terminal surface changes.

If a follow-up wants to align the SQL DSL with the ORM client's "single annotation per call, chain for more" idiom, that can land separately. It does not block this revision.

## Net effect on the codebase

Mostly localized to the ORM client and a small new module in framework-components.

1. **`packages/1-framework/1-core/framework-components/src/meta-builder.ts` (new).** `MetaBuilder<K>` interface and a `createMetaBuilder(kind, terminalName)` factory. Eager `assertAnnotationsApplicable` inside `annotate`. Exported from `exports/runtime.ts`.

2. **`packages/3-extensions/sql-orm-client/src/collection.ts`.** Each terminal's signature swaps `...annotations: As & ValidAnnotations<K, As>` for `configure?: (meta: MetaBuilder<K>) => void`. The terminal constructs a `MetaBuilder<K>`, invokes the configurator (no-op if absent), and threads `meta.annotations` into the existing plumbing. The `first` overload set collapses from six to two; the runtime branch on `isAnnotationValue` is removed. `#withAnnotations` and `#buildAnnotationsMap` are replaced by `MetaBuilder`-shaped equivalents.

3. **`packages/3-extensions/sql-orm-client/src/grouped-collection.ts`.** Mirror change for `aggregate`.

4. **`packages/3-extensions/sql-orm-client/test/`.** Existing unit and type tests — every site that called `db.User.first({ id }, cacheAnnotation({ ttl }))` becomes `db.User.first({ id }, (meta) => meta.annotate(cacheAnnotation({ ttl })))`. The negative type tests (write-only annotation on read terminal, read-only on write terminal) move from variadic-position negatives to `meta.annotate(...)` argument-position negatives. Cast-bypass runtime tests target `meta.annotate(annotation as any)` and assert the same `RUNTIME.ANNOTATION_INAPPLICABLE` envelope.

5. **`packages/3-extensions/middleware-cache/test/` and `examples/prisma-8-demo/`.** Mechanical: every annotated ORM call site gains a `(meta) => meta.annotate(...)` wrapper.

6. **`docs/architecture docs/subsystems/4. Runtime & Middleware Framework.md` "Lane integration" section.** Update the ORM `Collection` bullet from "variadic argument with the same gated shape" to "optional last argument `configure: (meta: MetaBuilder<K>) => void`". Update the storage paragraph's "Multiple `.annotate()` calls or terminal arguments compose" to "Multiple `meta.annotate(...)` calls compose".

7. **`packages/3-extensions/middleware-cache/README.md`.** Update the quick-start example and the "Opt-in by annotation" examples.

The framework-components annotation module (`annotations.ts`) does **not** change — `defineAnnotation`, `AnnotationValue`, `assertAnnotationsApplicable`, `ValidAnnotations` all stay. The runtime gate keeps working unchanged.

## Acceptance criteria

- [ ] `MetaBuilder<K>` is exported from `@internal/framework-components/runtime`. Type tests cover: `meta.annotate(readApplicable)` typechecks for `K = 'read'`; `meta.annotate(writeOnly)` does not for `K = 'read'`; mirror image for `K = 'write'`; a `'read' | 'write'` annotation works on both. Type test asserts `meta.annotate` returns `this` (for chaining).
- [ ] `MetaBuilder.annotate` validates eagerly via `assertAnnotationsApplicable` and throws `RUNTIME.ANNOTATION_INAPPLICABLE` on cast-bypass (unit test, both kinds).
- [ ] Every ORM read terminal accepts an optional `configure: (meta: MetaBuilder<'read'>) => void` last argument and threads `meta.annotations` into `plan.meta.annotations` (integration test, one per terminal).
- [ ] Every ORM write terminal accepts an optional `configure: (meta: MetaBuilder<'write'>) => void` last argument and threads `meta.annotations` into the compiled mutation plan(s) via `mergeUserAnnotations` (integration test, one per terminal).
- [ ] Multiple `meta.annotate(...)` calls compose; duplicate namespace = last-write-wins (unit test).
- [ ] Negative type tests: passing a write-only annotation through `meta.annotate(...)` on a read terminal's configurator fails to compile; mirror image. The test set covers the same matrix the variadic form covers today.
- [ ] `Collection.annotate` does not exist as a method (regression — chainable form was never added; this acceptance carries forward).
- [ ] The runtime `first` overload set collapses to two signatures and the `isAnnotationValue(filterOrFirstAnnotation)` branch is removed (unit test asserts both overloads dispatch correctly: `first(configure)` and `first(filter, configure)`).
- [ ] `pnpm test:packages` passes; `pnpm typecheck` passes; `pnpm lint:deps` clean.
- [ ] Cache middleware's stop-condition integration test (`test/integration/test/cross-package/middleware-cache.test.ts`) passes against the new call shape with the annotated ORM read.
- [ ] Demo (`examples/prisma-8-demo/`) updated to use the new shape; run remains green.

## Sequencing

Implement after the cache project's M2 merges (the variadic shape ships first, this revision replaces it). Land as a single PR scoped to:
- the new `meta-builder.ts` module,
- the ORM client signature swap,
- the test file rewrites,
- the subsystem doc + middleware-cache README updates.

Architecturally independent of M3 (cache middleware) and the deferred follow-ups (drop `Row` generic; thread annotations into nested-mutation / MTI). Can ship before or after either.

## Open questions

- **Configurator naming.** `meta` matches `plan.meta.annotations` storage and reads naturally at the call site. Alternatives considered: `q` (too short), `query` (overlaps with existing `query`-named identifiers), `options` (suggests a record literal, not a function). Lean: `meta`. Resolve before signature lock-in.
- **Should the configurator be allowed to return a value?** Today the recorded annotations are read off the builder regardless of return value. We could keep the return type `void` for clarity, or `void | undefined | unknown` for tolerance of arrow expressions like `(meta) => meta.annotate(…)` that return the builder. Lean: type the parameter as `(meta: MetaBuilder<K>) => void` and rely on TypeScript's "return value is ignored when the parameter return type is `void`" rule, which makes both block-body and expression-body callbacks compile. Validate with a type test.
- **`ValidAnnotations<K, As>` deprecation.** Keep exported for now (an external annotation library or contributor middleware may depend on it); revisit deprecation when the broader middleware API redesign lands in May. Not a blocker for this revision.
