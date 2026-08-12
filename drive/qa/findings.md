# Drive trial — findings

> **Trial window:** 2026-05-19 → 2026-06-02. See [`drive/trial.md`](../trial.md) for the quality bar, tags, and format. Record only what meets the bar — `friction`, `gap`, `win`, `surprise`, `boundary`. One stanza per finding.

## 2026-05-20 · drive-qa-plan · gap

Manual-QA dry-run sampled preamble *placement* (right line, right format, cross-link resolves) across 19 atomic skills — found nothing wrong. Reviewer (CodeRabbit) then surfaced three "critical" findings on stop-condition *coherence*: the uniform delegated-execution preamble's "STOP. Dispatch on Read/Grep/Glob" rule contradicted multiple skill bodies whose Step 2 required Read/Grep investigation. Placement-sample missed it; coherence-sample would have caught it.

**Suggested action:** added a "sample coherence, not just placement" section to `drive/qa/README.md` (project-context). When manual-QA covers a preamble/boilerplate insertion across many files, sample both placement *and* coherence-with-each-file's-body via a 2-3 file deep-read pass.

**Upstream candidate?** Yes — the coherence-vs-placement distinction generalises to any manual-QA dispatch covering uniform insertions across many files.

## 2026-05-21 · drive-qa-plan + drive-qa-run · gap

Orchestrator skipped the QA workflow entirely on the TML-2526
facade-completion slice: declared the slice "code-complete" after the
reviewer returned `READY FOR PR` on `reviews/code-review.md` and opened
PR #557 without ever invoking `drive-qa-plan` or `drive-qa-run`. The
slice spec's SDoD4 explicitly required both. The miss was caught by the
operator, not by the workflow.

The root gap is in the calling workflow (`drive-build-workflow §
Post-conditions`): the post-conditions enumerate reviewer-driven gates
but do not require an explicit walk of the slice-DoD checklist before
declaring the branch PR-ready. `drive-qa-plan` and `drive-qa-run` are
named as atomic skills the workflow calls, but nothing structurally
fires them before handoff to the PR-opening skill — so an orchestrator
that pattern-matches on "reviewer SATISFIED → open PR" misses the QA
items every time.

**Suggested action:** tighten `drive-build-workflow § Post-conditions`
to gate "the branch is ready for the team's PR-opening skill" on an
explicit slice-DoD checklist walk that enumerates the items outside
the reviewer's purview — at minimum `drive-qa-plan` script + ≥1
`drive-qa-run` report, plus the `projects/`-ref scrub. Mirror the
calibration entry already in `drive/calibration/dod.md § Slice-DoD
overlay § QA-side items` directly into the workflow's post-condition
check.

**Upstream candidate?** Yes — affects every consumer of
`drive-build-workflow`. The omission is structural, not specific to
this team's repo.

See [drive/retro/findings.md § 2026-05-21](../retro/findings.md) for the related retro finding.
