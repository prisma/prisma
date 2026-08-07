# Slice: 08-native-number-aggregate-defaults

_(Parent project `projects/codec-json-projections/`. Outcome this slice contributes: the DX/correctness conflict the aggregate hard cut created is resolved by policy — bare aggregate operations favour JS-native `number` and throw rather than silently lose precision; suffixed variants are lossless.)_

## At a glance

Splits the aggregate vocabulary: `count()`/`sum()`/`avg()` return JS-native values (`number`, throwing past the safe-integer range where loss is possible), while `countBigInt()`/`sumBigInt()`/`avgDecimal()` keep the lossless results the hard cut introduced. Breaking for `count()`/`sum()`/`avg()` result types; carries upgrade instructions. Depends on slice 06 (the output codecs) and slice 07 (the contribution mechanism that lets targets add the new operations without client changes).

## Chosen design

Settled in [`design-notes.md` § Integer representation and the aggregate operation split (2026-08-04)](../../design-notes.md).

**Policy.** Bare operations answer in the type a JS developer expects: `number` — throwing (via the slice-06 codec guards) instead of returning a corrupted value. Suffixed variants answer losslessly. Bare operations over Float and Decimal *columns* stay in the column's own family — those users already chose their representation. `min`/`max` output `self` and are untouched. Classic Prisma is the prior art: `BigInt` columns are `bigint`, yet `count` is `number` and integer `_avg` is a float — but where classic Prisma casts down in the engine (failing past 2^31), the defaults here throw at the safe-integer boundary with a structured error.

### The descriptor matrix

PostgreSQL (rows change only where shown; working codec IDs from slice 06):

| Operation | Input | Output codec | Application value |
| --- | --- | --- | --- |
| `count` | none / any | `pg/int8number@1` | `number`, throws past 2^53 |
| `countBigInt` | none / any | `pg/int8@1` | `bigint` |
| `sum` | `int2`/`int4`/`int8`/`int8number` | `pg/int8number@1` | `number`, throwing |
| `sum` | `float4`, `float8`, `numeric`, `unboundedint`, `interval` | unchanged (in-family) | unchanged |
| `sumBigInt` | `int2`/`int4` | `pg/int8@1` | `bigint` |
| `sumBigInt` | `int8`/`int8number` | `pg/unboundedint@1` | `bigint`, exact at any magnitude |
| `avg` | integer inputs | `pg/float8@1`, lowering casts the result | `number` |
| `avg` | `float4`/`float8`/`numeric`/`interval` | unchanged (in-family) | unchanged |
| `avgDecimal` | integer and `numeric` inputs | `pg/numeric@1` | decimal string |

**`sumBigInt` over `int8` is load-bearing design, not implementation detail:** the database computes `numeric`, and the `pg/unboundedint@1` output row makes the integrality-checked decode to an unbounded `bigint` a contract fact. Lowering it as an `int8` cast instead would reintroduce a 64-bit overflow error this design deliberately does not have — and would resurrect the need for the rejected `sumDecimal`. The `avg` lowering casts the **result** (`avg(x)::float8`), not the input: the exact numeric mean is computed first and rounded once.

SQLite: `count` → `sqlite/bigintnumber@1` (`number`, throwing); `countBigInt` → `sqlite/bigint@1`; `sum` over integers → `sqlite/bigintnumber@1`; `sumBigInt` → `sqlite/bigint@1`, where SQLite's own `SUM` raises on 64-bit overflow — the target's declared bound, per availability-is-the-target's-declaration. `avg` is natively REAL → `number`, unchanged. `avgDecimal` and `unboundedint` are **not contributed** (no decimal / unbounded storage); the operations are simply absent from SQLite contracts.

Number-flavoured SQLite outputs keep the existing cast-to-text lowering so `node:sqlite`'s unsafe-integer raise never fires and the structured range error is the codec's own.

### What follows automatically

Top-level aggregates, grouped `.aggregate()`, and include reducers all read the same contributed namespace (slice 07), so `posts.count()` in an include returns `number` with no further wiring — and include-count JSON entries become JSON numbers again, safely (slice 06's canonical-form argument).

Amended 2026-08-07, after slices 06 and 07 shipped:

- **The empty-input result needs no edit.** Slice 07 replaced `emptyAggregateResult(fn)`'s name check with `emptyAggregateResult(nullable, codec)`, so `count`'s zero decodes through whatever codec the row declares — changing `count`'s output codec turns `0n` into `0` on its own.
- **The suffixed variants reach every surface for free** (open question 1, resolved): slice 07 derives the ORM and lane surfaces from `aggregateTypes`, so contributing an operation is the whole of the work.
- **This slice rewrites rows slice 06 authored.** Slice 06 declared `sum`/`avg` over `int8number` as `pg/numeric@1` — storage-determined, and correct under the policy of its day. Under the defaults policy they become `pg/int8number@1` and `pg/float8@1`. Rewriting a sibling slice's rows is expected here, not scope creep.
- **A `sum` past 2^53 throws rather than corrupts, including through JSON.** PostgreSQL computes `sum(int8)` as `numeric`; declaring the output `pg/int8number@1` means the include path emits it as a JSON number, and a total beyond the safe range parses to a value the codec's post-parse guard rejects. That is the designed behaviour — monotone rounding makes the guard un-foolable — and it must be pinned on the include path, not only the wire path.

### The breaking baseline

| Surface | Hard cut (slices 4–5) | This slice |
| --- | --- | --- |
| `count()` | `bigint` | `number`, throwing |
| `sum()` over `Int` | `bigint` | `number`, throwing |
| `sum()` over `BigInt` | decimal string | `number`, throwing |
| `avg()` over integers | decimal string | `number` |
| lossless forms | (the defaults) | `countBigInt()` / `sumBigInt()` / `avgDecimal()` |

Upgrade instructions (per `record-upgrade-instructions`) cover both hops for users landing from pre-project releases. The prisma-7-ports suites that slice 05 flipped to `bigint`/decimal-string expectations flip back to `number` for count and integer sums.

## Coherence rationale

One behavioural flip of the default vocabulary together with its escape hatches, atomic across descriptor matrices, emitted `aggregateTypes`, decoding, tests, and upgrade docs. Shipping defaults without variants would strand precision-sensitive users mid-stack; shipping variants first would ship names whose semantics the defaults flip a week later.

## Scope

**In:** new operation contributions (`countBigInt`, `sumBigInt`, `avgDecimal`) and changed default rows in both targets' matrices; the `avg` result-cast lowering; empty-input result change; regenerated contracts/fixtures; database-backed matrix updates in the conformance suites; renegotiated test baselines; error-reference and aggregate-descriptor-guide updates; upgrade instructions.

**Out:** `sumDecimal` (rejected — no non-redundant domain); any further operations (`median`, `string_agg`, …); codec changes (slice 06 owns them); Mongo; client/builder code changes (slice 07 makes them unnecessary — this slice is target contributions, fixtures, tests, and docs).

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| `sum()` overflow is realistic where `count()` overflow is not | Integration tests exercise the `sum()` throw at the boundary and `sumBigInt` exactness past 2^63 on PostgreSQL | Summing int8 IDs or cent amounts crosses 2^53 in practice |
| SQLite driver raises on unsafe INTEGER before the codec sees it | Cast-to-text lowering retained for number-flavoured outputs | The error must be the codec's structured one, not the driver's |
| `avg` input-cast vs result-cast | Result cast — exact mean, one rounding | Input cast changes accumulation semantics |
| Empty-set results | `count` → `0` (`number` now), `sum`/`avg` → `null` | Nullability stays descriptor-declared |

## Slice-specific done conditions

- [ ] Upgrade instructions recorded covering the default flips, the new variants, and contract regeneration.
- [ ] Database-backed matrices pin the new rows on both targets, including the `sum()` boundary throw and `sumBigInt` past 2^63.
- [ ] `avgDecimal`/`unboundedint` absence on SQLite is asserted as unavailability, not as a runtime error.

## Open Questions

1. **Do the suffixed variants appear in the sql-builder lane's function surface too, or ORM-only at first?** Working position: they flow through the same derived surface (slice 07), so both — no per-surface opt-out.

## Contract impact

`aggregateTypes` rows change for `count`/`sum`/`avg` and gain three operations; contracts and fixtures regenerate. Downstream consumers see result-type changes on the three bare operations.

## Adapter impact

PostgreSQL and SQLite descriptor matrices and lowerings; conformance matrices extended. Renderers unchanged.

## ADR pointer

The defaults policy (native-number defaults, lossless suffixed variants, in-family bare operations over Float/Decimal) is recorded in the ADR 020 extension authored in slice 07.

## References

- Parent project: [`projects/codec-json-projections/spec.md`](../../spec.md) (scope extension of 2026-08-04)
- Settled design: [`projects/codec-json-projections/design-notes.md`](../../design-notes.md) § Integer representation and the aggregate operation split
- Linear issue: [TML-3165](https://linear.app/prisma-company/issue/TML-3165/native-number-aggregate-defaults-countcountbigint-sumsumbigint)
- Depends on: [slice 06 spec](../06-integer-representation-codecs/spec.md), [slice 07 spec](../07-contributed-aggregate-operations/spec.md)
- Classic Prisma prior art: [Fields & types](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types); count-as-BigInt complaints in [prisma/prisma#14863](https://github.com/prisma/prisma/discussions/14863)
