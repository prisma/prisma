# Plan — decode reshaping-pipeline results

Spec: [`./spec.md`](./spec.md). Four vertical slices. Each adds per-stage `resultShape` reification
for a stage family and proves it end-to-end by reading a **codec'd** field (ObjectId/Date) back
through that stage and asserting the decoded value (an integration test that would fail if the field
came back as raw BSON). All build on the same runtime decode walk (unchanged) and the starting
model shape from `contractModelToMongoResultShape`.

The reifier is a standalone replay: `reifyPipelineResultShape(stages, startShape) → MongoResultShape`,
called once in `build()` — replays the AST stages (`this.#state.stages`) against the model's base
shape, transforming per stage. It replaces the current binary `pipelineSupportsFlatResultShape ?
modelShape : {kind:'unknown'}`. No per-stage builder-method changes; the shape derives from the AST
nodes (`MongoAggFieldRef.path`, `MongoAggAccumulator.op`, etc.), since the type-level `Shape`/`DocField`
info is erased at runtime.

Implementer tier: **sonnet**. Reviewer tier: **opus**.

### Slice 1 — reification scaffold + `$project`/`$addFields` + `$vectorSearch` reclassification

- **Outcome:** the replay reifier exists and handles the two "classify each output field" stages plus
  identity carry-forward. `$project` (key-list and callback forms — a bare `MongoAggFieldRef` copies the
  source field's shape; `1`/kept → source shape; `0` → drop; any computed expr → `unknown`; implicit
  `_id` retention). `$addFields` (carry the input shape, add each new field by the same classification).
  Fold in the one-line fix: `$vectorSearch` is shape-preserving, so it carries the input shape unchanged
  (today it wrongly collapses the plan). Rewrite `examples/retail-store` `findSimilarProducts` to the
  typed builder — decoded `Product[]`, drop the `blindCast`/`db.raw`/stale comment. End-to-end test:
  a `$vectorSearch` read and a `$project` that keeps `_id` both return a decoded `_id` string.
- **Builds on:** nothing (introduces the scaffold). **Hands to:** Slices 2–4 reuse the reifier.
- **Fixes the original TML-2954 case.**

### Slice 2 — `$group`

- **Outcome:** `$group` reifies its output shape. `_id`: bare field-ref → source shape; compound object
  → nested `document`; `null`/computed → `unknown`. Accumulators dispatch by `op`: `$first`/`$last`/`$min`/`$max`
  of a field-ref → source shape; `$sum`/`$avg`/`$count`/`$stdDev*` → numeric (`mongo/double@1`);
  `$push`/`$addToSet` → `array` of the arg's element shape; computed args → `unknown`. End-to-end test:
  a `$group` whose accumulator is `$max` of a Date field returns a decoded Date.
- **Builds on:** Slice 1 scaffold. Independent of Slices 3/4.

### Slice 3 — `$unwind` + value-object / nested-document shapes

- **Outcome:** two coupled pieces. (a) `contractFieldToMongoFieldShape` walks value-object/union fields
  into real `kind:'document'` shapes (reuse the type-level `VONestedShape`/`ContractValueObjectDefinitions`
  pattern at runtime) instead of `unknown` — a shared dependency for richer shapes. (b) `$unwind` replaces
  the unwound array field's shape with its `element` shape at the root; land the matching type-level fix
  (`UnwrapArrayDocField` is identity today) in the same slice to avoid type/value skew. End-to-end test:
  `$unwind` of a value-object array decodes the element's codec'd fields.
- **Builds on:** Slice 1 scaffold; its value-object work is a prerequisite for Slice 4.

### Slice 4 — `$replaceRoot`

- **Outcome:** `$replaceRoot` where `newRoot` is a bare field-ref into a shape the pipeline already
  knows (a value-object field, or a prior `$group`/`$project` output) lifts that sub-shape to the root.
  Anything computed (`$mergeObjects`, object literals) stays `unknown` — documented as the intentional
  boundary. End-to-end test: `$replaceRoot` onto a value-object subdocument decodes its codec'd fields.
- **Builds on:** Slice 3 (needs value-object shapes to lift).

## Scope boundary (all slices)

Computed aggregation expressions (`$concat`, `$add`, `$cond`, `$switch`, `$map`, `$reduce`, `$let`/`$$var`,
`$mergeObjects`, arithmetic) have no attributable codec → the field stays `kind:'unknown'` (pass-through).
This is the correct final answer per ADR 209, not deferred work.
