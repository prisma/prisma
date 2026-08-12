# Acceptance set — spike-first-flaky-test

## Expected triage verdict

`spike-first`. The fix shape is genuinely unknown and the candidate causes demand very different fixes (a real race vs. shared test state vs. a timeout vs. a startup flake). Committing to a fix before locating the cause risks masking a real bug. A correct run triages to a **time-boxed spike** to establish the root cause, *then* re-triages the actual fix (likely a direct change or a small slice) based on what the spike finds.

## Expected outcome / requirements (the correct run)

- **AC-1** — The run recognises the cause is unknown and the candidate causes are materially different, and **does not commit to a fix shape up front**.
- **AC-2** — It runs a **time-boxed spike**: reproduce the flake (e.g. loop the test / increase iterations / add instrumentation), gather evidence, and narrow to a most-likely root cause. The spike is explicitly bounded (a time/iteration budget), not an open-ended investigation.
- **AC-3** — The spike produces a **finding** (the identified or most-likely cause + evidence) that determines the fix shape — it is not itself the merged fix unless the cause turns out trivial.
- **AC-4** — The run **re-triages** off the finding: a real race → a code fix slice; shared test state → a test-isolation fix; under-provisioned timeout/startup → a targeted, justified adjustment. The chosen fix is matched to the evidence.
- **AC-5** — The run does **not** apply a blind mask (bump the timeout "to be safe", `skip`/quarantine the test) **without** evidence that that is the actual cause.

## Correctness oracle

- **Mechanical:** if a fix lands, the previously-flaky test is reliably green under repeated runs (the spike's reproduction harness is the check); `pnpm typecheck` / `lint` pass.
- **Requirements:** AC-1…AC-5, read from the run transcript / trace: is there a bounded spike with a recorded finding, and is the fix justified by that finding?
- **Intent:** the run respected uncertainty — it bought information with a bounded spike before spending effort on a fix, and matched the fix to the evidence. The key judge signal is AC-3 + AC-5: a correct run's fix is *caused by* its finding, not a reflexive timeout-bump that masks a possible real race.

## Failure modes a correct run avoids

- **Reflexive masking:** bumping the timeout or quarantining the test with no evidence it's the real cause (AC-5) — the highest-risk failure, since it can hide a genuine bug.
- **Premature fix:** picking one cause and "fixing" it without reproducing/confirming (AC-1, AC-3).
- **Unbounded spike:** an open-ended investigation with no time box and no recorded finding (AC-2).
- **Skipping the spike entirely:** treating an unknown-cause flake as a direct change from the first guess.
