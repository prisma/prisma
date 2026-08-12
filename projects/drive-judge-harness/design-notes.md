# Design notes: Drive — Judge + live-experiment harness

> Synthesized design document. Read this to understand **what the design is**, **what principles it serves**, and **what alternatives were rejected**. It captures the settled design, not a chronological log.
>
> Owned by the Orchestrator; authored directly. Cross-linked from [`./spec.md`](./spec.md).

## Principles this design serves

- **Correctness-first.** Speed and token savings never compensate for incorrect work; correctness is a hard gate, not a weighted term.
- **Floor-raising, not benchmark-maxxing.** The diagnostic dashboard is the iteration headline; the composite scalar is a sparingly-used decision-time ranker. The goal is making the drive-\* skills reliably better, not maximising a leaderboard number.
- **Trust the instrument before trusting the number.** A judge's output is used as a correctness signal only after it agrees with human grading ≥80% on held-out data.
- **Measurement honesty.** The report must admit when it cannot answer "was this good?" rather than letting all-green metrics imply it.
- **Cross-family grading.** The judge model is from a different family than the orchestrator under test, to avoid same-family grading bias.

## The model

### Two-tier scorecard

The headline of every run report is a scorecard with a strict tier order:

- **Tier 1 — correctness gate (binary, external, composed).** Sourced from _outside_ the run. For sandboxed golden-case runs (no CI without an isolated fork), `CORRECT` = validation gates pass (`pnpm typecheck` / `test` / `lint`) **AND** a successful QA run (each golden case ships a pre-written `drive-qa-plan` in its acceptance set) **AND** the judge's intent/requirements verdict passes. Merge status / CI is an optional stronger signal only for real-PR runs against an isolated fork. A run is `CORRECT` or not. This is the #1 axis.
- **Tier 2 — efficiency, scored only over `CORRECT` runs.** Tokens-to-correct, wall-clock-to-correct, rework (rounds-per-dispatch). Scoring an incorrect run's efficiency is meaningless, so Tier 2 is gated on Tier 1.

When the Tier-1 input is absent, the verdict line reads `not computable` and names the missing input. This is the correct shippable state until the judge exists — not a stub.

### The composite ranker

`E[wallclock | CORRECT] / P(CORRECT)` — expected wall-clock to _a correct run_, inflated by the failure rate. It is a single number used **only** when diagnostics are ambiguous and the operator needs a tiebreak ranking between two skill versions. It is never the dashboard headline; surfacing it as the headline is the failure mode this design guards against.

### The judge

Three prompt sets, judge model cross-family from the orchestrator under test (hard requirement; default **GPT 5.5**, cross-family from today's Claude orchestrator; a pinned per-experiment parameter): (a) correctness rubric (mechanical / requirements / intent); (b) failure-mode classifier (F1–F9 + scope traps + QA coverage-gate gaps); (c) operator-turn classifier (five buckets distinguishing legitimate design/authz turns from illegitimate correction/rescue turns). Calibrated against an accreting corpus to ≥80% held-out agreement before its output feeds Tier 1.

### The harness

Golden-case library (5–10 canonical briefs with co-located acceptance sets) + SDK-spawned runs with pinned models. Produces the instrumented-run corpus the judge calibrates against, and grows into the k=N A/B engine that compares two skill versions and gates CI on regressions.

### Run setup (skill injection)

The skill bundle that drove a run is a **first-class, pinned run input** — a peer of `model` and `(brief, base)`, not an ambient property of the operator's working tree. A run's quality is a function of the skill version under test, so to measure a skill change (or to replay a golden case reproducibly) the harness must execute the orchestrator against a known code state with a **specified** skill bundle materialized into that checkout.

The shape:

- **Two distinct inputs that coincide today.** _repo-under-test_ (the codebase the orchestrator changes — prisma-next at a base ref) and _skill-bundle-under-test_ (the drive-\* skills + rules driving it). They are the same repo today; the design names them apart so the eventual move of the skills to their own host repo costs no rework.
- **A skill bundle is a git ref**, not an ad-hoc file copy: a commit/branch/tag whose canonical homes (`skills-contrib/`, `.agents/rules/`, `AGENTS.md`/`CLAUDE.md`) define the bundle. Materialization is exactly what the repo's `prepare` hook already does (`skills add` + `sync-agent-rules`) — the harness does not reinvent it.
- **`prepare-run` isolates, overlays, materializes.** It creates an isolated checkout of the repo-under-test at the pinned base, overlays the bundle's canonical-home dirs, and runs the `prepare` hook so the gitignored trees (`.cursor/`, `.claude/`, `.agents/skills/`) exist. The materialized trees being gitignored is _why_ every run needs this — even a run against current `main`.
- **Traces are collected post-hoc from the isolated checkout**, not pinned a priori. The spawned orchestrator emits per the standard `drive-record-traces` protocol (path resolved from its own session/project context inside the checkout); after the run, the harness scans the checkout for emitted `trace.jsonl` (schema-validated, matched to the spawned run) plus the git diff. This keeps `emit.ts` and the emission protocol untouched; an env-pinned destination is the recorded escape hatch if post-hoc matching proves ambiguous.
- **Only instrumented bundles produce traces.** A bundle predating the `drive-record-traces` wiring yields an untraced run; the harness records that and falls back to slice 2's post-hoc parser. Historical replay overlays the _current_ (instrumented) bundle onto a historical base, accepting that an old base may not materialize against the current toolchain — an un-materializable case is simply not replayable.

This is the run-production foundation under both corpus generation and the A/B engine: an A/B arm is exactly `(brief+base, model, skill-bundle)` with one axis varied.

### Corpus-gating

The single hardest sequencing constraint: judge calibration needs ~10–20 instrumented runs, which only exist once the harness runs the golden cases. This forces harness-before-judge and is why the honest `not computable` scorecard must ship first.

## Alternatives considered

- **Single composite scalar as the dashboard headline.** Attractive: one number ranks everything. **Rejected because:** it hides the correctness/efficiency trade-off and invites benchmark-maxxing — the operator stops reading diagnostics and starts gaming the scalar.
- **Trust the self-asserted `round-end.verdict: satisfied` as the correctness signal.** Attractive: already in the trace, free. **Rejected because:** it is the emitter's _claim_, not ground truth — a skill can hand-emit `satisfied` on a failed round. Establishing real correctness is the entire reason the judge exists; the deterministic emitter removed formatting freedom, not semantic freedom.
- **Same-family judge (model grades its own family).** Attractive: cheaper, simpler. **Rejected because:** same-family grading bias inflates agreement without measuring real correctness.
- **A large speculative golden-case corpus (hundreds of briefs).** Attractive: coverage. **Rejected because:** floor-raising needs a handful of high-signal cases; 200 speculative ones cost more to maintain than they signal, and dilute the regression gate.
- **Wall-clock alone as the efficiency metric.** **Rejected because:** wall-clock is a weak proxy; tokens are the stated #1 optimization target after correctness and must be instrumented directly.
- **Adopting an industrial-grade eval framework (Inspect / Braintrust / promptfoo / LangSmith) as the substrate.** Attractive: dataset management, judge scoring, experiment-diff dashboards out of the box. **Rejected — confirmed by the slice-3 spike.** The decisive factor is an **impedance mismatch in the eval unit**: every candidate is built around _"(input → model output) → grade the output."_ Our unit is a **completed Drive run** — a `trace.jsonl` + the produced diff/PR, graded against a golden `acceptance.md` on three axes plus failure-mode and operator-turn classification, plus calibration bookkeeping. A framework can host the _grading call_ (one rubric prompt → one model call → a parsed verdict — which is genuinely tiny), but **cannot host the integration** with our trace, scorecard (slice 1), and golden acceptance sets (slice 2); that glue is bespoke regardless, so a framework spends the code it saves on adapter mapping. Per-candidate: **promptfoo** is the only real contender (TS/Node-native, MIT, runs 100% local, `llm-rubric` with custom `rubricPrompt`, cross-family judge, and a documented calibration workflow) but is still prompt/response-shaped; **Inspect** is Python and built around `Task = dataset + solver + scorer` where it wants to _run the solver itself_ (our "solver" is a Cursor-SDK-spawned orchestration — wrong execution model + cross-language); **Braintrust**'s value is its cloud/hybrid platform (self-host = enterprise VPC/Terraform), more than minimal. **Escape hatch recorded:** if the bespoke scorer grows hairy, adopt **promptfoo** (not Inspect, not Braintrust); and we lift promptfoo's documented calibration workflow (label → measure agreement → validate on holdout → lock + monitor drift) rather than invent one. The run-production harness stays bespoke regardless (Cursor-SDK-specific; nothing off-the-shelf spawns and grades it).
- **Split into two projects (judge / harness).** Attractive: each lands at ≤3 slices, cleaner boundaries. **Rejected (for now) because:** the harness exists to _feed_ the judge a corpus and the A/B engine exists to _consume_ the judge's signal — splitting severs the refinement loop across two trackers. Revisit if slice 4 splits and the count crosses 4 (spec Open Question 1).

## Open questions

None remaining — all resolved during shaping (see spec § Decisions). For the record:

- **One project, not two** — the feed→consume loop is the project; revisit only on a slice-4 split.
- **Judge model** — cross-family hard requirement; default GPT 5.5; pinned per experiment.
- **Token signal** — per-run `tokens` from the SDK's `TurnEndedUpdate.usage`; hand-runs `null`.
- **Correctness gate** — composed (validation gates + QA run + judge intent) for sandboxed runs; merge/CI optional, real-PR-only.
- **Baseline** — previous skill version on the same golden case(s).
- **Scorer** — bespoke-minimal. The slice-3 spike ran and **confirmed** bespoke-minimal: the eval unit (a whole Drive run scored from trace + diff + acceptance set) doesn't fit the prompt→output→grade shape the frameworks optimise, the grading call itself is tiny, and the trace/scorecard/golden integration is bespoke either way. promptfoo is the recorded escape hatch.

## References

- Project spec: [`./spec.md`](./spec.md)
- Project plan: [`./plan.md`](./plan.md)
- Predecessor methodology: [`docs/drive/`](../../docs/drive/README.md)
- Trace contract: [`skills-contrib/drive-record-traces/`](../../skills-contrib/drive-record-traces/)
- Self-grade trust caveat: [`drive/retro/findings.md`](../../drive/retro/findings.md)
