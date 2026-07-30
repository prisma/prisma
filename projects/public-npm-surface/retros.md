# Retros — public npm surface

## 2026-07-30 — Slice-2 dispatch died on a model usage limit, losing all in-flight work

**Trigger:** dispatch failure (unexpected — the protocol didn't see it coming).

**What happened.** The TML-3122 implementer dispatch terminated mid-slice with an API error (Fable 5 usage limit reached). It had pushed nothing, so every step it had completed was lost, and the slice restarted from zero on a different model tier.

**What was supposed to happen.** A dispatch either completes and pushes, or fails on a work-related condition the brief anticipated. Model-capacity exhaustion is neither.

**Where the protocol failed.** Two gaps, both upstream of the model limit itself:

1. **Dispatch briefs did not require incremental push.** The slice-1 brief said "commit in coherent steps" but only "push the branch" at the end. Any mid-dispatch termination therefore loses everything, whatever the cause — crash, timeout, limit, operator interrupt. The relaunched slice-2 brief added "commit and push after each numbered step", and that dispatch survived to 2 of 4 steps visible on the remote while still running.
2. **Model-tier routing has no fallback.** `drive/calibration/model-tier.md` routes implementer dispatches to a tier with no stated behaviour when that tier is unavailable. The orchestrator had to improvise a substitution, which silently violated a standing operator instruction ("always use Fable for implementers") rather than surfacing a named fallback.

**What would have caught it earlier.** A DoR item on dispatch briefs requiring push-per-step, and an explicit fallback rule in the model-tier calibration.

**Landed:**
- `drive/calibration/dor.md` — dispatch-DoR overlay: brief must require push-after-each-step.
- `drive/calibration/model-tier.md` — fallback rule + operator-notification requirement when the preferred tier is unavailable.

## 2026-07-30 — Integration Tests flaked on a vitest worker crash

**Trigger:** operator-flagged-surprise class (CI failure with a concrete artefact).

**What happened.** The slice-1 PR's Integration Tests job failed while reporting 1646/1646 tests passed, 276/277 files passed, no type errors. The sole error was `[vitest-pool]: Worker forks emitted error` / `Worker exited unexpectedly`. A re-run of the failed job passed clean.

**Root cause note.** Not diagnosed beyond "worker fork died"; the failing job does not run this project's new tests, and the shell tarball suites live in `test:packages`. Recording it because a green-tests-but-red-job signature is easy to misread as a real regression and expensive to chase.

**Landed:** `drive/calibration/failure-modes.md` — CI failure-mode entry with the recognition signature and the triage step (re-run the failed job before investigating).
