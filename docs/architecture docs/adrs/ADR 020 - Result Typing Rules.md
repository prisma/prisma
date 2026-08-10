# ADR 020 — Result Typing and Projection Inference Rules

## Context

- Users and agents rely on predictable TypeScript result types from the SQL DSL and the optional ORM layer
- Inference must be stable across lanes, dialects, and adapter updates to keep DX, CI snapshots, and agent prompts trustworthy
- Ambiguity usually stems from joins, aggregates, and adapter-specific lowerings for nested results

## Decision

- All result types are `AsyncIterable<T>` where `T` is inferred from the query projection (per ADR 037)
- Standardize how the SQL DSL and ORM compute element type `T` from projections and joins
- Define nullability propagation rules for LEFT JOIN, RIGHT JOIN, FULL OUTER JOIN, and common aggregates
- Push dialect-specific edge cases behind adapter capabilities so the type rules remain stable while allowing adapters to refine details

## Scope

### In scope

- SELECT results for SQL DSL and ORM-lowered single-statement queries
- Projections, joins, simple expressions, and common aggregates
- Nested results produced by core traversal nodes (`nestArray`, `joinFlat`) lowered by adapters using single-statement strategies

### Out of scope

- Multi-statement orchestration and unit-of-work semantics
- Driver-specific runtime result decoding beyond codecs already configured

## Sources of type information

**Order of precedence:**
1. Projection alias types when explicitly annotated in the builder API or via codecs
2. Column types from the data contract for fields accessed via the `(f, fns) => ...` callback proxy
3. Expression typing rules defined below
4. Adapter refinements where the adapter declares more precise behaviors via capabilities

If multiple sources disagree, the more specific one wins and the less specific is widened.

## Projection rules

- `db.user.select('alias', (f) => f.id)` yields `{ alias: number }` based on contract column type
- `db.user.select('alias', (_f, fns) => fns.count())` yields the count's declared result type — `{ alias: bigint }` on both built-in targets
- `db.order.select('alias', (f, fns) => fns.sum(f.amount))` yields the aggregate result type per the aggregate rules below
- Duplicate aliases are a compile-time error in strict mode and produce a warning in permissive mode
- `SELECT *` is allowed by the core but strongly discouraged and typically linted as error
  - When used, the result is the intersection of all visible table fields with join-based nullability applied, breaking ties by last-projected table in deterministic order

### Nested projection metadata

- `meta.projection` may include nested descriptors to reflect structured outputs from `nestArray` and dotted paths for `joinFlat` aliases
- `meta.refs` remains a flat list of referenced tables/columns and includes nested/junction references for guardrails

## Join nullability rules

Given `FROM A` and a selected field sourced from table `T`:

- **INNER JOIN T**: leaves nullability unchanged
  - `A.col` as in contract, `T.col` as in contract
- **LEFT JOIN T**: makes all `T.*` nullable
  - `T.col` becomes `Nullable<ColType>` regardless of original nullability
  - `A.*` unchanged
- **RIGHT JOIN T**: makes all `A.*` nullable and leaves `T.*` unchanged
  - Not all adapters implement RIGHT JOIN; if adapter lowers to LEFT JOIN by swapping sides, the same rule applies relative to the rewritten sides
- **FULL OUTER JOIN**: makes both `A.*` and `T.*` nullable
- **Self-joins**: follow the same rules per logical side, disambiguated by table alias
- **CROSS JOIN**: leaves nullability unchanged for both sides

### Notes

- Nullability from JOIN combines with column-level nullability via union:
  - A nullable column on the preserved side remains nullable
  - A non-nullable column on the non-preserved side becomes nullable
- Adapter profiles can refine nullability only when they provably enforce filtering that restores inner semantics
  - Such refinements must be covered by golden tests

## Expression typing rules

- **Boolean predicates** like `eq`, `gt`, `lt`, `in` type to `boolean` for projection purposes
  - Three-valued SQL logic is not encoded in result types; in WHERE, unknown behaves as false
- **CASE WHEN** unions branch types and propagates nullability if any branch can be null
  - `CASE WHEN cond THEN number ELSE NULL END` yields `number | null`
- **COALESCE(a, b, ...)** yields the first non-nullable type in order or the union of all types if none is non-nullable
- **Arithmetic on numerics** promotes to the widest participating numeric type declared by the contract
  - Mixing `int4` and `float8` yields `number`
- **String concatenation** yields `string`
- **JSON construction functions** yield `unknown` by default and `T` when paired with an explicit codec or typed builder helper

## Aggregate typing rules

An aggregate's result type is declared by the target and resolved through the contract's emitted `aggregateTypes` map, per operation and per input codec. The rules below are what the built-in targets declare, not a scheme the typing layer imposes; a target that widens differently states so in its own descriptors. Nullability is declared alongside, and matches SQL: an empty input set is `NULL` for everything but `COUNT`.

Assume no FILTER and no DISTINCT unless specified:

- **COUNT(\*)** and **COUNT(expr)** yield `bigint` and are non-null — a count is a cardinality, and both targets count into a 64-bit integer
- **SUM(int\*)** yields `bigint | null` on PostgreSQL's `int2` / `int4` (the sum widens to `int8`) and on SQLite's integers; PostgreSQL's `sum(int8)` is `numeric`, which reads as a decimal `string | null`
  - null when the group contains zero rows or all expr are null
- **SUM(float\*)** yields `number | null` with the same nullability
- **AVG(\*)** diverges by target: PostgreSQL computes an integer average as `numeric` — a decimal `string | null` — and a float average as `number | null`; SQLite's average is always real, so `number | null`
- **MIN(expr)** and **MAX(expr)** yield `T | null` where `T` is the expression's own type, except where the database widens it: PostgreSQL's extremum over `varchar` returns `text`
- **ARRAY_AGG(T)** yields `T[] | null` by default
  - Adapters may flip to `T[]` if they guarantee `COALESCE(array_agg(...), '{}')` and must advertise `arrayAggCoalescesEmpty` capability
- **JSON_AGG(T)** yields `unknown[] | null` by default
  - With a typed child projection and `jsonAggTypedChildren` capability, adapters may refine to `ChildRow[] | null`
  - Adapters may coalesce to `ChildRow[]` if they lower with `COALESCE(json_agg(...), '[]'::json)` and declare `jsonAggCoalescesEmpty`
- **includeMany**: The SQL DSL's `includeMany` feature uses `json_agg` to return nested arrays. The runtime converts `NULL` json_agg results to empty arrays `[]` for consistency, ensuring the result type is always `Array<ChildShape>` rather than `Array<ChildShape> | null`. Include aliases are marked in plan meta with `include:alias` to enable special JSON array decoding. The builder tracks includes at the type level, maintaining a map of include aliases to their child projection types, allowing `InferNestedProjectionRow` to infer `Array<ChildShape>` instead of `Array<unknown>`.

### Contributed aggregate operations

An operation's name is whatever its descriptor declares. Targets, adapters, and extensions contribute descriptors on `types.aggregateDescriptors`, and every consumer surface derives its method set from that vocabulary: the SQL DSL's aggregate functions, the ORM's `aggregate()`, `groupBy().aggregate()`, and the include reducers on a collection. The type level reads the same vocabulary from the contract's emitted `aggregateTypes`; the runtime reads it from the registry the execution context assembles. Neither the lane nor the client names an operation.

```ts
import type { SqlAggregateDescriptor } from '@internal/sql-relational-core/aggregate-descriptor-registry';
import { FunctionCallExpr } from '@internal/sql-relational-core/ast';

const bitOr: SqlAggregateDescriptor = {
  operation: 'bitOr',
  input: { kind: 'codec', codecId: 'pg/int8@1' },
  output: { kind: 'codec', codecId: 'pg/int8@1' },
  nullable: true,
  lower: ({ expr }) => FunctionCallExpr.of('bit_or', expr === undefined ? [] : [expr]),
};
```

```ts
// On an ORM collection, the contributed operation is a method like any other,
// typed by the row the descriptor settled into
await readings.aggregate((aggregate) => ({ bits: aggregate.bitOr('weight') }));
// { bits: bigint | null }
```

**The operation namespace is open; the SQL alphabet is closed.** `AggregateFn` — `count | sum | avg | min | max`, in `packages/2-sql/4-lanes/relational-core/src/ast/types.ts` — is the set of function names an `AggregateExpr` can carry, and so the set renderers are exhaustive over. It is SQL's alphabet, not the operation namespace.

**An operation outside the alphabet carries its own lowering.** A name in the alphabet lowers to `AggregateExpr(name, expr)` by default. Any other name must declare a `lower` hook that builds its expression from existing nodes — a function call, a cast, an aggregate call wrapped in either. Registry assembly rejects a descriptor that has neither a name in the alphabet nor a hook, with `RUNTIME.AGGREGATE_LOWERING_MISSING`, so the failure lands at composition rather than mid-query.

**An operation outside the alphabet is projection-only.** Its lowered form is a rendering for the driver boundary, where the value leaves SQL; HAVING, ORDER BY, and comparison operands compare inside the database, where only the plain `AggregateExpr` form is sound. Both consumers refuse those positions at authoring time with `ORM.AGGREGATE_PROJECTION_ONLY`, and both typed surfaces say the same: the ORM's `HavingBuilder` is keyed by `AggregateOperationNames<TContract> & SqlAggregateFn`, deliberately narrower than `AggregateBuilder`'s key set, so an out-of-alphabet operation has no HAVING method at all and the runtime refusal covers dynamic invocation.

**Call shape follows row presence.** A `withoutInput` row admits the zero-argument call; `byCodec` and `anyInput` rows admit the field-taking call, over exactly the fields `AggregateFieldNames` reads off them; an operation with both kinds of row carries both overloads. `count()` and `count(field)` are that data fact rather than a special case — PostgreSQL declares `count` with `input: { kind: 'any' }`, which settles into both a `withoutInput` and an `anyInput` row.

**A contributed name may not shadow a base collection member.** Include reducers install into the collection's own namespace, beside `select`, `where`, `include`, and the rest, so an operation whose name a `CollectionImpl` member already owns is rejected at ORM composition (`orm(...)`) with `ORM.AGGREGATE_OPERATION_RESERVED`. The reserved set is derived for one half and pinned for the other: the prototype members come from `Object.getOwnPropertyNames(CollectionImpl.prototype)`, while the instance fields are a hand-written list that a test holds to the class — it walks a live collection's own property names and fails if the set is missing one, so adding a field without listing it is caught.

**A custom collection's own members take precedence over a reducer.** That check reads `CollectionImpl` and nothing else, so a collection class registered through `orm({ collections })` may declare a member whose name an operation also carries. The constructor skips any name the instance already carries, which leaves the class member in place and installs no reducer for the operation. Types are what guard the case: `Collection` is `CollectionImpl & AggregateIncludeReducers<…>`, so for any contract whose emitted map carries the operation, a subclass member that does not match the reducer's signature is a type error — what passes silently is a member the types never promised. Extending the composition-time check to subclasses would not close that: a subclass instance field is invisible to a static scan of the class, and is assigned after `super()` has already installed the reducer.

### Grouping

- With GROUP BY, any projected non-aggregate field must appear in the grouping set or compilation fails
- Result nullability from aggregates ignores join preservation because aggregates collapse the group
- Join-induced nullability only matters for inputs to aggregates, not the aggregate's own nullability except as defined above

## Relationship traversal typing rules

For core traversal nodes lowered by adapters:

- **nestArray (1:N and M:N)**
  - Yields `{ alias: ChildRow[] | null }` by default
  - If the adapter declares `jsonAggCoalescesEmpty` (or equivalent), and the node sets `coalesceEmpty`, yields `{ alias: ChildRow[] }`
  - Child `where`, `orderBy`, and `limit` do not affect parent row nullability

- **joinFlat (N:1)**
  - With `required: false` (LEFT JOIN semantics), projected child fields are `T | null`
  - With `required: true` (INNER JOIN semantics), projected child fields are `T`

## Aliasing and collisions

- Projection alias names must be unique within a query
- When selecting the same column under multiple aliases, each alias gets its own type copy
- Table aliasing does not affect the result field name unless explicitly used as the projection alias

## Adapter refinements

Adapters can narrow types only when they guarantee a specific lowering behavior:
- Coalesced aggregates may drop `| null`
- Known scalar function result widths may be refined to narrower branded types via codecs
- Explicit capabilities must be documented and covered by golden tests

## Examples

### Left join nullability

```typescript
// user INNER JOIN post
db.user
  .innerJoin(db.post, (f, fns) => fns.eq(f.user.id, f.post.user_id))
  .select((f) => ({ uid: f.user.id, pid: f.post.id }))
// { uid: number, pid: number }

// user LEFT JOIN post
db.user
  .outerLeftJoin(db.post, (f, fns) => fns.eq(f.user.id, f.post.user_id))
  .select((f) => ({ uid: f.user.id, pid: f.post.id }))
// { uid: number, pid: number | null }
```

### Aggregates

An aggregate's result type is the target's to declare, resolved from the contract's emitted `aggregateTypes` map per operation and input codec — not the input column's type restated. Nullability comes from the same declaration.

The same map decides availability. A pair with no row — no `byCodec` entry for the input's codec, no `anyInput` fallback, and for a no-input call no `withoutInput` row — is unavailable: the ORM and SQL DSL reject the call at the type level, and both runtimes refuse a dynamic invocation with a structured `ORM.AGGREGATE_UNSUPPORTED` error before building SQL. There is no untyped fallback; a result the target never declared is a result nothing can decode.

A target may also declare a transport lowering for an aggregate — SQLite renders bigint-valued aggregates as text so its driver can carry them. The lowering changes how the value leaves SQL, never what the aggregate means inside it: projection sites apply it, while HAVING, ORDER BY, GROUP BY, and operands of larger expressions keep the plain aggregate expression, where the rendered form would change comparison and ordering semantics.

```typescript
// Count is never null, and reads through its target's count codec
db.order.select('c', (_f, fns) => fns.count())
// { c: bigint }

// Sum may be null when no rows, and widens per the target's rule:
// over PostgreSQL's int4 the sum is an int8
db.order.select('s', (f, fns) => fns.sum(f.amount))
// { s: bigint | null }

// The targets diverge where the databases do: an integer average is
// numeric on PostgreSQL — a decimal string — and real on SQLite
db.order.select('a', (f, fns) => fns.avg(f.amount))
// PostgreSQL: { a: string | null }   SQLite: { a: number | null }
```

See [the aggregate descriptor guide](../../reference/aggregate-descriptor-guide.md) for how a target declares these.

### ORM 1:N nested via json_agg

```typescript
// With adapter not coalescing
// { id: number, posts: Array<{ id: number, title: string }> | null }

// With adapter coalescing
// { id: number, posts: Array<{ id: number, title: string }> }
```

### SQL DSL includeMany

```typescript
// SQL DSL includeMany always returns Array (runtime converts NULL to [])
// Type inference tracks includes at the type level to infer ChildShape
// { id: number, posts: Array<{ id: number, title: string }> }
```

## Testing

- Golden typing tests mapping representative projections and joins to expected TS types
- Adapter conformance tests asserting capability-driven refinements do not widen types unexpectedly
- A contributed operation exercised end to end — a descriptor with a lowering hook, a real query, a result decoded through the declared output codec — and, against a stack the contribution is absent from, no such method at all
- Cross-lane equivalence tests ensuring ORM-lowered plans produce the same result types as hand-written DSL with equivalent SQL
- Regression tests for LEFT/RIGHT/FULL join nullability and aggregate nullability

## Backwards compatibility and evolution

- These rules define typing v1 for result inference
- Adapters may add refinements behind explicit capabilities without breaking v1
- Any change that widens a type must be considered breaking at the typing level and coordinated with a major adapter version bump or a new typing profile

## Rationale

- Users and agents need a small set of stable rules to predict shapes without reading adapter internals
- Join and aggregate nullability are the primary sources of confusion; codifying them reduces surprises
- Keeping refinements behind capabilities preserves a thin core while allowing high-fidelity adapters to improve precision

## Open questions

- Whether to surface a user-level option to always coalesce collection aggregates for ergonomics, trading some SQL strictness for simpler types
- Strategy for typing window functions beyond `row_number()` and `rank()` defaults
- Whether any aggregate warrants a branded result type beyond the codec its target declares
