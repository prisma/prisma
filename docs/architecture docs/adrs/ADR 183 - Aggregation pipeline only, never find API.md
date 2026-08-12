# ADR 183 — Aggregation pipeline only, never `find()` API

## At a glance

MongoDB has two read APIs: `find()` and `aggregate()`. We always use `aggregate()`, never `find()`.

## Context

MongoDB provides two APIs for reading data:

1. **`find(filter, options)`** — the original query API. Supports filter, projection, sort, limit, skip. No joins, no grouping, no computed fields.
2. **`aggregate(pipeline)`** — the aggregation framework. An ordered array of stage documents (`$match`, `$lookup`, `$project`, `$sort`, `$group`, `$addFields`, etc.) where each stage transforms the document stream.

`find()` is a strict subset of `aggregate()`. Every `find()` call has an equivalent pipeline:

| `find()` option | Pipeline equivalent |
|---|---|
| `filter` | `$match` |
| `projection` | `$project` |
| `sort` | `$sort` |
| `skip` | `$skip` |
| `limit` | `$limit` |

The reverse is not true — `$lookup` (joins), `$group`, `$addFields`, `$replaceRoot`, and computed expressions have no `find()` equivalent.

## Problem

The ORM needs `$lookup` for includes, which requires the aggregation pipeline. Supporting both `find()` and `aggregate()` means every query feature (filtering, sorting, projection, pagination) must be implemented twice — once for `find()` options and once as pipeline stages — across the ORM compilation, adapter lowering, and driver execution layers.

## Decision

**Always use `aggregate()`. Never use `find()`.**

This applies to all MongoDB read queries produced by the ORM, the future pipeline query builder, and any other query surface. Write commands (`insertOne`, `updateOne`, `deleteOne`) are unaffected.

The aggregation pipeline is the single query representation for reads. The ORM compiles to pipeline stages. The future pipeline query builder composes the same pipeline stages at a lower level. One representation, one compilation path, one lowering path.

## Alternatives considered

### Keep `find()` as an optimization for simple queries

Produce a `find()` call when the query has no `$lookup` or other pipeline-only stages, since `find()` can be marginally faster for simple filter+sort+limit queries.

**Rejected.** The performance difference is marginal on modern MongoDB — the query planner optimizes both paths. The cost of maintaining two code paths far outweighs the micro-optimization.

## Costs

- Existing code that branches on `find` vs `aggregate` must be updated to use `aggregate` exclusively.

## Benefits

- **Single code path.** Every query feature is implemented once, as pipeline stages.
- **Shared foundation.** The ORM and the future pipeline query builder both produce the same thing — a pipeline. They're two surfaces for building the same representation.
- **No feature ceiling.** Any MongoDB aggregation capability (`$group`, `$facet`, `$graphLookup`, computed expressions) is available without switching APIs.
