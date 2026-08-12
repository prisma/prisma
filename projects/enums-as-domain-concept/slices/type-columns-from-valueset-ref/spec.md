# Slice: type-columns-from-valueset-ref

Parent project: `projects/enums-as-domain-concept/`. Linear:
[TML-2886](https://linear.app/prisma-company/issue/TML-2886).

> **Design settled 2026-06-16 (after a rejected first attempt).** An earlier cut
> (PR #833, now closed) made each lane resolve enum types by *following the `valueSet`
> ref at the type level* through the emitted contract. That was rejected on two counts:
> (1) it pushed a multi-hop type-level traversal into every enum column type, which
> compounds across multi-table / many-column queries and exhausts TypeScript's
> instantiation budget on large contracts; (2) it over-applied symmetry — the ORM is a
> domain consumer for which the existing per-field lookup table is the correct, simple
> tool. This slice keeps the one good idea (the storage plane should type its own
> columns from its own value-sets) and realizes it as **baked literal lookups computed
> in the emitter**, not type-level reference-following.

## The decision

When you read an enum column you get the exact value union (`'low' | 'high' |
'urgent'`), not `string` — unchanged. What this slice fixes is the *mechanism*:

1. The SQL **storage plane gets its own baked column-type lookup** — a new top-level
   emitted map (parallel to `FieldOutputTypes`), keyed `[table][column]`, each entry the
   column's type (codec output narrowed by its `valueSet`) baked to a plain literal at
   emit time. The query builder reads it with a single indexed access. The storage plane
   is now self-typing: a column with a value-set but **no** domain field (a raw
   value-set) types correctly, and the query builder never reaches across into a
   domain-keyed table.
2. The domain **field lookup (`FieldOutputTypes`/`FieldInputTypes`) keeps existing**,
   and is **derived from the storage column lookup at emit time** via the field→column
   mapping the model already carries (a domain→storage projection — the legal
   direction). The ORM keeps its single-indexed read of `FieldOutputTypes`, unchanged
   from before PR #833.
3. **No type-level reference-following anywhere in the emitted `.d.ts`.** Both lookups
   are flat literal maps. The derivation happens in the emitter (generator code), so
   consumers do O(1) indexed access, never traversal.

Observable types are identical; `contract.json` and its hashes stay byte-identical.

## Why this shape

- **TypeScript evaluation cost is the binding constraint.** A baked literal entry is
  one property access and pulls nothing else into the consumer's type graph. A
  reference-following expression (`ContractBase['domain']…['members'][number]['value']`,
  re-evaluated per column, mapped over every selected column, nested in a query result
  type) compounds instantiations until TS hits "excessively deep" or the editor stalls.
  The baked lookup table exists for exactly this reason.
- **The real defect was the cross-plane reach, not the table.** The old SQL query
  builder typed a column by walking storage column → domain model field → the domain
  `FieldOutputTypes` table. The table was fine; the storage-plane surface reaching into
  a domain-keyed table was the violation (spec §5). Giving storage its own column-type
  lookup removes the reach at the root.
- **Derivation reflects the data flow.** A field's read value *is* its decoded column
  value, so a field's read type *is* its column's read type. Deriving the field lookup
  from the storage column lookup computes the enum narrowing in exactly one place and is
  the honest model. (The "single source so it can't drift" framing from the first
  attempt was confabulated — a generated file regenerates atomically and can't drift.)

## Boundaries — framework holds no STORAGE knowledge

- The **storage column lookup** (`StorageColumnTypes`/`StorageColumnInputTypes` —
  keyed by table/column, narrowed by the storage column's `valueSet`) lives in
  the SQL family emitter (`packages/2-sql/3-tooling/emitter`), alongside the
  existing storage-type generation. The framework emitter must **not** gain
  knowledge of columns, storage value-sets, or storage tables.
- **Domain enum narrowing is framework-level.** A `field.valueSet` of
  `entityKind: 'enum'` is a domain-plane reference (`contract.domain.enum`); the
  framework emitter reads its members directly and bakes the literal union into
  `FieldOutputTypes`/`FieldInputTypes`. Same algorithm Mongo and SQL both need;
  same algorithm `contract-ts` already uses for the no-emit (`typeof contract`)
  path. The framework already delegates parameterized-codec rendering via
  `resolveFieldTypeParams` (kept) because parameterized types ARE family-
  specific. It does NOT delegate enum narrowing — that's family-agnostic.
- `FieldOutputTypes` and `StorageColumnTypes` compute the value-union
  *independently* (same algorithm, no derivation hook between them). They were
  byte-identical before; they stay byte-identical after.

## Cross-family (SQL-only realization)

This mechanism is a **SQL-family realization**, not a framework concept. Mongo's storage
is collections + `$jsonSchema` validators where a document field is ~1:1 with the model
field — no separate column key-space, no cross-plane reach to fix. Mongo keeps computing
its own field-type lookup (`mongo-contract` `MongoTypeMaps`), unchanged. The
field-type-lookup *concept* is per-family; only the SQL realization gains the storage
column lookup + derivation. Consistent with Mongo being a separate vertical (R10 /
TML-2884).

## No-emit (`typeof contract`) path

The no-emit path is computed type-level by `contract-ts` (`FieldChannelType` /
`EnumValueUnion`), since there is no emit step to bake anything. It **keeps its current
mechanism and must continue to function** — an enum field read on `typeof contract` still
resolves to the value union (covered by `enum-surface.types.test-d.ts`). It does **not**
adopt reference-following.

## Scope

**In:**
- SQL family emitter: bake the top-level storage column-type lookup (literals), keyed
  `[table][column]`.
- Query builder: read the storage column lookup with O(1) indexed access; delete the
  storage→domain `FieldOutputOverride` walk.
- SQL family emitter: derive `FieldOutputTypes`/`FieldInputTypes` from the storage
  column lookup at emit time (baked literals); the ORM's read (`ComputeColumnJsType`)
  reverts to a plain `FieldOutputTypes` index — no ref-following, no fallback chain.
- Framework emitter: bake domain enum narrowing directly (read
  `contract.domain.namespaces[ns].enum[name].members[*].value`); no knowledge of
  storage columns, storage value-sets, or storage tables in framework code.
- Tests per acceptance criteria below.

**Out:**
- The migration / verification / DDL path (already reads refs from `contract.json`).
- Mongo (its own field-type computation, untouched).
- The no-emit path's computation mechanism (kept; must stay functional).
- Cross-space (`spaceId`) references (unreachable today; rides TML-2500).

## Acceptance criteria

- **A1 — Typed output (R4).** An enum column/field read is statically the value union,
  not `string`, in the query builder (`ResultType`/`select`), the ORM
  (`DefaultModelRow` / `db.orm…`), **and** a direct `type X = FieldOutputTypes[ns][M]`
  index. Verified by reading the test assertions.
- **A2 — Typed input (R5).** Write payloads accept only the union; an invalid literal is
  a compile error (negative `@ts-expect-error` test).
- **A3 — Storage self-typing.** A storage column with a `valueSet` and no domain field
  types as the union via the storage column lookup (raw value-set case).
- **A4 — No type-level traversal in the emitted output.** The emitted
  `FieldOutputTypes`/`FieldInputTypes` and storage column lookup are plain literal types
  — no `ContractBase[...]` / ref-following expressions. A test/grep guard asserts this.
- **A5 — Framework holds no STORAGE knowledge.** No knowledge of storage
  columns, storage tables, or storage value-sets in
  `packages/1-framework/3-tooling/emitter`. (Domain enum narrowing IS framework-
  level — same algorithm Mongo and SQL share.) `lint:deps` + grep guard.
- **A6 — No-emit path functional.** `enum-surface.*` and `contract-ts` enum tests stay
  green; an enum field read on `typeof contract` resolves to the union.
- **A7 — Contract bytes stable.** `contract.json` / `storageHash` / `profileHash`
  byte-identical; `fixtures:check` shows only `.d.ts` regeneration.
- **A8 — No new bare `as` (R9).** Cast ratchet clean.
- **A9 — Type-eval sanity.** No "type instantiation is excessively deep" on the
  demo/fixtures; a sanity check on a wide multi-column selection.

## Follow-ups

- **`spaceId` / TML-2500.** Cross-space value-set references remain unhandled;
  unreachable today.
- **TML-2926 — SQL emitter god-file extraction.** `packages/2-sql/3-tooling/emitter/src/index.ts`
  is multi-hundred-line. Out of scope for this slice; tracked separately. Every line
  added to it now is future extraction tax — prefer extracting helpers when touching it.
