# Plan: enum types from the codec via the value set — SQL (TML-2952)

**Spec:** [`./spec.md`](./spec.md) · **Linear:** [TML-2952](https://linear.app/prisma-company/issue/TML-2952)
· Mongo follow-up [TML-2953](https://linear.app/prisma-company/issue/TML-2953)

This plan covers the **SQL** ticket only. Mongo onboarding (its own value-set entity,
validator-from-value-set, deleting the interim resolver) is TML-2953.

## Slice DoD

All spec acceptance criteria A1–A7 hold:
- Every emit-path enum type goes through the codec `renderValueType` seam (A1); the hardcoded
  domain-enum override + `DomainEnumLookup` are deleted (A2, SQL-scoped); SQL column, SQL/ORM
  field resolve from `(value set, codec)` (A3).
- Text/int fixtures **and** the Mongo demo enum field are byte-identical; `fixtures:check`
  clean; `contract.json` + hashes unchanged (A4).
- A non-identity test codec proves the emitted type is the codec's **output** type, not the
  raw encoded literal (A5); emit and no-emit agree for every enum field (A6).
- No new bare casts; `lint:deps` clean; build + typecheck + full suites pass (A7).

Test-first throughout (repo rule): each dispatch writes its failing tests before implementation.

## Dispatches (sequential)

### D1 — Codec `renderValueType` seam + primitive implementations

- **Outcome:** A codec can render a single stored (codec-encoded) value's TS type for a given
  channel. `renderValueType(encodedValue, channel)` exists on `CodecDescriptor`
  (optional) and is exposed as `renderValueTypeFor(id, value, channel)` on `CodecLookup` /
  `CodecRegistry` (and `emptyCodecLookup` + the test lookups). Built-in Postgres primitive
  codecs (text, int2/4/8, float4/8, bool) implement it; non-narrowable codecs return
  `undefined`. No emitter consumes it yet.
- **Builds on:** nothing.
- **Hands to:** D2 and D3, which both render value-set values through `renderValueTypeFor`.
- **Focus:**
  - `codec-descriptor.ts` (`CodecDescriptorImpl` optional method), `codec-types.ts`
    (`CodecLookup` / `CodecRegistry` / `emptyCodecLookup`), `control-stack.ts` (add a
    `valueRenderersById` map mirroring `renderersById`; wire `renderValueTypeFor`).
  - `postgres/src/core/codecs.ts` primitive descriptors: render the literal of the **decoded**
    value (identity codecs: encoded value rendered as a literal — text → quoted, int/bool →
    `String`); `undefined` where not literal-expressible. Decide whether a base-class default
    covers the common primitives or each overrides (implementer's call).
  - Update the test `CodecLookup` fixtures that will otherwise miss the new member
    (`contract-psl/test/fixtures.ts`, `contract-ts` codec-encoding test lookup).
  - Unit tests: `'low'→"'low'"`, `1→"1"`, `true→"true"`, non-narrowable → `undefined`.

### D2 — SQL column emit through the codec

- **Outcome:** `StorageColumnTypes` / `StorageColumnInputTypes` enum columns are produced via
  `renderValueTypeFor` per value, joined with `|`, nullability applied, falling back to the
  codec output type (`CodecTypes[id][channel]` / `renderOutputTypeFor`) when any value returns
  `undefined`. `renderValueSetUnionBase` / `renderValueSetLiteral` are deleted.
- **Builds on:** D1.
- **Hands to:** D3 (the SQL family resolver reuses this same column value-set→type computation
  so field and column types stay identical), and the slice's A5 column assertion.
- **Focus:** `sql/3-tooling/emitter/src/index.ts` `computeColumnType`. Introduce a shared
  `renderValueSetType(values, codecId, side, codecLookup)` helper (column and the D3 SQL
  resolver both call it). Tests: text/int enum column byte-identical (A4); the non-identity
  test codec column types as the codec output, not the encoded literal (A5).

### D3 — Framework field emit via family resolver; delete the domain override

- **Outcome:** Enum field types in `FieldOutputTypes` / `FieldInputTypes` are produced by a
  **family-supplied per-field permitted-values resolver** rendered through `renderValueTypeFor`
  — the hardcoded domain-enum override branch, `DomainEnumLookup`, `renderEnumValueUnion`, and
  `renderEnumMemberLiteral` are gone. SQL sources from the storage value set (field → column →
  value set, reusing D2's helper); Mongo supplies the **interim** resolver reading
  `domain.enum`. Both families byte-identical.
- **Builds on:** D1 (renderer) + D2 (shared value-set→type helper).
- **Hands to:** D4 (full verification): both families' enum field types are codec-sourced and
  the override is deleted.
- **Focus:**
  - `emission-types.ts`: add the optional resolver hook to `EmissionSpi`
    (`resolveFieldValueSet?(model, fieldName, contract): { encodedValues, codecId } | undefined`,
    shaped to mirror the existing `resolveFieldTypeParams`).
  - `generate-contract-dts.ts` / `domain-type-generation.ts`: thread the resolver into
    `resolveFieldType`; render via `renderValueTypeFor`; delete the override + helpers + lookup.
  - `sqlEmission` (`sql/3-tooling/emitter/src/index.ts`): SQL resolver (field → `storage.fields`
    column → storage value-set values + codecId).
  - Mongo SPI (`mongo/3-tooling/emitter/src/index.ts`): interim resolver reading `domain.enum`
    members. Add a code comment pointing at TML-2953 as the removal trigger.
  - Tests: SQL text/int field byte-identical; **Mongo demo `role` field byte-identical**; A5
    field types as codec output.

### D4 — Acceptance proof, guards, and full verification

- **Outcome:** The slice DoD is demonstrably met. Grep guards assert no caller renders
  `valueSet.values` / enum member values to TS literals outside the codec seam (A1) and that no
  SQL code reads `domain…enum` to produce a type (A2). An emit-vs-no-emit agreement test covers
  every fixture enum field (A6). `fixtures:check` clean (A4); build + typecheck + `lint:deps` +
  cast ratchet + full test suites pass (A7).
- **Builds on:** D2 + D3.
- **Hands to:** PR-open.
- **Focus:** the cross-cutting type tests + grep guards; run the full gate set
  (build, typecheck --force, the Lint job incl. `lint:casts`, `fixtures:check`, all test
  suites). Land the A5 non-identity codec in a shared test location if D2/D3 each needed it.

## Sequencing notes

- D2 before D3: D3's SQL resolver reuses D2's value-set→type helper so `FieldOutputTypes` and
  `StorageColumnTypes` compute the enum union identically (byte-identical, no ref-following —
  the TML-2886 boundary).
- D3 is the heaviest dispatch and is **atomic by necessity**: deleting the shared override
  requires both family resolvers present, or `FieldOutputTypes` regresses mid-flight. Its two
  consumers (the SQL + Mongo resolvers) are a few lines each, so it stays within Small.
- The no-emit path (`contract-ts`) is **not** modified; D4's A6 test pins its continued
  agreement with the corrected emit output.
