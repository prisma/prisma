# Project: decode reshaping-pipeline results

Tracking issue: TML-2954.

## Purpose

A Mongo read must return an object matching the type the query builder computed — every field
run through its codec, exactly as a normal `find` or the ORM already does. Today that holds only
for **shape-preserving** pipelines. The moment a pipeline includes a **reshaping** stage
(`$project`, `$group`, `$addFields`, `$unwind`, `$replaceRoot`), the builder gives up and tags the
plan `resultShape: {kind:'unknown'}`, so the runtime returns raw BSON — codec'd fields
(`_id → ObjectId`, dates, etc.) come back un-decoded while the TypeScript type still claims they're
decoded. The type lies.

This project closes that gap: the builder reifies a correct `resultShape` **through** the pipeline
stages, so a reshaped output decodes field-by-field. This is the deferred follow-up ADR 209 names
(§150, §160: *"per-stage shape rebuild for aggregation pipelines"*, *"no runtime changes needed"*) —
the runtime decode walk already exists; only the lanes fail to produce the shape.

## What "decoded" means here

For each field of the reshaped output document:
- If it traces to a contract field (a bare field reference, or an accumulator over one like
  `$first`/`$last`/`$min`/`$max`), carry that field's codec — the runtime decodes it.
- If it is synthetic with no attributable codec (`$sum`/`$count`/`$avg`, or any computed expression
  like `$concat`/`$cond`/`$let`), it passes through untouched — `kind:'unknown'` at that position is
  the correct, final answer, not a gap (matches ADR 209's "vouch for the shape, not this position").

## Non-goals

- Evaluating arbitrary aggregation expressions to invent a codec. Computed fields stay pass-through.
- Migrating SQL to the structural `resultShape` seam (ADR 209 keeps SQL on `meta.annotations.codecs`).
- Changing the runtime decode walk — it already handles nested documents and arrays.

## Cross-cutting requirements

- **Value-object / nested-document shapes.** `contractFieldToMongoFieldShape` currently maps
  value-object and union fields to `kind:'unknown'`. Several stages (`$replaceRoot`, nested
  `$project`/`$group`) can only produce a richer-than-`unknown` shape once value-object fields carry
  a real `kind:'document'` shape. Closing that pre-existing gap is a shared dependency, done once.
- **Type/value parity.** Where a stage's runtime shape now decodes a field, the type-level `Shape`
  must agree (e.g. `$unwind`'s `UnwrapArrayDocField` is identity today — the array-element extraction
  must land at the type level in the same slice, not create a type-vs-value skew).
- **No silent regressions.** Shape-preserving reads and the ORM must decode exactly as before;
  `fixtures:check`, the mongo package suite, and the integration suite stay green.

## Definition of done

- Every reshaping stage produces a `resultShape` whose codec'd, source-traceable fields decode, and
  whose synthetic/computed fields pass through — verified by integration tests that read codec'd
  fields (ObjectId, Date) back through each reshaping stage and assert the decoded value.
- `$vectorSearch` (shape-preserving) decodes like any read; `examples/retail-store` `findSimilarProducts`
  uses the typed builder and returns decoded `Product[]` with no `blindCast`.
- The type the builder assigns to a reshaped result matches the runtime object it yields (no skew).
- ADR 209's layer-responsibilities table is updated to reflect that reshaping stages now reify shapes.
