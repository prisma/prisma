# Dispatch plan — 08-native-number-aggregate-defaults

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3165](https://linear.app/prisma-company/issue/TML-3165/native-number-aggregate-defaults-countcountbigint-sumsumbigint)
**Branch:** `tml-3165-native-number-aggregate-defaults`, stacked on `tml-3164-contributed-aggregate-operations` (slice 07, [PR #29922](https://github.com/prisma/prisma/pull/29922), green and awaiting review). Slice 06 merged as `1de0f278dc`. The PR targets the slice-07 branch until it merges, then advances to `main`.

## Validation gate

Every dispatch runs this gate; the filter is derived from the diff at each run plus the standing floor.

```bash
pnpm build
pnpm typecheck:all
pnpm lint:deps
pnpm lint --filter <touched packages>
pnpm test --filter <touched> --filter integration-tests    # integration in 4 shards
pnpm fixtures:check
pnpm check:upgrade-coverage
pnpm check:error-reference
node scripts/lint-casts.mjs                                 # must not go positive
```

Standing floor: both targets, both adapters, both codec testkits, `@internal/sql-orm-client`, the sql-builder lane, `integration-tests`. **Unlike slices 06 and 07, fixture movement is expected here** — this slice changes emitted `aggregateTypes` rows by design. Every moved byte must be attributable to a declared row change; nothing else may move.

Host notes (inherited): run integration as 4 shards; `issues-28192-pg-historical-dates` (host timezone) and `cli-journeys/init-journey.e2e` (host pnpm) are baselined environmental reds — confirm signature only; contention timeouts pass in isolation; if `fixtures:check` reports `prisma-next: command not found`, run `pnpm install` after `pnpm build`. Classify any other red against the stack base after a fresh build ([F24](../../../../drive/calibration/failure-modes.md#f24-stale-dist-makes-a-red-gate-look-like-a-broken-base), [F25](../../../../drive/calibration/failure-modes.md#f25-pre-existing-failure-claim-accepted-without-running-the-suspect-file-on-pristine-main)).

## Calibration references

- [F1](../../../../drive/calibration/failure-modes.md#f1-dual-shape-support-relocated-under-a-new-name) — no `Number()` bridge may reappear anywhere in the decode path; the guard throws, it never coerces.
- [F13](../../../../drive/calibration/failure-modes.md#f13-regression-test-for-a-boundary--scoping-property-doesnt-discriminate) — boundary tests must discriminate: exercise 2^53 − 1 (passes) and 2^53 (throws), and `sumBigInt` past 2^63 (exact). A test inside the safe range proves nothing.
- [F12](../../../../drive/calibration/failure-modes.md#f12-correct-the-docs-executed-as-a-spot-fix-instead-of-an-exhaustive-sweep) — the docs sweep for `bigint`-aggregate claims is a sweep, not a spot-fix; slices 05 and 06 both wrote such claims.
- [F3](../../../../drive/calibration/failure-modes.md#f3-discovery-via-test-suite-instead-of-grep) — enumerate the moved expectations by grep over the assertion literals, not by what happens to go red.

## Shape

One target's matrix carries the judgment (D1), the other fans it out (D2), the breaking baseline is renegotiated in one sweep (D3), and the record closes it (D4). No client or lane code changes are expected in any dispatch — slice 07 made the surfaces derive — so a dispatch finding itself editing `sql-orm-client/src` or `sql-builder/src` should stop and ask why.

### Dispatch 1: The PostgreSQL defaults matrix

- **Outcome:** PostgreSQL's matrix (`packages/3-targets/3-targets/postgres/src/core/aggregates.ts`) expresses the defaults policy, every row database-probed before it is authored: `count` → `pg/int8number@1`; new `countBigInt` (input-agnostic, mirroring `count`) → `pg/int8@1`; `sum` over `int2`/`int4`/`int8`/`int8number` → `pg/int8number@1`; new `sumBigInt` over `int2`/`int4` → `pg/int8@1` and over `int8`/`int8number` → `pg/unboundedint@1`; `avg` over every integer input → `pg/float8@1` through a **result-cast** lowering (`avg(x)::float8`, not an input cast); new `avgDecimal` over integer and `numeric` inputs → `pg/numeric@1`. Float, `numeric`, `interval`, and `time` rows keep their in-family results; `min`/`max` are untouched. Database-backed conformance cases pin each new row, including the `sum` boundary throw at 2^53 and `sumBigInt` exactness past 2^63.
- **Builds on:** slice 06's codecs and slice 07's contribution mechanism, both merged or in the stack; the spec's settled policy.
- **Hands to:** the authored policy — the rows D2 mirrors and D3 renegotiates expectations against.
- **Focus:** one target's matrix and its evidence. It does not touch SQLite, fixtures, or any consumer test outside the conformance suite. Two design facts are load-bearing and must be pinned rather than assumed: `sumBigInt` over `int8` decodes PostgreSQL's `numeric` through `pg/unboundedint@1` (never an `int8` cast — that would reintroduce the overflow this design does not have), and the `avg` cast applies to the result so the exact mean is rounded once.

### Dispatch 2: The SQLite defaults matrix

- **Outcome:** SQLite's matrix expresses the same policy in its own terms, probed likewise: `count` → `sqlite/bigintnumber@1`; `countBigInt` → `sqlite/bigint@1`; `sum` over integer inputs → `sqlite/bigintnumber@1`; `sumBigInt` → `sqlite/bigint@1`, bounded by SQLite's own `SUM` overflow raise; `avg` stays native REAL → `number`. `avgDecimal` is **not contributed** — SQLite has no decimal — and its absence is asserted as unavailability rather than a runtime error. Number-flavoured outputs keep the cast-to-text lowering so the structured range error is the codec's own and never `node:sqlite`'s raise.
- **Builds on:** D1's authored policy; slice 06's `sqlite/bigintnumber@1` and its existing lowering.
- **Hands to:** both matrices complete — the state the fixture and expectation sweep runs against.
- **Focus:** one target's matrix, whole. A case where SQLite cannot express the settled policy is a halt (falsified assumption), not an inline redesign.

### Dispatch 3: The breaking baseline

- **Outcome:** every consumer of the changed results agrees with the new policy in one sweep: contracts and fixtures regenerate with `pnpm fixtures:check` green and every moved byte attributable to a declared row change; the moved expectations across sql-orm-client unit tests, the integration aggregate suites, and the prisma-7 ports suites (`legacy-aggregations`, `methods-count`, `issues-20261-group-by-shortcut`, `issues-11974` and whatever the grep finds beside them) are updated in place, each classified in the dispatch report as *mechanical form change* or *corrected defect*; and the new behaviour is pinned end to end — `count()` returns `0`/`number` including from the empty-input path, a `sum` past 2^53 throws on both the wire path and the include/JSON path, `sumBigInt` returns an exact `bigint` past 2^63, `avg()` returns a `number`, and `avgDecimal()` a decimal string.
- **Builds on:** D1 and D2's complete matrices.
- **Hands to:** a coherent tree — the state the record documents.
- **Focus:** the sweep and its evidence. Enumerate the sites by grep over assertion literals ([F3](../../../../drive/calibration/failure-modes.md#f3-discovery-via-test-suite-instead-of-grep)), not by what goes red. Any expectation that cannot be classified as mechanical-or-corrected is a finding worth reporting, not a quiet edit.

### Dispatch 4: The record

- **Outcome:** upgrade instructions (per `record-upgrade-instructions`) cover the default flips, the three new operations, and contract regeneration, in both the extension-author and app-facing clusters, enumerated from the matrices rather than the diff; the docs sweep corrects every claim that aggregates return `bigint`/decimal strings ([F12](../../../../drive/calibration/failure-modes.md#f12-correct-the-docs-executed-as-a-spot-fix-instead-of-an-exhaustive-sweep) — slices 05 and 06 both wrote such claims, and the shipped query guide tabulates the old result types); the aggregate descriptor guide and ADR 020 record the defaults policy and the two lossless escape hatches; the error reference covers the guard failures reachable through aggregates; the full slice-scope gate passes.
- **Builds on:** everything prior.
- **Hands to:** slice close — reviewer verdict, then the stacked PR.
- **Focus:** the record and the final gate. No behaviour changes.

## Open items

- Spec open question 1 is resolved (slice 07's derivation carries the variants to every surface); no open questions remain at pickup.
- `avg` over `unboundedint`: the policy makes bare `avg` a `number` for every integer input, `unboundedint` included, with `avgDecimal` as that column's exact escape hatch. D1 should state this explicitly in its report rather than leave it inferred.
- The stack: if slice 07 merges mid-slice, retarget the PR to `main` and rebase; the two touch disjoint surfaces apart from the descriptor matrices this slice rewrites.

## Hand-off linearity

Strictly linear: D2 mirrors D1's policy, D3 needs both matrices, D4 needs the settled tree. The one non-obvious edge is that D3 reads D1/D2's *rows* directly (not merely their conformance tests) to enumerate what must move.

## Completeness against slice-DoD

Upgrade instructions — D4. Database-backed matrices pinning the new rows, including the `sum()` boundary throw and `sumBigInt` past 2^63 — D1 (PostgreSQL) and D2 (SQLite). `avgDecimal`/`unboundedint` absence on SQLite asserted as unavailability — D2.
