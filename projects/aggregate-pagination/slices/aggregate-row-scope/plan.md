# Dispatch plan — aggregate-row-scope

**Slice spec:** `projects/aggregate-pagination/slices/aggregate-row-scope/spec.md`

Seven dispatches, strictly sequential. The ordering is load-bearing in one place: the baseline snapshot must be generated on unmodified source, so it goes first and nothing before it touches `src/`.

## Dispatch 1: baseline snapshot of today's aggregate plans

- **Outcome:** A committed test snapshots the compiled plan AST for a corpus of aggregate chains that name no row scope — bare, `where`-only, `orderBy`-only, multi-selector, `count()`-only, and the grouped equivalents — and passes against unmodified `src/`.
- **Builds on:** None. This is the first dispatch and must run before any source change.
- **Hands to:** A frozen baseline file. Every later dispatch in this slice, and in slice 2, must leave it byte-unchanged; a diff in it is a halt condition, never a `-u` update.
- **Focus:** Test only — zero `src/` edits, verified by the diff. Corpus covers grouped aggregates too, even though grouped behaviour is slice 2's: the guard's job is to fail the moment slice 2 widens the wrap condition too far, and it can only do that if the grouped baseline exists now. Snapshot the plan AST, not rendered SQL — this package has no renderer dependency.

## Dispatch 2: lift the row-scope machinery into `src/query-plan-scope.ts`

- **Outcome:** `createTableRefRemapper`, `buildStateWhere`, the cursor lowering (`buildCursorWhere`, `createBoundaryExpr`, `buildLexicographicCursorWhere`) and `wrapWithRowNumberDedup` live in `src/query-plan-scope.ts`; `query-plan-select.ts` imports them; the full package suite and dispatch 1's snapshot are unchanged.
- **Builds on:** Dispatch 1's frozen baseline.
- **Hands to:** A module exporting the four helpers, importable from `query-plan-aggregate.ts` without a cycle.
- **Focus:** Move-only. No signature edits, no logic edits, no "while I'm in here" tidying — a behaviour diff here is a defect, not an improvement. `query-plan-mutations.ts:175` has its own private `createTableRefRemapper`; leave it. Confirm no import cycle (`pnpm lint:deps`).

## Dispatch 3: root `.aggregate()` honours `take` / `skip` / `cursor`

- **Outcome:** `compileAggregate` takes `CollectionState` instead of `filters`, and wraps its source in a `${tableName}__scoped` derived table when the chain carries a limit or offset — `cursor` folding into the WHERE the way the nested path already does. Chains naming no scope compile through the unchanged path and dispatch 1's snapshot still passes. `skip` without `take` emits `OFFSET` with no `LIMIT`.
- **Builds on:** Dispatch 2's `query-plan-scope` module.
- **Hands to:** A working conditional wrap. Adding a clause family from here means widening the `needsRowScope` condition and adding a branch to the inner-select builder — no structural change.
- **Focus:** Tests first, per the repo golden rule: rewrite the two root-position tests in `test/aggregate-pagination.test.ts` against the derived-table shape (`ast.limit` undefined; the inner select carries it), watch them fail, then implement. The third test in that file is grouped — leave it `it.fails` for slice 2. Call sites to migrate: `collection.ts:1139`, `test/query-plan-aggregate.test.ts`, `test/rich-query-plans.test.ts`. `compileGroupedAggregate` keeps its `filters` parameter. Distinct is dispatch 4.

## Dispatch 4: root `.aggregate()` honours `distinct()` / `distinctOn()`

- **Outcome:** `needsRowScope` widens to include distinct; `distinctOn` lowers to native `withDistinctOn`, `distinct` to `wrapWithRowNumberDedup` with `orderBy` reapplied on the ranked alias before `LIMIT` slices it. Combinations of distinct with pagination produce the ordered-then-deduped rows, covered by unit tests.
- **Builds on:** Dispatch 3's wrap.
- **Hands to:** The complete answer to "which rows does this chain describe" for the root position — the shape slice 2 reuses unchanged.
- **Focus:** `query-plan-select.ts:1315-1355` already proves the clause ordering that gives the right answer; mirror it rather than re-deriving. Hidden order columns are needed only for the `distinct` + `orderBy` combination (`:1284-1299`). Still no grouped work.

## Dispatch 4b: the MTI variant join in `compileAggregate`

_Inserted 2026-08-17 by operator decision, after adversarial review of D3 surfaced the hole. Numbered `4b` rather than renumbering 5-7, whose briefs are already written._

- **Outcome:** `compileAggregate` joins the variant table the way `compileSelect` does, so a variant-owned column referenced by `orderBy` — or by `where()`, broken the same way today — resolves against a table the query actually joins.
- **Builds on:** Dispatch 4's completed wrap.
- **Hands to:** A root aggregate whose scope expression is correct for polymorphic models, not only for flat ones.
- **Focus:** MTI only; STI columns live on the base table and need nothing. Mirror `query-plan-select.ts:1500-1512` rather than deriving a second join strategy. The pre-existing `where()` case is in scope precisely because it is the same missing join — fixing one and leaving the other would be arbitrary.

## Dispatch 4c: `distinctOn` capability gate in the ORM lane

_Inserted 2026-08-18 by operator decision, after adversarial review established that the ORM lane never consults a capability the sql-builder lane enforces twice over._

- **Outcome:** `.distinctOn(...)` on a target that does not report `postgres.distinctOn` is a **compile error and a runtime error**, matching the sql-builder lane exactly — instead of type-checking, recording into state unchecked, and having the SQLite renderer drop the clause on the floor.
- **Builds on:** Dispatch 4's completed `distinctOn` lowering.
- **Hands to:** An ORM `distinctOn` whose reachability matches the builder lane's, closing the gap the repo's own scorecard records as `🟡` ("reachable through the public surface, no proving test").
- **Focus:** Both terminals — `.aggregate()` and `.all()` — since the gap is one ungated method, not one code path. Mirror `sql-builder/src/types/select-query.ts:66-68` (`GatedMethod`) and `runtime/query-impl.ts:67-69` (`_gate`), and copy the proof shape from `test/e2e/framework/test/sqlite/sql-builder.test.ts:345-352`, which asserts both levels. Reuse `ORM.CAPABILITY_MISSING` via a helper mirroring `assertReturningCapability` — the project DoD forbids a new error subcode, and reuse satisfies it. `hasContractCapability(contract, 'distinctOn')` already resolves correctly against both contracts unmodified.
- **Trap, pre-named:** the docs name the wrong key. `docs/architecture docs/subsystems/3. Query Lanes.md:452` and ADR 065 say `projection.distinctOn`; the key actually emitted and enforced is **`postgres.distinctOn`**. Implementing from the doc would check a key that is never present and reject on every target. Fix the doc as part of this dispatch.
- **Expected breakage:** this newly makes a compile error out of SQLite code calling `distinctOn` — code that is already silently broken today. That is the point, but it means the diff may reach beyond the ORM package; if it does, report rather than absorb.

## Dispatch 5: integration tests on PGlite and SQLite

- **Outcome:** Integration tests assert **values** — not SQL shape — for root-position `take` / `skip` / `cursor` / `distinct` on both PGlite and SQLite, including a case that would desync parameter binding if one `ParamRef` reached SQL twice.
- **Builds on:** Dispatch 4's completed wrap.
- **Hands to:** Per-target proof that the derived-table boundary binds parameters correctly — the cross-cutting requirement the unit tests structurally cannot check.
- **Focus:** PGlite side extends `test/integration/test/sql-orm-client/aggregate.test.ts`'s existing harness. SQLite side follows `count-terminal-interleaving.test.ts`'s in-test `defineContract` composition — do not emit a new fixture. The parameter-binding case matters because `collectOrderedParamRefs` dedupes by identity and the SQLite renderer deliberately does not. **This dispatch also adjudicates a predicted defect:** whether SQLite rejects the `OFFSET`-without-`LIMIT` that `skip` without `take` produces. A syntax error there is a confirmed prediction, not a surprise — record it precisely and continue with the remaining cases.

## Dispatch 5b: SQLite `OFFSET`-without-`LIMIT` renderer correction — conditional

_Runs only if Dispatch 5 confirms the defect. Operator-authorised 2026-08-17; see the project spec's amended § Adapter impact._

- **Outcome:** The SQLite renderer emits `LIMIT -1 OFFSET n` when an offset is present and no limit is — so `skip` without `take` runs on SQLite, for aggregates and for `.all()` alike.
- **Builds on:** Dispatch 5's empirical confirmation. Does not run without it.
- **Hands to:** A `skip`-without-`take` DoD item that closes on both targets rather than one.
- **Focus:** `packages/3-targets/6-adapters/sqlite/src/core/adapter.ts` and its renderer test. This is a renderer bug fix, not a branch on target — the plan does not change shape per target, the SQL text does. Its own commit, separable from the aggregate work.

## Dispatch 6: TSDoc for position semantics

- **Outcome:** TSDoc on `aggregate`, `take` and `skip` states that a chain's row scope is what the aggregate reduces, with a worked example.
- **Builds on:** Dispatches 3-4 — the semantics must be real before they are documented.
- **Hands to:** The user-facing statement of root-position behaviour; slice 2 extends the same blocks with the pre-group / post-group distinction.
- **Focus:** Root position only. Do not pre-document grouped behaviour that does not exist yet. Match the surrounding TSDoc voice (`collection.ts:842-972` is the house style for these methods); no manual line wrapping.

## Dispatch 7: manual-QA script + run

- **Outcome:** A manual-QA script exists for the slice and at least one run report is attached, with no unresolved 🛑 Blocker findings.
- **Builds on:** Dispatch 5's green integration suite.
- **Hands to:** The slice's QA-side DoD evidence.
- **Focus:** Skill-driven, not implementer-driven — `drive-qa-plan` authors the script, `drive-qa-run` executes it. Names both consumer audiences per `drive/calibration/patterns.md § Consumer audiences`.

## Validation gates

Per `drive/calibration/dod.md`, threaded into every dispatch's brief:

- **Always:** `pnpm typecheck`, plus `pnpm --filter @internal/sql-orm-client lint` — lint is a separate CI job and typecheck will not catch an unused import or a formatter diff.
- **Per dispatch touching source or tests:** `pnpm --filter @internal/sql-orm-client test`. Use the `--filter` form, not `pnpm test:packages -- <name>`, which is a workspace-wide path filter that red-fails on unrelated infra.
- **Dispatch 2:** `pnpm lint:deps` — a new module changes the import graph.
- **Dispatches 2-6:** `pnpm fixtures:check` — the slice touches `packages/3-extensions/**`.
- **Dispatch 5:** `pnpm test:integration`.
- **Every dispatch after 1:** dispatch 1's snapshot file is unchanged in the diff. This is the slice's own grep-gate equivalent and belongs in each brief's `Completed when`.
- **Before the final push:** sync `origin/main`, then re-run the always-run gates — a branch that validated against a stale base can still red-fail CI.

## Model tier

Dispatches 1, 2 and 5 are brief-precise with strong gates — mid tier. Dispatch 6 is a voice-aware doc edit — cheap tier. No dispatch inherits the parent's tier by default; that is treated as a bug per `drive/calibration/model-tier.md`.

**Amended after D2 (2026-08-17):** dispatches 3 and 4 were planned for the orchestrator tier as the ones "carrying the design judgment." They run on the persistent mid-tier implementer instead. The slice spec pins the design far enough — aliases, the projection rule, the clause ordering inside the wrap, and the codec-vs-ref split in `toAggregateProjection` are all named, with the prior art cited by line — that what remains is pattern replication against an already-landed shape, not design negotiation. That is exactly the case `drive/calibration/model-tier.md` records mid tier as holding for, and continuity across D1-D2 is worth more here than a tier bump, since model tier is fixed at spawn and switching means losing the transcript. The expensive tier goes to the *review* of D3 instead — the round where compiled SQL changes for the first time is where verification, not authorship, carries the risk. If D3 comes back weak, D4 escalates to a fresh `implementer/thorough`.
