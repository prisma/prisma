# Drive — Judge + live-experiment harness

## Purpose

Let the operator decide whether a change to a drive-\* skill made Drive runs **better or worse** — correctness first, then speed — without reading transcripts by hand. The instrumentation project (drive-instrumentation) made runs _measurable_; it answers "what happened." It cannot answer "was this run good, and is it better than the alternative?" This project closes the refinement loop by adding the qualitative grade and the controlled comparison that turn a measured run into a judged, A/B-able one.

## At a glance

Today the diagnostics report (`drive-diagnose-run`) prints disaggregated metrics over a single trace. A reader skims twenty green numbers and cannot answer the only two questions that matter: _was the work correct?_ and _was this run better than the last skill version?_ Worse, nothing in the report admits it can't answer — all-green metrics quietly imply "good."

End state:

```
$ drive ab --baseline skills@HEAD~1 --candidate skills@HEAD --brief golden/two-slice-in-project --k 8

Correctness gate (Tier 1):   baseline 7/8 CORRECT   candidate 8/8 CORRECT
Efficiency (Tier 2, CORRECT runs only):
  expected wallclock-to-correct  baseline 41m   candidate 28m   (-32%)
  tokens-to-correct (median)     baseline 1.9M  candidate 1.4M  (-26%)
  rounds-per-dispatch (median)   baseline 2.1   candidate 1.4
Diagnostic deltas:  brief reissues 4→1 · I12 halts 1→0 · spec amendments 3→2
Verdict: candidate dominates — strictly more correct AND cheaper-to-correct.
```

The headline is the **two-tier scorecard**: a binary correctness gate sourced from outside the run (mechanical: validation gates pass; QA: a successful QA run; intent: a calibrated LLM judge), then efficiency scored only over the runs that passed the gate. The composite scalar `E[wallclock | CORRECT] / P(CORRECT)` exists as a decision-time _ranker_ when diagnostics are ambiguous — it is never the dashboard headline. Getting there needs three things the framework doesn't have yet: an honest scorecard that refuses to imply "good" without a correctness signal; a judge that can _produce_ that correctness signal and is calibrated against human grading; and a harness that spawns enough comparable runs to make "better than" a measured claim rather than a vibe.

## Non-goals

- **Not benchmark-maxxing.** The goal is raising the floor of the drive-\* skills, not chasing a single leaderboard number. The diagnostic dashboard is the iteration headline; the composite scalar is a sparingly-used decision-time ranker.
- **Not replacing human review or operator judgment.** The judge produces a signal the operator reads; it does not gate merges or auto-approve work.
- **Not a general-purpose agent-eval framework.** Scoped to Drive runs against Drive briefs. Generalising to arbitrary agents is out of scope.
- **Not new trace-emission plumbing.** The emission vocabulary and the deterministic emitter are drive-instrumentation's remit (landed). This project _consumes_ the trace and extends the vocabulary only where the scorecard needs inputs that don't exist yet (a token signal, an external-correctness feed).
- **Not solving the self-asserted-verdict trust gap by instrumentation alone.** A skill-emitted `round-end.verdict: satisfied` is the emitter's claim, not ground truth. Establishing real correctness is precisely the judge's job; the deterministic emitter removed _formatting_ freedom, not _semantic_ freedom.
- **Not an industrial-grade eval platform.** The default is the minimal bespoke scorer that does the job — an LLM-judge call plus a simple held-out agreement tally. A third-party eval framework (Inspect, Braintrust, promptfoo, …) is adopted **only if it reduces net complexity** vs. building it ourselves; if standing one up is itself a lot of machinery, we don't bother. Minimal-that-works beats feature-complete.

## Place in the larger world

- **Builds on drive-instrumentation (Project 1, closed).** The emitted trace shape is the contract the judge and scorecard read from. The deterministic, fail-closed emitter (TML-2721, merged) makes skill-emitted traces trustworthy at the line level, which is the precondition for accreting a corpus worth calibrating a judge against.
- **`drive-diagnose-run` skill.** The scorecard and honest verdict line extend this skill's report. The post-hoc parser it ships needs validation against ≥3 real instrumented runs (TML-2728), which this project's harness produces.
- **`drive-run-retro` skill.** The auto-retro ("pass the trace back to the model that produced it and ask what it would have needed") surfaces clues alongside operator-driven retro findings — it feeds this skill, it does not replace it.
- **Cursor SDK (`@cursor/sdk`).** The controlled-experiment harness spawns `k=N` orchestrator runs with pinned models for skill-version A/B.
- **Judge model is deliberately cross-family** from the orchestrator under test (a hard requirement) to avoid same-family grading bias. Default judge: **GPT 5.5** — cross-family from the Claude orchestrator under test today. The judge model is a pinned per-experiment parameter; when the orchestrator under test is itself non-Claude, the default flips to a cross-family model accordingly.

## Cross-cutting requirements

- **Correctness is the #1 axis and a hard gate.** The scorecard is two-tier: Tier 1 is a binary correctness gate sourced _externally_ to the run; Tier 2 (efficiency: tokens, wall-clock, rework) is scored **only over runs that passed Tier 1**. Speed never compensates for incorrectness.
- **The correctness gate is composed, not CI-dependent.** Sandboxed golden-case runs cannot rely on CI (that needs an isolated fork, and we don't open real PRs into the repo from experiments). For a sandboxed run, **Tier-1 CORRECT = validation gates pass (`pnpm typecheck` / `test` / `lint` per the team DoD) AND a successful QA run AND the judge's intent/requirements verdict passes**. Merge status / CI is an _optional stronger_ signal, used only for real-ticket runs that open a PR against an isolated fork (out of scope for slice 1).
- **QA plans are pre-written.** Each golden case ships its `drive-qa-plan` script in its acceptance set, authored alongside the brief — so the QA-run signal is available deterministically at run time, not authored mid-run.
- **The report must never let all-green metrics imply "good."** Until a correctness signal exists for a run, the verdict line reads `not computable` and names the missing input — it does not stay silent.
- **The judge is trusted only once calibrated.** ≥80% agreement with human grading on a held-out subset before its output is used as the Tier-1 intent signal.
- **Tokens are measured, not estimated.** The harness accumulates per-run usage from the SDK's `TurnEndedUpdate.usage` (`inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`) into a `tokens` trace field; hand-runs leave it `null` → scorecard renders `n/a (no signal)`.
- **A/B comparisons are reproducible.** Same brief, pinned orchestrator + judge models, fixed `k` → a report that another operator can regenerate and get the same verdict shape. The baseline for "how good" is the immediately-previous skill version on the same golden case(s); cross-run aggregation against the accreting corpus is the longer-term baseline.
- **Every slice keeps `drive-diagnose-run` and the trace tooling green.** No slice leaves the diagnostics report unrunnable.

## Transitional-shape constraints

- **Judge calibration is corpus-gated.** It cannot start until ~10–20 natively-instrumented runs have accrued. Therefore the harness/golden-case work and the honest-scorecard work must be landable _before_ the judge slice, and the judge slice gates its own calibration step on the corpus being present (it does not block the project from progressing in the meantime).
- **The honest verdict line lands before the judge exists.** `not computable` is the correct, shippable state of the scorecard for the entire window before the judge is calibrated — it is not a stub.
- Each slice ships as one reviewable PR and leaves `main` green.

## Project Definition of Done

Inherits the team-DoD floor ([`drive/calibration/dod.md`](../../drive/calibration/dod.md)) — repo-wide gates, doc/migration, Linear close-out, manual-QA roll-up, ADR audit. Project-specific conditions on top:

- [ ] Golden-case library curated (5–10 canonical Drive briefs with co-located acceptance sets) and the live harness runs them end-to-end.
- [ ] The diagnostics scorecard is two-tier and prints an honest `not computable` verdict whenever the correctness signal is absent (no all-green-implies-good).
- [ ] LLM judge calibrated to ≥80% agreement with human grading on a held-out subset of the instrumented-run corpus.
- [ ] Auto-retro surfaces evidence-supported clues alongside operator findings in `drive-run-retro` (clue, not truth).
- [ ] The harness produces a reproducible A/B report between two skill versions.
- [ ] A CI gate catches a regression in a sandbox experiment (top-line correctness or a diagnostic metric).
- [ ] The post-hoc trace parser (`drive-diagnose-run`) is validated against ≥3 instrumented runs with per-event confidence recorded (clears TML-2728).

## Open Questions

None remaining — the project-level questions were resolved during shaping (logged below).

## Decisions (resolved during shaping)

1. **One project, not two.** Kept as one project — the harness exists _to feed the judge_ a corpus and the A/B engine exists _to consume_ the judge's correctness signal; splitting severs that loop across two trackers. Revisit only if slice 4 splits and the count crosses 4.
2. **Judge model: cross-family is a hard requirement; default GPT 5.5.** The judge is a pinned per-experiment parameter that must be cross-family from the orchestrator under test. Default is **GPT 5.5** (cross-family from today's Claude orchestrator); the default flips when the orchestrator under test is non-Claude.
3. **Token signal from the SDK.** Per-run `tokens` accumulated from `TurnEndedUpdate.usage` (`inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`); added to the trace vocabulary; hand-runs `null` → `n/a (no signal)`. Per-dispatch attribution deferred.
4. **Correctness gate is composed (not CI-dependent).** Sandboxed Tier-1 CORRECT = validation gates pass AND a successful QA run AND the judge's intent verdict passes. QA plans are pre-written in each golden case's acceptance set. Merge/CI is an optional stronger signal only for real-PR runs against an isolated fork (out of scope for slice 1).
5. **Baseline = previous skill version.** A/B against the immediately-previous skill version on the same golden case(s); cross-run aggregation is the longer-term baseline.
6. **Bespoke-minimal scorer — spike completed, confirmed.** The slice-3 (TML-2736) time-boxed spike ran and confirmed bespoke-minimal over Inspect / Braintrust / promptfoo. Decisive factor: an impedance mismatch — the frameworks grade _(input → model output)_, whereas our unit is a whole Drive run scored from trace + diff + golden acceptance set; the grading call is tiny and the trace/scorecard/golden integration is bespoke regardless. **promptfoo** (TS, MIT, local) is the recorded escape hatch if the bespoke scorer grows hairy, and its calibration workflow is borrowed. Reasoning in [`design-notes.md`](./design-notes.md) § Alternatives considered. The run-production harness stays bespoke regardless.

## References

- Linear Project: [Drive — Judge + live-experiment harness](https://linear.app/prisma-company/project/drive-judge-live-experiment-harness-efa7d807c716)
- Predecessor: drive-instrumentation (Project 1, closed) — durable methodology under [`docs/drive/`](../../docs/drive/README.md)
- Deterministic emitter: TML-2721 (merged, PR #633)
- Folded tickets: TML-2720 (scorecard + token/correctness vocabulary), TML-2728 (validate post-hoc parser ≥3 runs)
- Self-grade trust caveat: [`drive/retro/findings.md`](../../drive/retro/findings.md)
- Trace contract: [`skills-contrib/drive-record-traces/`](../../skills-contrib/drive-record-traces/) (`events.md`, `schema.ts`, `emission.md`)
- Design notes: [`./design-notes.md`](./design-notes.md)
