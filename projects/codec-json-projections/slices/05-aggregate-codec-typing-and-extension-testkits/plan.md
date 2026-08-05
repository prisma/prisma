# Dispatch plan — 05-aggregate-codec-typing-and-extension-testkits

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3064](https://linear.app/prisma-company/issue/TML-3064/aggregate-codec-typing-and-extension-testkits)
**Branch:** `tml-3064-aggregate-codec-typing-and-extension-testkits`, based on `main` (the stack is fully merged; the hard cut landed as prisma/prisma#29844).

## Validation gate

Every dispatch runs this gate. The test filter is derived from the diff at each run — `git diff --name-only main...HEAD` mapped to owning packages — plus the standing floor below; the slice-3 lesson stands: a filter written before the work exists misses the package the work lands in.

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched packages>
pnpm test --filter <every package the diff touches> --filter @internal/integration-tests
pnpm fixtures:check
pnpm check:upgrade-coverage
```

Standing floor regardless of diff: `@internal/integration-tests` (owns the aggregate value assertions and the ports suites), `@internal/sql-orm-client`, the sql-builder lane package, both adapters, both targets. Dispatches that add workspace packages (D1) also run `pnpm install` and verify the lockfile moves only for the new packages (never edit `pnpm-lock.yaml` by hand). `pnpm lint` is a separate CI job — run it, not just typecheck ([F14](../../../../drive/calibration/failure-modes.md#f14-dispatch-reports-validation-green-but-ci-is-red-dispatch-gates-didnt-mirror-ci)); packages whose `typecheck` is src-only also compile their test tsconfig. Failures classified individually against pristine main before "pre-existing" is accepted ([F25](../../../../drive/calibration/failure-modes.md#f25-pre-existing-failure-claim-accepted-without-running-the-suspect-file-on-pristine-main)).

## Calibration references (slice-DoR plan-side items)

- Failure modes threaded into briefs where named per dispatch: [F1](../../../../drive/calibration/failure-modes.md#f1-dual-shape-support-relocated-under-a-new-name) (the deleted `Number()`-coercion must not survive relocated under a new name), [F3](../../../../drive/calibration/failure-modes.md#f3-discovery-via-test-suite-instead-of-grep) (enumerate consumers by grep, not by what tests break), [F12](../../../../drive/calibration/failure-modes.md#f12-correct-the-docs-executed-as-a-spot-fix-instead-of-an-exhaustive-sweep) (docs sweep for `number`-aggregate claims), [F13](../../../../drive/calibration/failure-modes.md#f13-regression-test-for-a-boundary--scoping-property-doesnt-discriminate) (bigint assertions must discriminate — `toEqual(2)` vs `2n` does, `Number(x)` bridges don't), [F16](../../../../drive/calibration/failure-modes.md#f16-self-acknowledged-layering-violation-shipped-through-review) (testkit dependency direction is a layering claim; `pnpm lint:deps` is its gate), [F24](../../../../drive/calibration/failure-modes.md#f24-stale-dist-makes-a-red-gate-look-like-a-broken-base) (two new packages mean fresh `pnpm build` before judging any red).
- Grep library: retired-literal greps per dispatch below (`'pg/int8@1'` outside targets, `normalizeAggregateResult|coerceAggregateValue`, `6-adapters/.*/test/codec-conformance` cross-package imports), plus the [test-literal hygiene](../../../../drive/calibration/grep-library.md#test-literal-hygiene) and [docs claim-scrub](../../../../drive/calibration/grep-library.md#docs-claim-scrub-f12) sections.

## Shape

Packaging first (the testkits are the home the aggregate matrices extend), then the descriptor protocol, then one database-verified matrix per target, then emitted types, then the two consumer cuts (ORM, sql-builder lane), then the breaking-change record. The judgment lives in D2–D5; D1 is extraction, D6–D7 are cuts against settled matrices, D8 is documentation against settled decisions.

### Dispatch 1: Conformance testkit packages

- **Outcome:** `@internal/postgres-codec-testkit` and `@internal/sqlite-codec-testkit` exist as published, dev-only, test-framework-independent workspace packages carrying the harness + case vocabulary currently in `packages/3-targets/6-adapters/{postgres,sqlite}/test/codec-conformance/`; the adapters export the narrow internals the harness needs (`renderLoweredSql`, the contract types) through named subpaths; built-in adapter suites, pgvector, and arktype-json consume the packages; `grep -rn "6-adapters/.*/test/codec-conformance" packages/` finds no cross-package relative import; the SQLite case type gains the `descriptor?` escape hatch the PostgreSQL one has; `pnpm lint:deps` proves no production dependency on either testkit.
- **Builds on:** The spec's chosen design; publishing metadata per `@internal/target-sqlite`, content conventions per `@repo/test-utils`.
- **Hands to:** A public harness home that D3/D4 extend with aggregate cases.
- **Focus:** Extraction and consumption only — no aggregate anything. Carries the slice-4 D3-review trap verbatim into the brief: the `decodeJson(null)` guard lives in the runtime (`collection-dispatch` short-circuits null), not at the codec boundary, so a testkit case routed straight through `decodeJson` meets codec strictness — null handling is the harness's job (`nullValue` cases), not the codec's.

### Dispatch 2: Aggregate descriptor protocol and registries

- **Outcome:** `SqlAggregateDescriptor` exists with the settled resolution semantics — `(operation, optional input CodecRef)` → declared output codec (`self` or concrete ID, functions resolve type parameters only) + nullability + lowering; contributions flow through a key beside `codecDescriptors` on `types.codecTypes`, single-contributor-validated in `ControlStack`; a validated registry is assembled once at runtime composition (beside `buildCodecDescriptorRegistry` in `sql-context.ts`) and exposed on `QueryLaneContext`; exact-over-trait precedence is unit-tested; no production path consumes it yet.
- **Builds on:** The codec-descriptor precedent (contribution key, validation, registry assembly) from slices 2–4.
- **Hands to:** A registry reachable from both planners (ORM and sql-builder lane) and from the emitter.
- **Focus:** Protocol, validation, and plumbing. Resolves spec open question 1 (type's home: SQL family core, not framework-components) during grounding and records the decision in the dispatch report.

### Dispatch 3: PostgreSQL aggregate matrix and built-in descriptors

- **Outcome:** An executable probe enumerates every built-in PostgreSQL aggregate × input codec family (count; sum/avg/min/max over int2/int4/int8/float/numeric/temporal as applicable); the probed matrix is authored as `SqlAggregateDescriptor`s contributed by the PostgreSQL target — count → `pg/int8@1`, `sum(int2|int4)` → `pg/int8@1`, `sum(int8)`/integer `avg` → `pg/numeric@1`, min/max → `self` — and pinned by database-backed conformance tests built on D1's testkit harness. Trait fallbacks appear only where every matching codec shares the same result contract.
- **Builds on:** D2's protocol; D1's harness home.
- **Hands to:** A complete, database-verified PostgreSQL aggregate registry; the probe-and-pin pattern D4 mirrors.
- **Focus:** One target's matrix, whole. The probe is evidence, not architecture — probe scripts don't ship; the descriptors and conformance tests do.

### Dispatch 4: SQLite aggregate matrix and built-in descriptors

- **Outcome:** The same probe-and-pin for SQLite — count → `sqlite/bigint@1`, sum/avg/min/max per probed behaviour (including SQLite's numeric-affinity quirks) — authored as target contributions and pinned by database-backed conformance tests.
- **Builds on:** D2's protocol; D3's evidence pattern; D1's harness home.
- **Hands to:** Both targets' registries complete — everything the emitter and the consumer cuts resolve against.
- **Focus:** One target's matrix, whole. Where SQLite's dynamic typing makes an output codec genuinely input-dependent, the descriptor's declared identity must express it — surfacing a case that cannot be expressed declaratively is a halt (falsified assumption), not an inline workaround.

### Dispatch 5: `aggregateTypes` emission

- **Outcome:** SQL `TypeMaps` (`packages/2-sql/1-core/contract/src/types.ts`) carries `aggregateTypes` as its seventh key, generated by the emitter from the same descriptor contributions the runtime resolves against; the contract shape test covers it; all affected fixtures are regenerated and `pnpm fixtures:check` passes with every movement attributable to the new key.
- **Builds on:** D3/D4's complete descriptor sets; D2's contribution surface.
- **Hands to:** The emitted-type half of the lockstep — what D6 resolves result types against.
- **Focus:** Emission and shape only; no ORM consumption yet. Serialized `contract.json` should not move (the surface is type-only) — verify rather than assume.

### Dispatch 6: The ORM aggregate cut

- **Outcome:** `toAggregateProjection` and the include reducers resolve output codecs from the registry, so `ProjectionItem.codec` is authoritative for every aggregate and include aggregate JSON entries are codec-projected — the `native` whitelist in `json-projection-emission.test.ts` is gone and the test states the strengthened invariant; the `Number()`-coercion shims (`normalizeAggregateResult`, `coerceAggregateValue`) are deleted, with decoding through the generic codec path and include extraction through `decodeJson`; ORM aggregate availability/result types resolve from `aggregateTypes` (`count()` types `bigint` and returns it); every moved expectation across sql-orm-client unit, integration aggregate, and ports suites (`legacy-aggregations`, `methods-count`, `issues-20261-group-by-shortcut`, `issues-11974`) is classified mechanical-form-change vs corrected-defect, per the slice-4 D2 discipline.
- **Builds on:** D2's registry, D5's emitted types; the spec's pre-investigated edge-case table (empty-set rows, driver wire shapes).
- **Hands to:** Lossless ORM aggregates on both targets — the slice's headline behaviour.
- **Focus:** The ORM cut, whole: planning, types, decode, and its expectation moves are one behavioural claim. Grep gates: `normalizeAggregateResult|coerceAggregateValue` returns nothing; no `Number(` bridge reappears in the decode path (F1).

### Dispatch 6b: SQLite bigint aggregate lowering (added 2026-07-31, from D6 R2's halt)

- **Outcome:** top-level SQLite aggregates whose output codec is `sqlite/bigint@1` (count, integer sum, min/max over bigint) are readable past 2^53: the descriptors gain the `lower` hook (unused since D2 by design) rendering `CAST(… AS TEXT)`, so the driver receives text instead of throwing `RangeError` on a wide INTEGER (`sqlite-driver.ts:76`, `stmt.iterate()` without big-integer reads); the previously-impossible top-level read is pinned as a test; the sqlite aggregate conformance suite covers the lowered form; any rendered-SQL snapshot moves are classified mechanical.
- **Builds on:** D4's matrix (the surface), D2's lowering vocabulary (the mechanism), D6 R2's probe (`select cast(sum(c) as text)` → exact text, proven against `node:sqlite`).
- **Hands to:** The lossless claim whole on both targets — what D6's review notes as its stated boundary.
- **Focus:** The descriptor-owned fix only. NOT the driver's `setReadBigInts` (blast radius: every integer column's JS type); NOT the lane (D7). The decision record is `wip/unattended-decisions.md` entry 2.

### Dispatch 7: The sql-builder lane cut

- **Outcome:** The sql-builder lane's aggregate functions resolve through the registry: the hardcoded `codecId: 'pg/int8@1'` in `expression.ts`/`runtime/functions.ts` is gone (grep gate: `'pg/int8@1'` appears nowhere outside `packages/3-targets`), `numericAgg` no longer propagates input codecs through widening, aggregate expressions populate the `codec` slot that `ProjectionItem.of` reads, and `test/integration/test/sql-builder/group-by.test.ts` asserts `2n` — the roadmap witness flips.
- **Builds on:** D2's registry, D3/D4's descriptors. Independent of D6.
- **Hands to:** No codec-ID knowledge in any generic planner — the project non-goal enforced everywhere.
- **Focus:** One lane's cut. `CountField`'s static `bigint` typing stays (both targets agree); what changes is where the identity comes from.

### Dispatch 8: The breaking-change record

- **Outcome:** Upgrade instructions (per `record-upgrade-instructions`) cover `count()`/integer-sum `bigint`, decimal-string sums/averages, include aggregates, and contract regeneration — enumerated from the descriptor matrices, not the diff; docs sweep corrects every claim that aggregates return `number` (F12 — sweep, not spot-fix); the codec authoring guide gains the aggregate-descriptor section; the close-out ADR note records whether aggregate descriptors join the codec-projection ADR or stand alone (project open question 8, decided at final retro); `pnpm check:upgrade-coverage` green.
- **Builds on:** Everything prior.
- **Hands to:** Slice close — reviewer verdict, PR against `main`, then project close-out (`drive-close-project` after merge).
- **Focus:** The record. The coverage gate fires on paths, not surfaces — enumerate from the matrices.

## Open items

- **Deferred-gate condition (D1 R1, orchestrator ruling):** adapter-postgres, extension-pgvector, and integration-tests were environment-blocked at D1's gate (host contention; zero assertion failures). They must produce a green run at a later dispatch gate or on CI before slice DoD. Per the D3 review, the postgres testkit's `aggregate-conformance.integration.test.ts` also joins the condition — it is the matrix's own evidence, not a regression guard, so it must be confirmed on a real run before slice DoD. Per the D1 reviewer's catch, `pnpm --filter @internal/adapter-postgres test:coverage` joins the same condition: two DB-backed suites left that package and its vitest coverage thresholds (84/77/88/84) are CI-enforced; if the threshold misses, the `3-targets/3-targets/sqlite` entry in `coverage.config.json` (added for exactly this tests-moved-to-break-a-cycle situation) is the precedent remedy.
- **`check:upgrade-coverage` runs red mid-slice** (D2 reviewer catch): one `per-pr-declaration` violation for `packages/3-extensions/` paths touched by D1 (devDependency, test import, tsconfig `rootDir`). Expected and tracked — D8's brief must cover the incidental extension-path declaration in addition to the aggregate content; later dispatch gate runs must not mistake this red for a new failure.
- **Third follow-up ticket to file once Linear re-authorizes** (D8 review): the HAVING surface types aggregate operands as `number` (`sql-orm-client/src/types.ts:649-661`, `grouped-collection.ts:196-208`) while result surfaces type `bigint`/decimal strings — defensible (HAVING operands are compared inside SQL, never decoded; verified independently at D6b and D7) but API-inconsistent; the demo's `get-user-kind-breakdown.ts:9` depends on it. Wants a deliberate decision, not a hasty flip.
- **Two follow-up tickets to file once Linear re-authorizes** (token expired at first attempt, 2026-07-31; full drafts in the orchestrator's D6b round record): (1) SQLite plain column reads of stored `sqlite/bigint@1` values past 2^53 throw `RangeError` in the driver (`sqlite-driver.ts:76`) — aggregates are fixed by D6b's lowering, ordinary column reads are not; a live correctness hole independent of this slice. (2) `IncludeRefinementCollection` drops scalar reducers for `hasMany` relations attached via `.relations()` in in-file-contract tests — the type-level inference gap D6b worked around with a typed helper in both canonical-JSON suites.
- Spec open questions land as follows: Q1 (descriptor type home/key) → D2 grounding; Q2 (lane registry access) → D7; Q3 (adapter export subpaths) → D1; Q4 (SQLite `descriptor?` escape hatch) → D1.
- The `decodeJson(null)` runtime-guard trap from slice 4's plan (its D3 review) → D1's brief, verbatim.
- Ports-suite policy: expectations update in place to the breaking baseline; no compat shims (project non-goal) → D6's brief.
- Model tier per `drive/calibration/model-tier.md` at brief-assembly time; D2/D3/D6 carry the judgment, D1/D8 are extraction/record-shaped.

## Hand-off linearity

D3 and D4 both build on D2 (+D1's harness home) and are independent of each other; D5 needs both matrices; D6 needs D2+D5; D7 needs D2+D3/D4 but not D6 — the two cuts are order-independent between themselves; D8 needs everything. The non-linear edges worth naming: D6 reads D2's registry surface directly (not D5's types alone), and D7 skips D5/D6 entirely — its brief needs D2's hand-off, not the immediately-prior dispatch's.

## Completeness against slice-DoD

The emission-test whitelist gone — D6. The `group-by.test.ts` `2n` witness — D7. Committed matrices — D3/D4. No cross-package conformance imports — D1 (re-checked by D3/D4, which extend the harness in its new home). `aggregateTypes` in regenerated fixtures — D5. Upgrade instructions — D8.
