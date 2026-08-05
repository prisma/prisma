# Slice: 06-integer-representation-codecs

_(Parent project `projects/codec-json-projections/`. Outcome this slice contributes: the integer representation vocabulary becomes a per-column contract choice — lossless `bigint` stays the default, and two opt-in presets give users native-`number` decoding with a throwing guard and arbitrary-precision integers.)_

## At a glance

Adds two opt-in column presets and three codecs: **`BigIntNumber`** (PostgreSQL + SQLite) — 64-bit integer storage decoded as JS `number`, throwing outside the safe-integer range — and **`UnboundedInt`** (PostgreSQL only) — unconstrained `numeric` storage with integrality-checked decode to JS `bigint`. Bare `BigInt` keeps the lossless codec, so this slice breaks nothing. It unblocks slice 08, whose `count()`/`sum()` defaults and `sumBigInt` output name these codec IDs in aggregate descriptor rows.

## Chosen design

Settled in [`design-notes.md` § Integer representation and the aggregate operation split (2026-08-04)](../../design-notes.md).

### The codecs

| Codec (working IDs) | Target storage | Application value | Canonical JSON | Decode guard |
| --- | --- | --- | --- | --- |
| `pg/int8number@1` | `int8` | `number` | JSON number | throws outside ±(2^53 − 1); rejects non-integral text |
| `sqlite/bigintnumber@1` | INTEGER | `number` | JSON number | same |
| `pg/unboundedint@1` | unconstrained `numeric` | `bigint` | decimal text | rejects non-integral values |

Each is an ordinary codec class + target descriptor pair beside its sibling (`PgInt8Codec`/`PgInt8Descriptor`, `packages/3-targets/3-targets/postgres/src/core/codecs.ts:664-710`; SQLite equivalent in `packages/3-targets/3-targets/sqlite/src/core/codecs.ts`), with traits `['equality', 'order', 'numeric']`. The encode path guards symmetrically: `BigIntNumber` rejects non-integral or out-of-safe-range writes; `UnboundedInt` encodes `bigint → numeric` decimal text.

**The JSON-number canonical form is sound.** ECMAScript mandates IEEE 754 binary64, `MAX_SAFE_INTEGER` is exactly 2^53 − 1, and double rounding is monotone with 2^53 exactly representable — so no true value outside ±(2^53 − 1) can parse into the safe range and slip past the post-parse guard. `decodeJson` checks the range after `JSON.parse`; the guard cannot false-pass. This is the one deliberate exception to "64-bit integers travel as decimal text", and it is the codec's purpose. `UnboundedInt` keeps decimal-text projection (`decimalTextJsonProjection`) like `numeric` and `int8`.

**Preset-only, no target-type claim.** `PgInt8Descriptor` claims `targetTypes: ['int8']` and the numeric codec claims `numeric`; the new descriptors claim no target-type name, so type-position constructors and introspection stay unambiguous. Selection is by preset: `bigIntNumber` joins `postgresAuthoringFieldPresets` (`packages/3-targets/3-targets/postgres/src/core/authoring.ts:664`) and the SQLite table; `unboundedInt` is PostgreSQL-only (SQLite has no lossless unbounded integer storage — availability is the target's declaration). PSL type names: `BigIntNumber`, `UnboundedInt`. Introspection keeps inferring `int8 → BigInt` and `numeric → Decimal`; the presets are reached by editing the PSL, acceptable for opt-in types.

### Aggregate descriptor rows

Columns typed with the new codecs must aggregate, so both targets' matrices (`packages/3-targets/3-targets/{postgres,sqlite}/src/core/aggregates.ts`) gain exact-input rows, database-probed like the rest: PostgreSQL `sum`/`avg` over `int8number` → `pg/numeric@1` (storage-determined widening); `sum` over `unboundedint` → `pg/unboundedint@1`, `avg` → `pg/numeric@1`; SQLite `sum` over `bigintnumber` → `sqlite/bigint@1` with the existing cast-to-text lowering, `avg` per probe. `min`/`max` need no rows — amended 2026-08-05 during D1, when execution surfaced that the existing `preservesInput`-over-trait-`numeric` fallback already resolves them to `self` for any codec carrying the trait; the codecs' registration alone radiates those rows into emitted contracts. This slice changes no existing row and no operation vocabulary.

### Errors

Out-of-range and non-integral decodes raise structured errors with dotted namespace codes (ADR 239), following the malformed-bigint-wire error shape from slice 05. The code lands in `docs/reference/error-reference.md`.

## Coherence rationale

One concern — the integer representation vocabulary — delivered whole: three codecs sharing one guard rationale and one canonical-JSON argument, their presets, their aggregate rows, and their conformance evidence. Splitting codecs from presets would merge unusable halves; splitting `UnboundedInt` out would force slice 08 to define an aggregate-output codec inline, which is this slice's subject.

## Scope

**In:** the three codec class/descriptor pairs; `bigIntNumber` and `unboundedInt` presets in both targets' authoring contributions (PostgreSQL) and the applicable one (SQLite); exact-input aggregate descriptor rows for the new codecs; conformance testkit cases on both targets including safe-range boundary values; a PSL fixture exercising both presets; error-reference entry; codec authoring guide and PSL type documentation updates.

**Out:** any change to `BigInt`'s default codec or to any aggregate operation's output (slices 07/08); target-type or introspection claims for the new codecs; Mongo; a Decimal application type (`numeric` keeps decoding to string); `UnboundedInt` on SQLite.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| A value outside ±(2^53 − 1) surviving `JSON.parse` and passing the range guard | Impossible; monotone rounding with 2^53 exactly representable — pinned by boundary tests at 2^53 − 1, 2^53, −(2^53) | The discussion's soundness argument; the reason JSON-number canonical form is safe here and nowhere else |
| SQLite driver hands INTEGER wire as `number` or `bigint` depending on safe-integer mode | `bigintnumber` decode accepts both wire shapes and applies the same guard | Same driver split slice 05 handled for `sqlite/bigint@1` |
| `UnboundedInt` claiming the `numeric` target-type name | Must not — preset-only | Would collide with the Decimal codec in type position |
| Non-integral write to `BigIntNumber` (e.g. `1.5`) | Structured encode error, same code family as the decode guard | Write path is new; the aggregate-only design had no encode |

## Slice-specific done conditions

- [ ] Conformance suites cover all three codecs on their targets, including JSON round-trips at the safe-range boundary and an `UnboundedInt` value past 2^63.
- [ ] A committed PSL fixture uses both presets and `pnpm fixtures:check` passes.

## Open Questions

1. **Codec ID spelling.** Working position: `pg/int8number@1`, `sqlite/bigintnumber@1`, `pg/unboundedint@1`.
2. **Error code.** Working position: a `RUNTIME.*` code shared by the range and integrality guards, distinguished by `meta`, following the slice-05 malformed-wire precedent.

## Contract impact

New codec IDs appear in `codecTypes` only for contracts that use the presets; no existing entry changes. Amended 2026-08-05 during D1: registering the codecs expands the `min`/`max` numeric-trait fallback over them at emission, so **every** emitted PostgreSQL contract gains two inert `byCodec` self rows regardless of preset use — a purely additive re-emission (verified zero deletions), committed with D1. Fixture movement in later dispatches must be fully attributable to the new rows and fixtures, not byte-identity.

## Adapter impact

PostgreSQL and SQLite targets and their codec testkits. Adapters gain no rendering changes; the new rows reuse existing lowering machinery.

## ADR pointer

No architectural shift — new codecs through the established descriptor pattern. The codec authoring guide and aggregate descriptor guide absorb the documentation.

## References

- Parent project: [`projects/codec-json-projections/spec.md`](../../spec.md) (scope extension of 2026-08-04)
- Settled design: [`projects/codec-json-projections/design-notes.md`](../../design-notes.md) § Integer representation and the aggregate operation split
- Linear issue: [TML-3163](https://linear.app/prisma-company/issue/TML-3163/opt-in-number-representation-integer-codecs-bigintnumber-unboundedint)
- Codec authoring: [`docs/reference/codec-authoring-guide.md`](../../../../docs/reference/codec-authoring-guide.md); descriptors: [`docs/reference/aggregate-descriptor-guide.md`](../../../../docs/reference/aggregate-descriptor-guide.md)
- Classic Prisma prior art: `BigInt` columns are `bigint`, `count()` is `number` ([Fields & types](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types))
