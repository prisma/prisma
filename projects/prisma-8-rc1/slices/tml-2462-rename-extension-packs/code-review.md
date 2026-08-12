# TML-2462 — dispatch evidence and review record

Branch: `worktree/config-key-rename-6a45a5`, base `origin/main` (180a06d0f). Commits under review:

1. `a8eea7ca3` feat(config)!: rename extensionPacks to extensions; sourceFormat to format; outputPath to output — substrate rename in `packages/` (343 files). Guard inversion test-first; hash-pin tests updated.
2. `df8439312` feat(config)!: apply extension/format/output key renames across examples, apps, and test trees (189 files).
3. `f00a2aadf` fix(scripts): re-anchor snapshot-import migrations in regen-extension-migrations — latent bug, only triggers on hash churn; snapshot write + import rewrite now precede re-emit, with a to-hash assertion.
4. `94af3d469` chore(fixtures): regenerate contracts, migrations, and snapshots for the extensions key rename (348 files; 16 old-hash snapshot dirs verified unreferenced then removed).
5. `98dc423a5` docs: converge docs and skills on the extensions key; record upgrade instructions (33 files; ADR 004/112 corrections; 0.16-to-0.17 upgrade entries for consumers and extension authors).

## Gate evidence (implementer-reported, logs in wip/, 20260723-*)

| Gate | Result |
| --- | --- |
| fixtures:check | green (idempotent re-emit) |
| build | green 68/68 |
| typecheck | green 143/143 |
| lint (15 steps incl. casts, throws, framework-vocabulary, deps, skills, rules, footprint) | green |
| check:release-notes --mode pr | green |
| check:upgrade-coverage --mode pr | green (after 98dc423a5) |
| test:packages | green, 13346 passed (1 timeout flake, passes standalone) |
| test:integration | green, 1170 passed (3 timeout flakes, each passes standalone) |
| test:e2e | green 20/20 (109 tests) |
| test:examples | 72/73 (cloudflare-worker needs local Hyperdrive env — environment precondition) |

## Known accepted residue

- Old key survives only in: the inverted guard + its test, historical records (CHANGELOG, docs/releases/v0.12.0.md, past upgrade instruction dirs, postgis gotchas.md, projects/ archives), the new 0.16-to-0.17 upgrade entries (before-state + detection predicates), and replay fixture chains (TML-3082) / telemetry-backend snapshots (TML-3083) — both filed as follow-ups, both proven non-deserialized by green suites.
- Upgrade-entry "validation by execution" replay was not mechanically re-run; the recorded transformation is the branch itself (flagged by implementer; reviewer to weigh).

## Review rounds

### Round 1 — principal-engineer pass (Opus), 2026-07-23

Verdict: **approve-with-fixes**; no correctness defects.

- Silent-drop hazard traced end-to-end and confirmed safe: config guard rejects loudly; both family validators carry top-level `'+': 'reject'` so old-key contract.json is rejected, not stripped; snapshot reads are hash-keyed so old snapshots are only reachable via old hashes (miss → loud `MIGRATION.CONTRACT_SNAPSHOT_MISSING`).
- Pinned-hash tests re-run by the reviewer directly (81 + 1 + 39 passed); provenance of two hand-copied off-glob fixtures byte-verified; ADR 004's corrected claim verified exactly true of `hashing.ts`; upgrade-instruction guard quote verbatim-accurate; no `sha256:` scope creep; no new bare casts.
- Finding 1 (DoD deviation): old-key literals persist in replay fixture chains + telemetry-backend snapshots. Ratified by the orchestrator as a conscious deferral (TML-3082/3083); spec residue list amended accordingly.
- Finding 3/5 (nits): regen-script guard message could misfire in an inconsistent state (unreachable today); pre-existing `(AC5)` transient ID in a touched test description. Both routed to a final fix round.
- Mild scope stretch noted, accepted: generic type param `ExtensionPacks` → `Extensions` in builder signatures (concept types like `ExtensionPackRef` correctly preserved).
- Intent validation: Scope-In fully delivered; DoD met modulo the ratified deviation above.

### Round 2 — merge-resolution re-review (Opus), 2026-07-23

Scope: only merge commit `9b996604b` (integrating origin/main up to `418dcb381`). Verdict: **approve**. All 8 hand-resolved points correctly combine both intents (interpreter.ts: our `composedExtensions` + main's `scalarColumnDescriptors`; control-stack.ts: our message + main's `InternalError`; pinned hashes repinned prefix-free and re-run green; both 0.16-to-0.17 upgrade files keep all 8 entries; README stale-side correctly taken from main; both main-new-file bug-fixes type-correct; no `sha256:` reintroduced; all 9 origin/main commits survived). Only LOW note = the TML-3082/3083 frozen-snapshot residue, pre-existing, not merge-introduced.

### CI result on `9b996604b` — main moved again

CI dispatched (the conflict-block is cleared) but Type Check + Integration Tests failed against the merge ref. Cause: main advanced two more commits past our merge parent — #1035 (ports the 488-case prisma test corpus, whose ~43 sugar configs use old `outputPath` + the corpus carries old `extensionPacks` across its fixtures) and #1038 (TML-3086, a **breaking** date-column emission change that re-churns date contract hashes and adds sibling 0.16-to-0.17 upgrade entries). Not a defect in our work — the rename is racing a fast-moving main. Escalated to operator for merge-sequencing decision.

### Second sync (`7f990cb49` + `60b643047`) — green vs current main

Operator approved babysit-to-merge. Merged origin/main (#1035 corpus + #1038 date change): zero textual conflicts. Corpus fixes: 43 `test/integration/test/ports/**/_fixture` configs `outputPath`→`output`; 87 `extensionPacks` files (43 generated `contract.json` + 43 `.d.ts` + 1 real harness call) regenerated via the corpus's own documented `contract emit` (not covered by `fixtures:emit`); one latent bug fixed — `legacy-json` fixture predated #1022's `Json`→native rebind and was never regenerated, corrected to `Jsonb` per the recorded upgrade guidance. #1038's date change touched nothing of ours (no `@db.Date` in tree or corpus). Full gate set green: typecheck 143/143, test:packages 13508, test:integration 245/245 (after 2 known load-flake retries), test:e2e 109, lint + fixtures:check + check:upgrade-coverage. One straggler caught in orchestrator verification and fixed: `.agents/rules/namespace-diagnostic-wording.mdc` named the old config key (a rule-doc category D4's enumeration missed). Verified clean-merge against current main (#1031, docs-only).
