# Spec: Mongo enum fields type through a storage value set (TML-2953, Level A)

**Linear:** [TML-2953](https://linear.app/prisma-company/issue/TML-2953) · sibling of shipped
[TML-2952](https://linear.app/prisma-company/issue/TML-2952) · follow-up
[TML-2961](https://linear.app/prisma-company/issue/TML-2961) · design:
[`mongo-value-set-design.md`](mongo-value-set-design.md) · model: [`spec.md`](spec.md).

## Summary

Bring Mongo's enum typing onto the same mechanism SQL uses: **a field carrying a value set
gets its type from that value set — the union of the codec-rendered literals of its values —
not the plain codec type.** Add the value-set entity to Mongo storage (same shape as SQL),
source the emit typing and the `$jsonSchema` validator from it instead of `domain.enum`, and
delete the interim `domain.enum` resolver. The domain `enum` becomes runtime-only for Mongo
too (it still powers `db.enums`). Uniformity + value-set-driven typing, **not** a
`storageHash` correctness fix (the validator is already materialized in storage, so
`storageHash` already covers enum values). **Not byte-identical** — Mongo enum contracts and
their migration snapshots regenerate to carry the value set. The Mongo query builder and the
no-emit (`typeof contract`) path are **unchanged**.

## Requirements

- **R1 — Value set in Mongo storage.** Mongo storage carries a value-set entity of the same
  shape as SQL's (`{ kind: 'valueSet', values: readonly JsonValue[] }`, codec-encoded, no
  `codecId`), at `storage.namespaces[<ns>].entries.valueSet[<Name>]`. It round-trips through
  the Mongo serializer/hydration and passes validation.
- **R2 — Authoring populates it.** For each authored enum, the Mongo PSL interpreter and the
  Mongo TS builder emit the storage value set (values = the enum's codec-encoded member
  values) alongside the domain enum, mirroring SQL's `build-contract`. The field keeps its
  existing **domain** `valueSet` ref.
- **R3 — Emit typing from the value set.** `mongoEmission.resolveFieldValueSet` sources the
  permitted values from the storage value set (by the field ref's `entityName`) and the
  `codecId` from the field. `FieldOutputTypes`/`FieldInputTypes` for an enum field then
  narrow to the value union via the shared `renderValueSetType` → `renderValueLiteralFor`
  path. No Mongo-specific enum-typing code remains; the interim `domain.enum` resolver and
  its `INTERIM` comment are deleted.
- **R4 — Validator from the value set.** `derive-json-schema` sources the collection
  validator's `enum` keyword from the storage value set's `values`, not from
  `domain.enum` members. The rendered validator is byte-identical (the value set's values
  equal the encoded member values).
- **R5 — Typed field, both paths.** A Mongo enum document field types as the value union on
  the **emitted** `contract.d.ts` path **and** the no-emit `typeof contract` path, identical
  in shape to SQL. (The no-emit path is unchanged — it is handed the authored values.)
- **R6 — Domain enum is not a Mongo typing/enforcement input.** No Mongo code reads
  `domain.enum` to produce a type or the validator's `enum`. The only remaining `domain.enum`
  reader is `db.enums` (runtime dictionary) — the intended keep.
- **R7 — Migration/verify unchanged.** The validator is byte-identical, so no new physical
  migration op is produced for existing enums; `db verify` passes against the live validator.
  The Mongo schema diff/planner treats the value-set entity as **non-physical** (emits no
  migration op for the value set alone).

## Changes by surface

1. **Mongo storage IR** — `packages/2-mongo-family/1-foundation/mongo-contract`: add the
   value-set entity (a `MongoValueSet` IR node or a lifted shared node) and a `valueSet` slot
   on the namespace `entries`; wire the serializer hydration walker and the arktype
   contract-schema (`contract-schema.ts`) to construct/validate it; namespace assembly
   (`ir/build-mongo-namespace.ts`) threads per-namespace value sets into `entries.valueSet`.
2. **Mongo authoring** — populate the value set:
   - `2-authoring/contract-psl/src/interpreter.ts` — build + place the storage value set for
     each PSL enum (it already stamps the domain ref).
   - `2-authoring/contract-ts/src/contract-builder.ts` — build + place the storage value set
     from each enum handle (it already stamps the domain ref from `__enumHandle`).
3. **Mongo emit typing** — `3-tooling/emitter/src/index.ts`: rework
   `resolveFieldValueSet` to source `encodedValues` from the storage value set (by name) and
   `codecId` from the field; delete the interim `domain.enum` read and the `INTERIM` comment.
4. **Validator deriver** — `2-authoring/contract-psl/src/derive-json-schema.ts`: source the
   `enum` keyword from the storage value set instead of `domain.enum`.
5. **Fixtures / examples** — regenerate `examples/mongo-demo` and `examples/retail-store`
   contracts (`contract.json`/`contract.d.ts`) and any Mongo migration `*-contract` snapshots
   to carry the value set. Record the 0.14→0.15 upgrade declaration(s) for the touched
   `examples/` (incidental) and `packages/3-extensions/` (if touched) per
   `record-upgrade-instructions`.

## Acceptance criteria

- **A1 — Storage shape.** Mongo storage carries a value-set entity of the same shape as SQL,
  at `entries.valueSet`; it round-trips and validates. (R1)
- **A2 — Validator sourced from the value set.** The `$jsonSchema` `enum` is generated from
  the value set; the rendered validator is byte-identical to before. (R4)
- **A3 — Typed field, both paths, SQL-shaped.** A Mongo enum field types as the value union
  on the emitted path **and** `typeof contract`, matching SQL's shape. Proven by type tests
  on both. (R5)
- **A4 — Domain enum not a typing/enforcement input.** The interim resolver and the
  `derive-json-schema` `domain.enum` read are gone; grep confirms no Mongo type/validator
  path reads `domain.enum`; `db.enums` still does (runtime). (R3, R6)
- **A5 — Non-identity codec correctness (emit).** A test value set over a non-identity codec
  types (on the emit path) as the codec **output** literals, not the raw encoded values —
  reusing the shared mechanism. (Confirms the value-set+codec path, not coincidence.)
- **A6 — Migration/verify unchanged.** No new physical migration op for the existing Mongo
  enums; `db verify` passes; the planner emits nothing for the value-set entity alone. (R7)
- **A7 — Interim comment deleted.** The `INTERIM (TML-2953)` comment in the Mongo emitter is
  removed. (Ticket acceptance.)
- **A8 — Gates.** No new bare casts; `build`, `typecheck`, `lint:deps`, `lint:casts`,
  `fixtures:check` (expected to show the intended Mongo contract regeneration, nothing else),
  and the full test suites pass.

## Non-goals

- The explicit per-field storage value-set ref, a storage-only Mongo query builder, and the
  explicit per-collection document projection — all [TML-2961](https://linear.app/prisma-company/issue/TML-2961).
- Reworking the no-emit (`typeof contract`) path — it is handed the authored values and is
  already correct (kept handle-based, matching SQL).
- Native Postgres enums — Postgres-only, do not touch Mongo; pursued separately.
- Any change to `db.enums` runtime behavior or the authoring surface (`enumType` / PSL enum).

## Open questions

- **Planner treatment of the value-set entity (R7/A6).** Confirm at implementation that the
  Mongo schema diff/planner emits no migration op for the value-set entity itself (the
  validator is the physical artifact). If it does emit a spurious op, that is an in-scope fix
  (teach the diff that the value set is non-physical). This is the one place the slice could
  grow teeth.
