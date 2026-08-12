# Mongo value-set typing — design (TML-2953, Level A)

> Exhaustive design for bringing Mongo's enum typing onto the storage value set, the
> sibling of the shipped SQL work ([TML-2952](https://linear.app/prisma-company/issue/TML-2952)).
> Companion to the shared model spec [`spec.md`](spec.md) and the slice spec
> [`mongo-value-set-spec.md`](mongo-value-set-spec.md). The deferred architectural upgrade
> (explicit document projection / storage-only query builder) is
> [TML-2961](https://linear.app/prisma-company/issue/TML-2961).

## The goal (the universal principle)

**If a value set is present for a field/column, that determines the field's type: the union
of literal types, each literal produced by applying the codec to the corresponding value.
Absent a value set, the field gets the plain codec type.**

This is family-agnostic and enum-agnostic. A value set is a generic restriction ("the
permitted values here are x, y, z"). A domain enum is *one* producer of a value set; a
native Postgres enum (a target-contributed storage entity) is another. The typing mechanism
knows only value sets — never "enum". This work brings Mongo onto that mechanism, matching
SQL, and removes the last enum-specific typing source in the Mongo family (the interim
`domain.enum` resolver added by TML-2952).

## The two typing paths (precise mechanics)

A field that carries a value set has its TypeScript type produced on two independent paths,
which must agree:

- **Emit path** (`contract.d.ts`, the `db.context`/validated-contract consumer). At
  `contract emit`, working from the **authoring source** (not by reading back
  `contract.json`), the emitter holds the codec-**encoded** values from the storage value
  set. For each value it **decodes through the codec** (`decodeJson`) and **renders the
  decoded value as a TS literal** (`renderValueLiteral`). The union of those literals is the
  field's emitted type. This is the path that *lost* the literal types to the encoded form
  and rebuilds them via the codec.
- **No-emit path** (`typeof contract`). Handed the authored literal values **directly** —
  the author wrote them, `const` generics preserved them on the enum handle, and the path
  simply propagates the union. It never serialized them, so there is nothing to reconstruct
  and no codec call is needed. It is the *easier* path.

Both land on the same value union. Only the **emit** path changes in this work (its source
moves from `domain.enum` to the storage value set); the no-emit path is already correct and
is untouched — the same posture SQL's handle-based no-emit has.

## The invariant — this is uniformity, not a `storageHash` correctness fix

`storageHash = sha256(canonicalize({ schemaVersion, targetFamily, target, storage }))`
(ADR 004) covers the entire `storage` section. The Mongo collection validator — a
`MongoValidator` whose `jsonSchema` carries the enum values **inline** (verified in
`examples/mongo-demo/src/contract.json`: `"enum": ["admin","author","reader"]` sits inside
`storage.namespaces.__unbound__.entries.collection.<c>.validator.jsonSchema`) — is in that
section. So an enum-value change already flows into `storageHash` today, and Mongo already
satisfies the migration-planner isolation/uniqueness invariant. **This work is uniformity +
value-set-driven typing, not a `storageHash` correctness fix.** (The Linear ticket's "for
uniformity, not correctness" framing is correct; an intermediate reading that it was a
correctness fix was reconciled by confirming the validator-in-storage.)

## Design (Level A)

### 1. A value-set entity in Mongo storage — identical to SQL

Add a value-set entity to the Mongo storage block, the same shape as SQL's `StorageValueSet`:

```ts
{ kind: 'valueSet', values: readonly JsonValue[] }   // ordered, codec-encoded; no codecId
```

No `codecId` — the codec lives on the field/column that references the value set. Placement
mirrors SQL's `SqlNamespace.entries.valueSet`: the value set lives at
`contract.storage.namespaces[<ns>].entries.valueSet[<Name>]`. Concretely this means the
Mongo storage namespace's `entries` gains a `valueSet` slot alongside `collection`. New IR
(a `MongoValueSet` node, or a shared value-set node if one can be lifted), its
serializer/hydration walker entry, its arktype schema, and round-trip coverage.

### 2. Authoring populates the value set

The Mongo authoring surfaces build the storage value set for each authored enum, mirroring
SQL's `build-contract` (which builds `domainEnumsByNs` **and** `storageValueSetsByNs` in one
loop, `values: handle.values.map(v => encodeViaCodec(v, codecId, codecLookup))`):

- **PSL interpreter** (`contract-psl/src/interpreter.ts`): today it stamps only the *domain*
  `valueSet` ref on the field (lines ~839–851). It must also emit the storage value set into
  the collection's namespace `entries.valueSet`, keyed by enum name, values = the enum's
  codec-encoded member values.
- **TS builder** (`contract-ts/src/contract-builder.ts`): today it stamps the domain ref from
  `__enumHandle` (line ~1400). It must also build the storage value set from the enum handle
  (`handle.values` + `handle.codecId`), same as SQL.
- **Namespace assembly** (`mongo-contract`'s `build-mongo-namespace.ts`): thread the
  per-namespace value sets into the storage namespace's `entries.valueSet`, mirroring SQL's
  namespace assembly.

The field keeps its existing **domain** `valueSet` ref (`plane: 'domain', entityKind: 'enum',
entityName: <EnumName>`) — unchanged. The storage value set is named identically (the enum
name), which is how the emitter finds it (§4).

### 3. Re-source typing and the validator from the value set

- **Emit typing** — `mongoEmission.resolveFieldValueSet` (`3-tooling/emitter/src/index.ts`,
  the interim resolver): source the permitted `encodedValues` from the **storage value set**
  (looked up by the field ref's `entityName`), and `codecId` from the **field**. Delete the
  interim `domain.enum` read and the `INTERIM (TML-2953)` comment. The framework then renders
  `FieldOutputTypes`/`FieldInputTypes` through `renderValueSetType` → `renderValueLiteralFor`
  exactly as SQL does — no Mongo-specific typing code remains.
- **Validator** — `contract-psl/src/derive-json-schema.ts`: the validator's `enum` keyword is
  today sourced from `enums?.[field.valueSet.entityName]?.members.map(m => m.value)` (line
  ~22–24). Re-source it from the storage value set's `values`. The rendered validator is
  **byte-identical**: the value set's `values` are the `encodeJson`'d member values, which
  equal the current `m.value`.

After this, **no Mongo code reads `domain.enum` to produce a type or the validator's
enforcement.** The only remaining `domain.enum` reader is `db.enums` (runtime dictionary),
which is the intended keep.

### 4. Field → value-set link: by name (Level A)

The emitter reads both planes, so it resolves the storage value set by the **name** carried
on the field's (domain) `valueSet` ref (`entityName`). **No explicit per-field storage ref is
added.** This is legitimate because the emitter is not storage-isolated. The query builder
(which *is* storage-only in SQL) does **not** need this link in Mongo, because Mongo's query
builder types via `FieldOutputTypes` (see §5), not a storage-side map.

The explicit, first-class per-field storage coordinate — and a storage-only Mongo query
builder — is [TML-2961](https://linear.app/prisma-company/issue/TML-2961). It is deferred
because nothing drives it for Mongo: the feature that drives storage-only value-set typing is
native Postgres enums, which are Postgres-only and never touch Mongo.

### 5. What is unchanged

- **Query builder / ORM.** Mongo types documents via `MongoTypeMaps<CodecTypes,
  FieldOutputTypes, FieldInputTypes>` — i.e. off the framework-emitted `FieldOutputTypes`,
  not a storage-side `StorageColumnTypes` like SQL. `FieldOutputTypes` is now sourced from
  the value set (§3), so enum fields narrow correctly with no query-builder change.
- **No-emit path** (`BuilderEnumValueUnion` from `__enumHandle`). Handed the authored values;
  already the value union; untouched.
- **`db.enums`.** Still built from `domain.enum` members. Runtime-only; unchanged.
- **The materialized validator.** Still in storage; the migration planner/verify read it as
  the physical artifact.

### 6. Migration / verify

- The validator is **byte-identical** (same enum values, re-sourced), so there is **no new
  physical migration op** for existing enums. Adding the value-set entity changes
  `storageHash` (a new storage entity), so the Mongo example migration snapshots regenerate
  to carry it — a contract-shape regeneration, not a physical change.
- `db verify` compares the expected validator (now derived from the value set) against the
  live validator — unchanged values, so it passes.
- **Implementation obligation:** confirm the Mongo schema diff/planner treats the value-set
  entity as **non-physical** — it must emit **no** migration op for the value set alone (the
  validator is the physical artifact). A future enum-value change correctly changes the value
  set *and* the validator and *does* produce a `collMod` — that is the desired, non-spurious
  behavior.

## Consumers — who reads what, after this work

| Consumer | Reads for enum typing/enforcement |
| --- | --- |
| Emit typing (`FieldOutputTypes`) | storage **value set** (by name) + field codec → `renderValueLiteral` |
| No-emit (`typeof contract`) | the authored **enum handle** (value union, direct) |
| Validator deriver | storage **value set** → `$jsonSchema.enum` |
| Migration planner / verify | the materialized **validator** (physical artifact) |
| `db.enums` (runtime) | `domain.enum` members (the intended keep) |

## Not byte-identical (unlike TML-2952)

Adding a storage entity means Mongo enum contracts (`examples/mongo-demo`,
`examples/retail-store`) and their migration snapshots regenerate to carry the value set.
Accepted (operator: "I don't care how many contracts change").

## Alternatives considered

- **No storage value set; resolve everything by name off `domain.enum`.** Rejected — the
  value set must be *in storage* for uniformity with SQL and as the single value-set-driven
  typing source; "by name" describes only the field→value-set link, not the value set's
  existence.
- **Explicit per-field storage ref + storage-only Mongo query builder (Level B).** Deferred —
  real work for uniformity with no feature riding on it (native enums, the driver, are
  Postgres-only). The awkward middle.
- **Explicit per-collection document projection (Level C).** [TML-2961] — the architectural
  end-state (collection ≈ table, projected fields ≈ columns), motivated by Mongo's
  nested-document handling, not enums. Its own project.
- **Rework the no-emit path to be value-set-driven.** Rejected — the no-emit path is *handed*
  the authored literals and is already correct; making it value-set-driven is unnecessary and
  would require type-level codec application. Kept handle-based, matching SQL.
