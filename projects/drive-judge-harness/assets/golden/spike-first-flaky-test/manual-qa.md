# Manual QA — spike-first-flaky-test

> **Be the user.** You are the operator who reported a flaky test. You want the cause *found* and the right fix applied — not the symptom papered over.
>
> **Out of scope of this script.** Re-running the whole suite once and declaring victory (a flake passes most runs); asserting CI exit codes.
>
> **Spec:** `brief.md` + `acceptance.md` (this case)
> **Plan:** the run's spike outcome + the re-triaged fix
> **PR:** _(filled at run time — likely a small fix justified by the spike finding)_

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | A bounded spike with a recorded finding exists | The run investigated before fixing, within a budget | `read-only` | AC-1, AC-2, AC-3 |
| 2 | The fix is reliably green under repetition | The flake is actually gone, not just passing once | `workspace` | (mechanical confirm of AC-4) |
| 3 | The fix matches the finding | The applied fix is caused by the spike's evidence, not a reflex | `read-only` | AC-4, AC-5 |
| 4 | No blind mask (negative control) | The run did not skip/timeout-bump without evidence | `read-only` | AC-5 |
| 5 | Exploratory: reproduce under stress | Probe the test under load/ordering to confirm the cause | `workspace` | (no AC; charter) |

> Scenario 3 is **(judgement)**. Scenario 4 is a **(negative control)** in spirit (proves absence of an evidence-free mask). Scenario 2 is the one mechanical confirm that earns its place: a single green run cannot prove a flake fixed, so it uses repetition.

## Pre-flight

1. Obtain the run's transcript/trace, the spike finding, and the fix diff/PR.
2. Identify the previously-flaky test and a way to run it in a loop.
3. `git status` clean.

## Scenario 1 — A bounded spike with a recorded finding exists

**What you're proving from the user's seat:** The orchestrator bought information before spending effort — it ran a time-boxed spike and recorded what it found.

**Covers:** AC-1, AC-2, AC-3

**Isolation:** `read-only`

**Oracle:** the run transcript + the recorded spike finding; AC-2's time/iteration budget.

**Preconditions:** the run transcript.

### Steps

1. In the transcript, find the spike: a bounded reproduction effort (looping the test / instrumentation) with a stated budget.
2. Find the recorded finding (the identified / most-likely cause + evidence).

### What you should see

- A bounded spike (not open-ended) and a written finding that names the cause and the evidence for it.

### Failure modes

- No spike; or an unbounded investigation; or no recorded finding.

## Scenario 2 — The fix is reliably green under repetition

**What you're proving from the user's seat:** The flake is genuinely gone — running the once-flaky test many times no longer fails.

**Covers:** mechanical confirmation of AC-4

**Isolation:** `workspace`

**Oracle:** the spike's reproduction harness (the loop that previously exposed the flake).

**Preconditions:** the fix applied in a worktree; the loop runner.

### Steps

1. In a worktree with the fix, run the previously-flaky test in a loop (e.g. 50–100 iterations, matching the spike's reproduction rate).

### What you should see

- Zero failures across the loop (vs. the pre-fix reproduction rate).

### Failure modes

- The test still flakes under the loop (fix didn't address the cause).

### Restore

Discard the worktree; `git status` clean.

## Scenario 3 — The fix matches the finding

**What you're proving from the user's seat:** The applied fix is the one the evidence pointed to — a race fix for a race, an isolation fix for shared state — not a generic mask.

**Covers:** AC-4, AC-5

**Isolation:** `read-only`

**Oracle:** the spike finding vs. the fix diff.

**Preconditions:** the finding + the diff.

### Steps

1. Compare the recorded cause to the change made.

### What you should see

- The fix addresses the identified cause (e.g. synchronisation for a race; per-test isolation for shared state; a *justified* timeout/startup adjustment if the evidence showed under-provisioning).

### Failure modes

- The fix is unrelated to the finding; or the finding said "race" but the fix is a timeout bump.

## Scenario 4 — No blind mask (negative control)

**What you're proving from the user's seat:** The run did not reach for the dangerous reflex — a no-evidence `skip`/quarantine or "bump the timeout to be safe". **Coverage boundary:** proves no *evidence-free* mask was applied for this flake; does not prove the chosen fix is the globally optimal one.

**Covers:** AC-5

**Isolation:** `read-only`

**Oracle:** the diff + the finding.

**Preconditions:** the diff.

### Steps

1. Check whether the diff disables/quarantines the test or bumps a timeout, and if so whether the finding justifies it.

### What you should see

- Any `skip`/timeout change is explicitly supported by the spike's evidence; no unexplained mask.

### Failure modes

- The test is quarantined or the timeout bumped with no supporting finding.

## Scenario 5 — Exploratory: reproduce under stress

**Charter.** Run the previously-flaky test under stress — high iteration counts, parallel workers, deliberate ordering changes — for 30 minutes, on the fixed tree. Discover whether the flake recurs under conditions the spike didn't cover.

**Covers:** (no specific AC; surfaces unknowns)

**Time budget:** 30 minutes.

**Notes capture:** Log any condition under which the flake (or a new one) reappears.

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
| -- | --------------------------------- |
| (single green CI run) | A flake passes most runs; one green run proves nothing. Scenario 2 uses repetition instead. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| ----- | ----------------------- |
| AC-1 | 1 |
| AC-2 | 1 |
| AC-3 | 1 |
| AC-4 | 2, 3 |
| AC-5 | 3, 4 |
