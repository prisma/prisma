# Aggregate descriptor guide

A codec says how one value converts. An aggregate is a *new* value the database computes from many, and what it returns is a property of the operation, the target, and sometimes the input — `sum` over PostgreSQL's `int4` is an `int8`, over its `int8` a `numeric`, and over SQLite's integers an integer that only the bigint codec carries. None of that is derivable from the input codec, so it is declared separately, as `SqlAggregateDescriptor` contributions on `types.aggregateDescriptors`, a sibling of `codecTypes`.

This guide covers that descriptor surface: what a descriptor claims, what it declares, and what a consumer reads off a resolution. Codec authoring itself — codec classes, descriptors, and column helpers — is the [codec authoring guide](./codec-authoring-guide.md).

```ts
import type { SqlAggregateDescriptor } from '@internal/sql-relational-core/aggregate-descriptor-registry';

const sumOfSmallIntegers: SqlAggregateDescriptor = {
  operation: 'sum',
  input: { kind: 'trait', trait: 'numeric' },
  output: { kind: 'codec', codecId: 'pg/int8@1' },
  nullable: true,
};
```

## The four input matches

A descriptor claims one `(operation, input)` pair, and exactly one component may claim it across a composed stack. The input match is one of four kinds:

| Kind | Claims | Example |
| --- | --- | --- |
| `none` | a call with no input at all | a count over rows |
| `codec` | one exact codec id | `sum` over `pg/int8@1`, which goes to `numeric` where the other integers go to `int8` |
| `trait` | every codec advertising the trait | `min` over anything `textual` |
| `any` | any input, and no input — a result that does not depend on what it aggregates | `count`, which is an integer whether it counts rows or values |

Resolution consults them in that order of specificity: an exact codec match, then a trait match, then the input-agnostic entry. That is what lets a target state a general rule and one exception — PostgreSQL's `min`/`max` preserve every `textual` codec's own type *except* `varchar`, whose extremum the database returns as `text`, so `varchar` claims itself exactly and shadows the trait.

Two codecs may not both claim one input by trait: a codec carrying two claimed traits leaves the result undetermined, and composition fails with `RUNTIME.AMBIGUOUS_AGGREGATE_DESCRIPTOR` rather than picking one. Contribute an exact descriptor for the contested codec, or narrow the traits.

## Declaring the result

`output` is either `self` — the matched input's codec, for an aggregate that returns one of the values it read, like `min` — or a named codec id. A named output may resolve its own type parameters from the input reference, but it cannot change which codec id the result carries. An aggregate that produces a *new* value names its codec without the input's type parameters: a `numeric(10,3)` column sums to an unconstrained `numeric`, and carrying the column's precision into the result would understate its range.

`nullable` is declared, never inferred from the input: SQL answers an empty input set with `NULL` for `sum`, `avg`, `min`, and `max`, and with zero for `count`.

## The relationship to canonical JSON

An aggregate's result enters a JSON envelope wherever it is an include reducer, and it goes in under the codec resolved here — which is why [the canonical JSON guarantee](./codec-authoring-guide.md#the-canonical-json-guarantee) applies to aggregates too. A count past 2^53 read as a JSON number is the same defect as a `numeric` read as one.

## Lowering, where the wire form needs it

A descriptor may carry a `lower` hook, which builds the expression the target wants:

```ts
const castResultToText =
  (operation: AggregateFn): SqlAggregateLowering =>
  ({ expr }) =>
    CastExpr.as(new AggregateExpr(operation, expr), 'text');
```

The hook returns an expression and nothing else — it has no channel for a codec, so the descriptor's declared `output` remains the only source of result identity, whatever the hook builds. SQLite uses it for every aggregate whose result is `sqlite/bigint@1`: the database computes those into an INTEGER, and `node:sqlite` raises rather than returning one a JS number cannot hold, so the cast to text is what keeps the value readable — and text is the form the bigint codec reads anyway. PostgreSQL needs no lowering: its native result types already are the declared codecs' native types.

## What a consumer stamps

A planner that builds an aggregate reads two different things off the resolution and must not confuse them:

- **`codec`** is the decode identity — the `CodecRef` that says how the result is read back. It is stamped only when the registry resolved an overload. A miss stamps nothing, and the value reads back as the driver handed it over. Naming the input's codec there would claim the result decodes like its input, which SQLite makes false: it computes `sum` over a text column from whatever leading numbers the rows held.
- **`codecId`** is the expression's shape, which operator gating reads. On a miss it keeps the input's, because the lane still has to say something about what the expression is.

## Where to look

- **PostgreSQL's matrix**: [packages/3-targets/3-targets/postgres/src/core/aggregates.ts](../../packages/3-targets/3-targets/postgres/src/core/aggregates.ts) — every row read off a live database rather than inferred.
- **SQLite's matrix, including the lowering**: [packages/3-targets/3-targets/sqlite/src/core/aggregates.ts](../../packages/3-targets/3-targets/sqlite/src/core/aggregates.ts).
- **The vocabulary**: `AggregateDescriptor` in `packages/1-framework/1-core/framework-components/src/shared/aggregate-descriptor.ts`; the precedence rule beside it in `aggregate-overloads.ts`; the SQL specialization and registry in `packages/2-sql/4-lanes/relational-core/src/aggregate-descriptor{,-registry}.ts`.
