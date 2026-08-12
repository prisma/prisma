# Plan: Mongo enum fields type through a storage value set (TML-2953, Level A)

**Spec:** [`mongo-value-set-spec.md`](mongo-value-set-spec.md) · **Design:**
[`mongo-value-set-design.md`](mongo-value-set-design.md) · **Linear:**
[TML-2953](https://linear.app/prisma-company/issue/TML-2953) · **Follow-up:**
[TML-2961](https://linear.app/prisma-company/issue/TML-2961).

Branches off `main` (TML-2952 / PR #896 is merged, so `renderValueLiteral` /
`renderValueSetType` / `resolveFieldValueSet` are available). Test-first throughout.

## Slice DoD

Spec acceptance A1–A8: Mongo storage carries a value set (SQL shape); the validator's `enum`
and the emit typing are sourced from it; enum fields type as the value union on emit **and**
`typeof contract`, SQL-shaped; no Mongo code reads `domain.enum` for typing/enforcement (only
`db.enums` does, at runtime); `db verify` / migration behavior unchanged; the interim comment
is gone; no new casts; full gate set green.

## Dispatches (sequential)

### D1 — Mongo storage value-set IR (substrate, dark)
- **Outcome:** Mongo storage can carry a value-set entity of the same shape as SQL
  (`{ kind: 'valueSet', values: readonly JsonValue[] }`) at
  `storage.namespaces[<ns>].entries.valueSet[<Name>]`. It round-trips through the Mongo
  serializer/hydration and validates. Nothing reads it yet.
- **Builds on:** nothing.
- **Hands to:** D2 (authoring populates it).
- **Focus:** the value-set IR node in `mongo-contract` (a `MongoValueSet` or a lifted shared
  node), the `valueSet` slot on the namespace `entries`, the serializer hydration walker
  entry, the arktype `contract-schema.ts` entry, and `ir/build-mongo-namespace.ts` threading.
  Round-trip + validation tests.

### D2 — Authoring populates the value set; contracts/migrations reconcile
- **Outcome:** Authoring a Mongo enum emits the storage value set (values = codec-encoded
  member values) into `entries.valueSet`, alongside the domain enum; the field keeps its
  domain `valueSet` ref. The Mongo example contracts (`mongo-demo`, `retail-store`) and any
  Mongo migration `*-contract` snapshots regenerate to carry it, and **the planner emits no
  migration op for the value-set entity** (it is non-physical — the validator is the physical
  artifact, unchanged). `fixtures:check` is green (showing only the intended value-set
  regeneration). Typing/validator still read `domain.enum` at this point (re-sourced in D3).
- **Builds on:** D1.
- **Hands to:** D3 (typing + validator can now source from the value set).
- **Focus:** `contract-psl/src/interpreter.ts` and `contract-ts/src/contract-builder.ts` build
  + place the value set, mirroring SQL's `build-contract` (`storageValueSetsByNs`,
  `values: handle.values.map(encodeViaCodec)`); regenerate the example contracts +
  migration snapshots; **verify the Mongo schema diff/planner treats the value set as
  non-physical** (the open question in the spec — if it emits a spurious op, teach the diff
  the value set is non-physical, in scope). Tests: emit a Mongo enum contract → storage
  carries the value set with the right encoded values.

### D3 — Switchover: source typing + validator from the value set; delete the interim
- **Outcome:** `mongoEmission.resolveFieldValueSet` sources `encodedValues` from the storage
  value set (by the field ref's `entityName`) and `codecId` from the field; the
  `derive-json-schema` validator's `enum` is sourced from the value set. The interim
  `domain.enum` resolver and its `INTERIM (TML-2953)` comment are **deleted**. The emitted
  validator and `FieldOutputTypes` are **byte-identical** (same values, different source),
  so no contract change. No Mongo code reads `domain.enum` for typing/enforcement.
- **Builds on:** D1 + D2.
- **Hands to:** D4 (acceptance).
- **Focus:** `3-tooling/emitter/src/index.ts` (`resolveFieldValueSet`) and
  `contract-psl/src/derive-json-schema.ts`. Tests: validator byte-identical; `FieldOutputTypes`
  enum field narrows via the value set; grep confirms no `domain.enum` typing/validator read
  remains (only `db.enums`).

### D4 — Acceptance proof + full gate set
- **Outcome:** The slice DoD is demonstrably met. Type tests prove a Mongo enum field types as
  the value union on the emitted **and** `typeof contract` paths, SQL-shaped (A3); a
  non-identity test codec proves the emit path types the codec **output**, not the encoded
  value (A5); a grep guard asserts no Mongo type/validator path reads `domain.enum` (A4); the
  interim comment is gone (A7); `db verify` / migration behavior unchanged (A6). Upgrade
  instructions recorded for the touched `examples/` (incidental) and any
  `packages/3-extensions/`. Full gate set green (A8): build, typecheck, `lint:deps`,
  `lint:casts`, `fixtures:check`, `check:upgrade-coverage`, all three test suites.
- **Builds on:** D2 + D3.
- **Hands to:** PR-open.
- **Focus:** the cross-cutting type tests + grep guard; `record-upgrade-instructions`; the
  full CI-equivalent gate run.

## Sequencing notes

- **D2 is where the contract shape changes** (not byte-identical) and where the migration/
  planner behavior is exercised — the spec's one risk item lives here. D3 is byte-identical
  (re-sources the same values).
- The **no-emit path is not touched** in any dispatch — it is handed the authored values and
  is already the value union (§ design). D3 is emit-side + validator only.
- The **explicit per-field storage ref / storage-only query builder** is out of scope
  (TML-2961); the field→value-set link stays by-name in the emitter.
