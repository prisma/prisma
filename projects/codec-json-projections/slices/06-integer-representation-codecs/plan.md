# Dispatch plan — 06-integer-representation-codecs

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3163](https://linear.app/prisma-company/issue/TML-3163/opt-in-number-representation-integer-codecs-bigintnumber-unboundedint)
**Branch:** `tml-3163-integer-representation-codecs`, based on `main` (slice 5 merged as prisma/prisma#29867; the planning commit for slices 6–8 is the branch's first commit).

## Validation gate

Every dispatch runs this gate. The test filter is derived from the diff at each run — `git diff --name-only main...HEAD` mapped to owning packages — plus the standing floor below.

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched packages>
pnpm test --filter <every package the diff touches> --filter @internal/integration-tests
pnpm fixtures:check
pnpm check:upgrade-coverage
```

Standing floor regardless of diff: both target packages (`3-targets/3-targets/{postgres,sqlite}`), both adapters, both codec testkits' consuming suites, `@internal/integration-tests`. `pnpm lint` is a separate CI job — run it, not just typecheck ([F14](../../../../drive/calibration/failure-modes.md#f14-dispatch-reports-validation-green-but-ci-is-red-dispatch-gates-didnt-mirror-ci)). Failures classified individually against pristine main before "pre-existing" is accepted ([F25](../../../../drive/calibration/failure-modes.md#f25-pre-existing-failure-claim-accepted-without-running-the-suspect-file-on-pristine-main)); fresh `pnpm build` before judging any red ([F24](../../../../drive/calibration/failure-modes.md#f24-stale-dist-makes-a-red-gate-look-like-a-broken-base)).

## Calibration references (slice-DoR plan-side items)

- Failure modes threaded into briefs where named per dispatch: [F13](../../../../drive/calibration/failure-modes.md#f13-regression-test-for-a-boundary--scoping-property-doesnt-discriminate) (boundary tests must discriminate — the safe-range guard tests must use 2^53 − 1 / 2^53 / −(2^53) exactly, and an `UnboundedInt` value past 2^63; a test inside the safe range proves nothing), [F3](../../../../drive/calibration/failure-modes.md#f3-discovery-via-test-suite-instead-of-grep) (enumerate preset/codec registration sites by grep on the sibling codec, not by what tests break), [F1](../../../../drive/calibration/failure-modes.md#f1-dual-shape-support-relocated-under-a-new-name) (no silent `Number()` bridge inside the new decodes — the guard throws, it does not coerce).
- Grep library: [test-literal hygiene](../../../../drive/calibration/grep-library.md#test-literal-hygiene) for the new codec-ID literals in tests.

## Shape

Design judgment first on PostgreSQL (guard semantics, error codes, the JSON-number projection), then the settled design fanned to SQLite, then the aggregate rows both codecs need to be usable under aggregation, then the end-to-end authoring/emission proof, then the record. The judgment lives in D1; D2 is a fan-out against settled decisions; D3 is probe-and-pin per the slice-5 pattern; D4–D5 are proof and record.

### Dispatch 1: PostgreSQL codecs, descriptors, and presets

- **Outcome:** `pg/int8number@1` and `pg/unboundedint@1` exist as codec class + `PostgresCodecDescriptor` pairs beside their siblings in `packages/3-targets/3-targets/postgres/src/core/codecs.ts`, with codec-ID constants in `codec-ids.ts`: `int8number` stores `int8`, decodes wire and JSON to `number` throwing a structured error (ADR 239 dotted code, following the slice-5 malformed-bigint-wire precedent) outside ±(2^53 − 1) or on non-integral input, encodes with the symmetric guard, and projects a database-side JSON **number**; `unboundedint` stores unconstrained `numeric`, decodes to `bigint` rejecting non-integral values, and projects decimal text (`decimalTextJsonProjection`). Neither descriptor claims a `targetTypes` name (unit-tested). `bigIntNumber` and `unboundedInt` field presets join `postgresAuthoringFieldPresets` (`authoring.ts`). Package unit tests cover both codecs (boundary values per F13) and the presets; PostgreSQL codec-testkit conformance cases prove DB round-trips including the safe-range boundary and an `UnboundedInt` value past 2^63. Codec-ID spellings and the error code are settled here (spec open questions 1–2) and recorded in the dispatch report.
- **Builds on:** The spec's chosen design; the settled reasoning in [`design-notes.md` § Integer representation and the aggregate operation split](../../design-notes.md); `PgInt8Codec`/`PgInt8Descriptor` and `PgNumericCodec` as structural templates.
- **Hands to:** The settled design decisions (IDs, error code, guard semantics, projection approach) that D2 fans out to SQLite, and the codec IDs D3's descriptor rows name.
- **Focus:** PostgreSQL target package + its testkit cases only. No SQLite, no aggregate rows, no fixtures. Tests before implementation per repo rule; the JSON-number projection's soundness rationale (monotone rounding) belongs in the spec/docs, not restated as a code comment.

### Dispatch 2: SQLite codec and preset

- **Outcome:** `sqlite/bigintnumber@1` exists in `packages/3-targets/3-targets/sqlite/src/core/codecs.ts` with the D1-settled guard semantics and error code family: INTEGER storage, wire accepted as `number` or `bigint` (driver safe-integer-mode split per the slice-5 edge-case table), decode/encode guards at ±(2^53 − 1), canonical JSON number. The `bigIntNumber` preset joins SQLite's authoring presets; no `targetTypes` claim (unit-tested). Package unit tests (boundary per F13) and SQLite codec-testkit conformance cases pass. `unboundedInt` is deliberately absent — a test or the conformance suite asserts the preset does not exist on SQLite.
- **Builds on:** D1's settled design decisions; `sqlite/bigint@1` as the structural template, including its existing cast-to-text aggregate lowering context.
- **Hands to:** Both targets' codec sets complete — everything D3's rows and D4's fixtures reference.
- **Focus:** SQLite target package + its testkit cases only. Fan-out of settled decisions; a case where SQLite genuinely cannot express the settled semantics is a halt (falsified assumption), not an inline redesign.

### Dispatch 3: Aggregate descriptor rows for the new input codecs

- **Outcome:** Columns typed with the new codecs aggregate correctly on both targets: exact-input `SqlAggregateDescriptor` rows are probed against live databases and pinned — PostgreSQL `sum`/`avg` over `int8number` → `pg/numeric@1`; `sum` over `unboundedint` → `pg/unboundedint@1`, `avg` → `pg/numeric@1`; SQLite `sum` over `bigintnumber` → `sqlite/bigint@1` (existing cast-to-text lowering), `avg` per probe — authored in both targets' `aggregates.ts` and pinned by database-backed conformance tests extending the slice-5 aggregate matrices. `min`/`max` rows are deliberately absent (amended 2026-08-05 from D1's finding: the numeric-trait `preservesInput` fallback already resolves them to `self`; adding exact rows would be redundant or shadow-only). The deliberate red D1/D2 leave — the testkits' aggregate-conformance coverage gates naming the new codecs — flips green here. No existing row changes; no operation vocabulary changes.
- **Builds on:** D1 + D2's codecs; the slice-5 probe-and-pin pattern and the existing matrices in `packages/3-targets/3-targets/{postgres,sqlite}/src/core/aggregates.ts`.
- **Hands to:** Aggregation-complete codecs — the state D4's integration proof exercises.
- **Focus:** Descriptor rows and their evidence only. Probe scripts don't ship; descriptors and conformance tests do.

### Dispatch 4: End-to-end authoring, emission, and fixture proof

- **Outcome:** A committed PSL fixture uses both presets; the emitted contract carries the new codec IDs in `codecTypes` (and `aggregateTypes.byCodec` rows from D3) and `pnpm fixtures:check` passes with every movement attributable to the new fixture; type-level tests pin that a `BigIntNumber` column reads as `number` and an `UnboundedInt` column as `bigint` through the ORM result surface; an integration test round-trips both column types on PostgreSQL (and `BigIntNumber` on SQLite) asserting the whole row shape with explicit `select`, including an include-path read that traverses the JSON-number projection; all fixture movement is attributable to the new fixture and the D1/D2 trait-fallback re-emissions (amended 2026-08-05: D1 falsified "existing fixtures byte-identical" — registration alone radiates `min`/`max` self rows into every emitted contract).
- **Builds on:** D1–D3 complete; `typed-contract-in-tests` and `sql-orm-client-whole-shape-assertions` rules.
- **Hands to:** The slice's headline behaviour proven end to end — what the reviewer exercises.
- **Focus:** Fixture, emission, and integration proof. No new runtime code expected; a gap this dispatch uncovers in D1–D3 goes back as a finding, not an inline patch beyond the mechanical.

### Dispatch 5: The record

- **Outcome:** `docs/reference/error-reference.md` documents the new error code(s); the codec authoring guide gains the number-representation presets (including the canonical-JSON exception and its soundness argument, stated once); PSL-facing docs list `BigIntNumber` and `UnboundedInt` with their contracts (throws-past-safe-range; Postgres-only respectively); the aggregate descriptor guide's examples remain accurate against D3's rows; `pnpm check:upgrade-coverage` is green (non-breaking slice — verify, don't assume, per the slice-5 D2 lesson that path-based gates fire on touched paths); the full validation gate passes at slice scope.
- **Builds on:** Everything prior.
- **Hands to:** Slice close — reviewer verdict, PR against `main` (title carries TML-3163), then slice 07/08 pickup.
- **Focus:** Documentation sweep ([F12](../../../../drive/calibration/failure-modes.md#f12-correct-the-docs-executed-as-a-spot-fix-instead-of-an-exhaustive-sweep) — sweep, not spot-fix) and the final gate. No code changes beyond doc-adjacent.

## Open items

- Spec open questions land as follows: Q1 (codec-ID spellings) → D1 grounding; Q2 (error code) → D1. Both recorded in the dispatch report and reflected back into the spec if they diverge from the working positions.
- Model tier per `drive/calibration/model-tier.md` at brief-assembly time: D1 carries the judgment; D2/D3 are fan-out/probe-shaped; D4/D5 are proof/record-shaped.
- Slice 07 (TML-3164) is parallel to this slice per the project plan and does not consume any of these dispatches' hand-offs; it branches from the same planning commit.

## Hand-off linearity

Strictly linear: D2 builds on D1's settled decisions, D3 on both codec sets, D4 on D1–D3, D5 on everything. The one non-obvious edge: D4's type-level expectations read D1/D2's codec `output` types directly (not D3's rows), so its brief needs the codec-type hand-off, not just the aggregate-row hand-off.

## Completeness against slice-DoD

Conformance coverage of all three codecs incl. boundary and past-2^63 values — D1 (PostgreSQL, both codecs) + D2 (SQLite). PSL fixture + `fixtures:check` — D4. Error-reference and guide updates — D5. The spec's "no `targetTypes` claim" and "no existing row changes" invariants — unit-tested in D1/D2 and asserted by D3's no-change gate respectively.
