# Spec: enum types come from the codec, via one shared value set (SQL + Mongo)

**Linear:** [TML-2952 (SQL)](https://linear.app/prisma-company/issue/TML-2952/sql-type-enum-columns-through-the-codec-instead-of-printing-their)
· [TML-2953 (Mongo)](https://linear.app/prisma-company/issue/TML-2953/mongo-store-enum-values-the-same-way-sql-does)

**Plain version:** an enum's TypeScript type — the union of its allowed values
(`'low' | 'high' | 'urgent'`) — should be produced by the codec, from a single "value
set" that both SQL and Mongo store. Today it's printed straight from the stored values in
several places, bypassing the codec; this unifies it on one path. SQL is TML-2952, Mongo
is TML-2953. The rest of this doc is the detailed, implementer-facing version.

## Summary

On the **emit** path, the TypeScript type of an enum-restricted field/column is produced by
rendering the stored (codec-encoded) values **directly as TS literals**, bypassing the
codec. That is correct only when the codec's encoded form equals its output type (text/int)
— it works by coincidence, not construction, and rendering a value to TS is the codec's
job, not a generic serializer's. This refactor routes the **emit** typing through the
codec, and removes the separate domain-enum typing override, so all enum typing follows one
model: **a column/field's enum type is the codec's translation of its value set's values.**
After it, the domain `enum` carries **only** the runtime dictionary (the `db.enums` member
maps) and its own type; it stops being a typing input.

The **no-emit** (`typeof contract`) path already does the right thing and is the reference
behavior (it propagates the authored, already-typed values — see below). This is a
correctness + uniformity refactor, **not** a prerequisite for native Postgres enums.

This ticket implements the **SQL** side. The model is family-agnostic; the **Mongo** side
is the parallel follow-up [TML-2953](https://linear.app/prisma-company/issue/TML-2953/apply-the-value-set-codec-enum-typing-model-to-mongo-parallel-of-tml).

## Why (the defect, with evidence)

A column/field's **read type is the codec's output type narrowed to the permitted values.**
The permitted values live in the persistence plane as a **value set** — a list of
**codec-encoded** values: [storage-value-set.ts:12](packages/2-sql/1-core/contract/src/ir/storage-value-set.ts)
(`/** Ordered permitted values, codec-encoded. */`), populated via `codec.encodeJson`
([build-contract.ts:65](packages/2-sql/2-authoring/contract-ts/src/build-contract.ts)).
Producing the read type from those encoded values requires translating each **through the
codec** — the codec author is the only one who knows a value's TS type. The two **emit-path**
implementations skip that and render the stored value directly:

1. **SQL column (emit):** [emitter/index.ts:432-438](packages/2-sql/3-tooling/emitter/src/index.ts)
   → `renderValueSetUnionBase(valueSet.values)` → `renderValueSetLiteral` (string → quoted,
   number/boolean → `String`, else `undefined`). No codec.
2. **Domain field (emit):** [domain-type-generation.ts:323-333](packages/1-framework/3-tooling/emitter/src/domain-type-generation.ts)
   — the enum override reads `domainEnum.members.map(m => m.value)` → `renderEnumValueUnion`
   → `renderEnumMemberLiteral` (same direct render). No codec.

These are correct only for codecs whose encoded form equals their output type. A
runtime/encoded value does not carry its TS type — `serializeValue`
([domain-type-generation.ts:17](packages/1-framework/3-tooling/emitter/src/domain-type-generation.ts))
structurally guesses it and is unsound for anything richer than a primitive. Rendering a
value to TS is the codec's job, exactly as `renderOutputType` already is (ADR 186/208).

**The no-emit path is already correct — it is the reference.** [contract-types.ts:683-718](packages/2-sql/2-authoring/contract-ts/src/contract-types.ts):
`EnumValueUnion` = `Values[number]` from the authored `EnumTypeHandle`'s literal tuple. The
author wrote the member values, const generics preserved their literal types, and the
no-emit path simply **propagates those already-typed values** into the field-type map. It
never serialized them, so there is nothing to reconstruct and no codec call is needed. The
emit path is the one that lost the types (to `contract.json`'s encoded JSON) and must
rebuild them via the codec. So the fix is asymmetric: emit goes through the codec; no-emit
already has the answer.

## Why the value set lives in storage (the invariant behind the structure)

The value set is a **persistence-plane** entity for a specific reason: the migration planner
must derive the expected schema from the storage segment **alone**, with no reference into
`domain`. The evidence:

- [ADR 004](docs/architecture%20docs/adrs/ADR%20004%20-%20Storage%20Hash%20vs%20Profile%20Hash.md):
  `storageHash = sha256(canonicalize({ schemaVersion, targetFamily, target, storage }))` —
  computed from the `storage` section only, *"intentionally excludes `models`, `relations`,
  …"*, and is *"used for applicability of migrations and plan verification."*
- [ADR 199](docs/architecture%20docs/adrs/ADR%20199%20-%20Storage-only%20migration%20identity.md):
  a migration's identity reflects *"what they do to storage, not the shape of the contract's
  domain layer."* A domain edit (member rename, codec metadata) must not invalidate a
  migration.
- [ADR 221 §115](docs/architecture%20docs/adrs/ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md):
  *"a domain entity may reference a storage entity, but not the reverse — the storage plane
  must remain independently consumable by the migration planner/runner."*

So everything the physical schema depends on must live **in** storage. If the planner read
`domain.enum` to build the `CHECK`, then (a) changing the permitted values would change the
physical schema but **not** `storageHash` (which excludes domain) — a needed migration goes
undetected; and (b) domain-only edits would leak into migrations. The value set puts the
*physical* permitted values in storage (captured by `storageHash`, read by the planner
without touching domain), while member **names** — domain-only, no physical effect — stay in
`domain.enum`, so renaming one triggers nothing physical. That is exactly the split the value
set provides.

## The model (target state)

- **One value-set entity in the storage plane, in both families** — the canonical, named
  source of a column/field's permitted values, codec-encoded. Same data structure for SQL and
  Mongo. This is the uniform primitive; typing and enforcement both read it.
- **The domain `enum` carries only the runtime dictionary** — the name→value member maps
  behind `db.enums`, and the enum's own type. It is **not** a typing input.
- **The TS type of every enum-restricted field, column, and document field is the codec's
  translation of its value set's values**, narrowed to those values, with nullability
  applied. One model, three surfaces, both families. On the emit path that translation is an
  explicit codec call; on the no-emit path it is the already-typed authored values.
- **Enforcement is the per-family branch, both rendered *from* the value set.** SQL renders
  `CHECK (col IN (...))` on demand. Mongo renders its `$jsonSchema` `enum` keyword and keeps
  materializing the validator **inline** in storage (explicit, self-contained). The values
  then appear both in the value-set entity and inline in Mongo's validator — that redundancy
  is **intentional and emitter-guaranteed**, per [ADR 172](docs/architecture%20docs/adrs/ADR%20172%20-%20Contract%20domain-storage%20separation.md)
  (each level self-contained; a reader never assembles a fact from another section). Both the
  value-set entity and the inline validator are in storage, so the invariant above holds.

## The codec mechanism (new seam — emit only)

The emit path needs to turn a codec-encoded value into its TS output/input type. Add the
value-keyed counterpart of `renderOutputType` (params-keyed) to `CodecDescriptor` and
`CodecLookup`:

```ts
// Given one stored (codec-encoded) value, return the TS literal type to print for it.
// `value` is the value as stored in the value set (codec-encoded, i.e. encodeJson form).
// `side`: `output` = the read/SELECT type, `input` = the create/update type.
// Returns a TS type string (e.g. "'low'", "1"), or `undefined` if the codec cannot
// express the value as a narrowed literal (e.g. a Date-output codec).
renderValueLiteral(value: JsonValue, side: 'output' | 'input'): string | undefined;
```

- **Built-in primitive codecs** (`pg/text@1`, integer, boolean, …) implement it as the
  literal of the decoded value: text → `serializeValue(decodeJson(v))` = `'low'`; int → `1`.
  (`decodeJson` is synchronous / build-time by design — [codec.ts:30](packages/1-framework/1-core/framework-components/src/shared/codec.ts).)
- **Codecs that cannot narrow to a literal** return `undefined`; the consumer falls back to
  the codec's full output type (`CodecTypes[id][side]` / `renderOutputTypeFor`).

The emitter calls `renderValueLiteral` per value-set value and joins with `|`, applying
nullability. `serializeValue` stays for structural emit scaffolding; it is **not** used to
type codec values. **No type-level counterpart** — the no-emit path already has the authored
types.

## Changes by surface

1. **Codec descriptor + lookup** — add `renderValueLiteral`. Implement for the built-in Postgres
   + framework primitive codecs. Non-narrowable codecs return `undefined`.
2. **SQL column, emit** — [emitter/index.ts](packages/2-sql/3-tooling/emitter/src/index.ts):
   in `computeColumnType`, replace the direct `renderValueSetUnionBase(valueSet.values)` with
   per-value `codecLookup.renderValueLiteralFor(codecId, value, side)`, joined with `|`, falling back to the
   codec output type where it returns `undefined`. Delete `renderValueSetLiteral` /
   `renderValueSetUnionBase`.
3. **Domain field, emit** — [domain-type-generation.ts](packages/1-framework/3-tooling/emitter/src/domain-type-generation.ts):
   **delete** the hardcoded domain-enum override branch (lines 323-333) and
   `renderEnumValueUnion` / `renderEnumMemberLiteral` / `DomainEnumLookup`. `FieldOutputTypes`
   is generated by `generate-contract-dts.ts` for **both** families (Mongo has no own
   generation), so the framework emitter cannot reach into `storage` to resolve a field's
   permitted values — that would break the framework-holds-no-storage boundary (TML-2886). The
   permitted values are supplied by a **family-supplied per-field resolver** on `EmissionSpi`
   (mirroring the existing `resolveFieldTypeParams` hook): given a field, it returns
   `{ encodedValues, codecId }` for an enum-restricted field, or `undefined` otherwise. The
   framework renders each `encodedValue` through `renderValueLiteral`, joins with `|`, and applies
   nullability — the **same codec path** the SQL column emit uses.
   - **SQL** resolves field → column (`storage.fields.<field>.column`) → storage value-set, so
     the SQL field type derives from its column's value set; the domain enum is no longer a SQL
     typing input.
   - **Mongo** supplies an **interim** resolver that reads `domain.enum` members — Mongo has no
     value-set entity yet (step 6 / TML-2953), so the domain enum is its only permitted-values
     source. This keeps Mongo's emitted enum field types **byte-identical**; the resolver routes
     through `renderValueLiteral` like every other enum type. TML-2953 deletes it once Mongo's
     value set lands.
4. **No-emit** — [contract-types.ts](packages/2-sql/2-authoring/contract-ts/src/contract-types.ts):
   **no change required.** `EnumValueUnion` already propagates the authored `Values` and is
   the model-correct reference behavior. Obligation: cross-check it still agrees with the
   corrected emit output (A6).
5. **`db.enums` / domain enum** — unchanged in behavior; the domain `enum` entity is now used
   **only** for the runtime member dictionary, not typing. Confirm no remaining typing reader
   of `domain…enum` after step 3.
6. **Mongo** — out of scope for *this* ticket's mechanism; touched only by the **interim
   resolver** (step 3) that keeps its emitted enum field types byte-identical. Mongo already
   has a domain enum and a materialized inline validator but **no value-set entity** — its
   field references the domain enum and its validator is rendered from `domain.enum`. The
   parallel follow-up [TML-2953](https://linear.app/prisma-company/issue/TML-2953/apply-the-value-set-codec-enum-typing-model-to-mongo-parallel-of-tml)
   brings Mongo onto this model: add the value-set entity to Mongo storage; render the
   validator's `enum` keyword **from the value set** instead of the domain enum (keeping the
   inline, self-contained validator); type document fields from the value set + codec; and
   **delete the interim Mongo resolver** so the domain enum stops being a typing input
   repo-wide. Not blocked (Mongo enums landed in #834). Could be folded into a Mongo milestone.

## Acceptance criteria

- **A1 — Emit typing goes through the codec.** No emit-path field/column type is produced by
  rendering a stored value directly. Every enum-restricted emit type goes through
  `renderValueLiteral`; the direct-render helpers (`renderValueSetUnionBase` etc.) are deleted, so
  no caller renders `valueSet.values` / enum member values to TS literals outside the codec seam.
- **A2 — Domain enum is not a SQL typing input.** The hardcoded enum override in
  `domain-type-generation.ts` and `DomainEnumLookup` are deleted; the framework renders enum
  field types only through the family-supplied resolver + `renderValueLiteral`. No **SQL** code
  reads `domain…enum` to produce a TS type — the SQL resolver sources from the storage value
  set. (Repo-wide, the only remaining reader is Mongo's **interim** resolver, removed by
  TML-2953; see step 3.) `db.enums` runtime behavior unchanged.
- **A3 — One model, three surfaces.** SQL column, SQL/ORM field, and (per spec, via TML-2953)
  Mongo document field all resolve their enum type from `(value set, codec)`. The SQL field
  derives from its column via `storage.fields`.
- **A4 — Output unchanged for identity codecs.** For the demo/fixtures (text-backed enums),
  `FieldOutputTypes`, `StorageColumnTypes`, and the no-emit `typeof contract` enum types are
  **byte-identical** to before. This includes the **Mongo** demo enum field
  (`examples/mongo-demo/src/contract.d.ts` `role: 'admin' | 'author' | 'reader'`), preserved
  via the interim Mongo resolver. `fixtures:check` shows no observable type change;
  `contract.json` and hashes unchanged.
- **A5 — Correct for a non-identity codec (emit).** A test fixture defines a value set over a
  codec whose output type differs from its encoded form, and asserts the **emitted** type is
  the codec's output type (narrowed where the codec narrows; the full output type where
  `renderValueLiteral` returns `undefined`) — **not** the raw encoded literal.
- **A6 — Emit and no-emit agree.** For every enum field in the fixtures, the no-emit
  `typeof contract` type equals the emitted `contract.d.ts` type.
- **A7 — No new bare casts; lint:deps clean; build + typecheck + full test suites pass.**

## Non-goals

- Native Postgres enums (separate project; independent, not a prerequisite).
- Changing how enforcement is *applied* (SQL `CHECK` rendering / Mongo validator
  materialization stay as they are; only their *source* becomes the value set).
- The Mongo implementation (scheduled as TML-2953).
- Any change to `db.enums` runtime behavior, the authoring surface (`enumType` / PSL `enum`),
  or the no-emit path's already-correct mechanism.

## Open questions

None outstanding. Resolved during shaping:
- Codec value→type mechanism: a new **emit-only** `renderValueLiteral` on the codec, not a
  generic serializer and not `renderOutputType`-from-params, because a value does not carry
  its TS type.
- No-emit path: already correct — it propagates the authored typed values; needs no codec
  mechanism. It is the reference the emit path is brought in line with.
- Why the value set is in storage: the migration planner derives the expected schema from the
  storage segment alone (`storageHash` / ADR 004, ADR 199, ADR 221 §115). Documented above.
- Mongo data structure: the **same value-set entity** as SQL (uniform). Mongo keeps its
  inline, self-contained validator (rendered from the value set); the value-on-both-sides
  redundancy is intentional per ADR 172. Implemented in TML-2953.
- Field→type connection: already solved by the existing `FieldOutputTypes` map; the refactor
  changes the computation (a family-supplied per-field resolver feeding `renderValueLiteral`), not
  the connection.
- Keeping Mongo green while the shared override is deleted: `FieldOutputTypes` is generated once
  in `generate-contract-dts.ts` for both families, and the framework emitter must not read
  `storage`. So the permitted-values source is a family-supplied resolver (mirroring
  `resolveFieldTypeParams`): SQL sources from the storage value set, Mongo from `domain.enum`
  on an interim basis (byte-identical, removed by TML-2953). A2 is therefore SQL-scoped now and
  repo-wide after TML-2953.
