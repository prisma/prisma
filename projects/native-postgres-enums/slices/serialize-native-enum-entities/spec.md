# Slice — `serialize-native-enum-entities`

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md) · **Requirement:** hardens R1 (entity round-trips through `contract.json`); prerequisite for Phase-2 R7/R8 (the planner reads members from the storage segment) and for pack-owned subtraction on hydrated contracts (follow-up from [`../infer-native-enum-adoption/spec.md`](../infer-native-enum-adoption/spec.md))

## At a glance

A `native_enum` entity today is authoring-time-only: carried **non-enumerable** on `PostgresSchema.entries` ([postgres-schema.ts](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-schema.ts) ~86–107), so the serializer, the hashing pipeline, and `contract.json` all skip it — only the derived `entries.valueSet` survives. That was Phase 1's "no readers after emit" assumption, and it has expired twice over:

1. **Phase 2 owns DDL for these types** (`CREATE TYPE`/`ADD VALUE`): the migration planner must derive the expected type — name and *ordered* members — from the storage segment of `contract.json` alone.
2. **Pack-owned subtraction is blind on hydrated contracts** (shipped-slice follow-up): production `describedContracts` hydrate from `contract.json`, which carries no enum type names, so `contract infer` cannot subtract a pack's enum types.

After this slice, `entries.native_enum` serializes like `role`/`policy`:

```jsonc
"entries": {
  "native_enum": { "AalLevel": { "kind": "postgres-enum", "typeName": "aal_level", "members": ["aal1", "aal2", "aal3"] } },
  "valueSet":    { "AalLevel": { /* derived, unchanged */ } }
}
```

and a JSON-hydrated Supabase pack contract exposes `aal_level` to the infer subtraction.

## Chosen design

**Delete the non-enumerable carve-out; the generic machinery does the rest.** The entity becomes an ordinary enumerable entries kind:

- **Serialization**: TML-2981 made the SQL serializer iterate the namespace `entries` dict generically; `native_enum` was excluded *only* by non-enumerability. Removing the carve-out flows it into `contract.json` with no serializer edit expected.
- **Hydration**: already generic — `hydrateNamespaceEntities(entriesInput, this.entryKinds, …)` with `nativeEnumEntityKind` composed. Confirm the arktype structure validator ([postgres-validators.ts](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-validators.ts)) admits the key; absent-key contracts (every existing enum-free `contract.json`, and stale enum-bearing ones) hydrate exactly as today.
- **Hashing**: the carve-out's own comment states its purpose — keep `computeStorageHash`'s `JSON.stringify` canonicalization walking past the entity so the hash matches the serialized bytes. Enumerability restores that same coherence in the inclusive direction: bytes and hash change **together**, only for enum-bearing contracts. This also honors the project spec's standing intent ("the `native_enum` entity … [is a] physical storage-plane object …, captured by `storageHash` and read by the planner").
- **`contract.d.ts` is untouched.** The generic-collapse review deleted the raw-slot emission from the type surface because nothing reads it there; that stays true. This slice changes `contract.json` only.
- **The payoff is proven at the infer entry**: `describedNativeEnumOwnersByTypeName` matching over a contract hydrated from the (regenerated) Supabase pack `contract.json` — closing the shipped slice's follow-up the production way, not the in-memory way.

**Alternatives rejected:** re-deriving entities from `valueSet` on deserialize reconstructs `typeName` from nothing (the value-set is keyed by handle name and carries no type name — the very gap being fixed); matching subtraction via column `typeParams.typeName` only sees *used* types, misses `control`, and leaves Phase 2's planner still without members-in-order from storage.

## Coherence rationale (slice-INVEST · _Small_)

One reviewer holds: **"the `native_enum` entity survives `contract.json` and its hash, and hydrated pack contracts drive infer subtraction."** Serialization without the hydrated-subtraction proof is unverified plumbing; regeneration without the mechanism is impossible. One PR, one rollback unit.

## Scope

**In:** the enumerability flip + any serializer/validator/hydrator adjustments it forces; serialize→hydrate round-trip tests (member order, `control`, absent-key tolerance); hydrated-contract subtraction test at the infer entry; regeneration of every artifact the byte/hash change touches (emit fixtures, the parity `expected.contract.json`, the Supabase pack's checked-in `contract.json`/`contract.d.ts`, example migration ledgers via `regen-example-migrations.mjs` where hashes are pinned); shipped-slice spec § Follow-ups bookkeeping.

**Deliberately out:** Phase-2 projection/differ/ops (the entity becomes *available* to the planner; nothing reads it yet); `contract.d.ts` surface changes; multi-namespace infer (TML-2958); the CLI schema-selection limitation (separate follow-up).

## Pre-investigated edge cases

- **Drift must be exactly the intended shape.** `fixtures:check` and the checked-in artifacts will drift on enum-bearing contracts only: an added `entries.native_enum` map + moved `storageHash`/contract-hash fields. Enum-free contracts must stay byte-identical — pin with a regression test, and review the regeneration diff against exactly that shape (never regenerate-to-green).
- **Downstream consumers are additive-safe, verify anyway.** Old `contract.json` artifacts (no `native_enum` key) remain valid — hydration treats the kind as absent. Confirm no validator rejects unknown/new keys in either direction, and note for extension authors that stale checked-in artifacts lose nothing they had.
- **PSL↔TS byte-parity self-updates.** Both authoring paths attach the same in-memory entity, so parity should hold after regenerating `expected.contract.json` — a parity failure here signals a real asymmetry (e.g. the TS path's harvested entity differing from PSL's lowered one), not fixture staleness.
- **`db verify` signing.** Example ledgers pin contract hashes; enum-bearing examples (Supabase) need re-signed/regenerated ledgers or verify will report hash mismatch — this is the mechanism working, not a bug.
- **R1's existing "round-trip" test coverage is narrower than its name** ([psl-native-enum-authoring.test.ts](../../../../packages/3-targets/3-targets/postgres/test/psl-native-enum-authoring.test.ts) round-trips `@@map` lowering, not JSON). [postgres-contract-serializer.test.ts](../../../../packages/3-targets/3-targets/postgres/test/postgres-contract-serializer.test.ts) likely asserts the entity's *absence* — those assertions invert.

## Slice-specific done conditions

- A serialized enum-bearing contract round-trips: serialize → JSON → hydrate → the `PostgresNativeEnum` entities `toEqual` the authored ones (order, `typeName`, `control`), and `storageHash` matches what actually serialized.
- `contract infer` with a `describedContracts` entry hydrated from the regenerated Supabase pack `contract.json` omits `aal_level` (the shipped slice's subtraction, now production-shaped).
- Enum-free emitted contracts byte-identical; all regenerated-artifact drift reviewed as exactly the intended shape; `pnpm fixtures:check` clean post-regeneration.

(CI-green, reviewer-accept, project-DoD floor inherited.)

## Open questions

_None blocking — the enumerability flip either flows through the generic serializer or the first dispatch reports what it actually hit._

## References

- Carve-out to delete: [`postgres-schema.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-schema.ts) (~86–107, incl. the hash-coherence comment).
- Generic serializer: [`sql-contract-serializer-base.ts`](../../../../packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts) (TML-2981, PR #931); hydration: `hydrateNamespaceEntities` call in [`postgres-validators.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-validators.ts) (~166–186).
- Subtraction consumer: `describedNativeEnumOwnersByTypeName` in [`infer-psl-contract.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts) (PR #944).
- Artifacts to regenerate: `packages/3-extensions/supabase/src/contract/contract.{json,d.ts}`, `test/integration/test/authoring/parity/native-enum/expected.contract.json`, emit fixtures via `pnpm fixtures:check`, examples via `scripts/regen-example-migrations.mjs`.

## Dispatch plan

See [`plan.md`](plan.md).
