# Retros — facade-import-surface-completion

## 2026-05-21 · Orchestrator skipped `drive-qa-plan` + `drive-qa-run` before opening PR #557

**Trigger:** Operator-flagged surprise. After the orchestrator declared the slice "code-complete" post-D6 and opened PR [#557](https://github.com/prisma/prisma-next/pull/557), the operator asked "did you perform the QA workflow already?" The honest answer was no — neither `manual-qa.md` (script) nor a `manual-qa-reports/<date>-<runner>.md` (run report) existed in the project.

**What happened:**

- D6 (docs-only sweep + mongo workaround comments) closed cleanly. Reviewer verdict on `reviews/code-review.md` recorded `READY FOR PR`.
- The orchestrator pattern-matched on `reviewer SATISFIED + AC scoreboard clean` → `branch is ready for PR-opening skill`, and ran the `create-pr` skill's checklist verbatim: detect base, write body, DCO signoffs (`git rebase --signoff $(git merge-base main HEAD)`), push, `gh pr create`.
- At no point did the orchestrator re-read the slice spec's [`Slice Definition of Done`](slices/facade-completion/spec.md#slice-definition-of-done) checklist. **SDoD4** explicitly required `projects/facade-import-surface-completion/manual-qa.md` + ≥1 run report. That gate was skipped, and the PR opened on a slice whose DoD was not satisfied.
- The operator caught the miss in the same session and asked the orchestrator to run the QA workflow now (post-PR-open, before any merge consideration).

**Root cause:** Two layered failures.

1. **Canonical gap in `drive-build-workflow § Post-conditions`** (the workflow skill the orchestrator was driving). The post-conditions enumerate reviewer-driven gates (`Each milestone identified by the plan has reached SATISFIED`; `AC scoreboard records every spec AC as PASS …`; `The branch is ready for the team's PR-opening skill`). They do **not** require an explicit walk of the slice-DoD checklist before declaring the branch PR-ready. Yet the same skill body's opening paragraph lists `drive-qa-plan` and `drive-qa-run` as atomic skills the workflow calls. The skill knows the QA steps exist; it doesn't gate on them.
2. **Local protocol miss.** Even with the canonical gap, the orchestrator's own slice-close ritual should have walked the slice-DoD checklist verbatim — particularly the items that sit outside the reviewer's purview (SDoD4: manual-QA; SDoD6: no `projects/` refs in long-lived files). The orchestrator treated the reviewer's verdict as proxy for the whole DoD instead of a partial one, and that pattern repeats across recent slices in the codebase.

The root failure is upstream of the proximate "the orchestrator forgot": the calling workflow doesn't structurally fire the QA-walk before handoff, and the local calibration didn't compensate.

**Landing surface(s):**

- **Project-context (landed in this commit):** [`drive/calibration/dod.md` § Slice-DoD overlay](../../drive/calibration/dod.md) gains an explicit "the orchestrator walks the SDoD checklist verbatim before handoff to the PR-opening skill" note under the `### QA-side items` block, with a one-line reference to this retro as the triggering event.
- **Trial-period findings (landed in this commit):** entries appended to [`drive/qa/findings.md`](../../drive/qa/findings.md) and [`drive/retro/findings.md`](../../drive/retro/findings.md), tagged `gap` and `boundary` respectively. The QA-side entry frames the gap as a `drive-build-workflow` post-condition omission; the retro-side entry frames it as a boundary issue between `drive-build-workflow` and `create-pr`.
- **Canonical (proposed, pending operator confirmation):** tighten `drive-build-workflow § Post-conditions` so that "the branch is ready for the team's PR-opening skill" is gated on a slice-DoD checklist walk that explicitly enumerates the non-reviewer items (manual-QA script + ≥1 run report; `projects/` ref scrub; any other SDoD items the slice spec lists outside `SDoD3` reviewer-verdict scope). Not landed unilaterally — canonical edits cross repos via `drive-update-skills`, and the operator should sign off on the wording before it propagates.

**Post-retro work in progress (this retro will be amended once complete):**

- QA-plan subagent dispatched (model `claude-opus-4-7-thinking-high`, fresh context per `drive-qa-run § Author-bias`) to author `projects/facade-import-surface-completion/manual-qa.md`.
- QA-run subagent fires after the plan subagent completes; a different agent instance per the same author-bias rule.
- If the run surfaces additional procedural lessons (e.g. the script reveals an under-tested user audience), this retro entry will be amended with the further landing surfaces. The current entry covers the protocol miss itself; the run's report (if it produces 🔍 Triage or ❌ Fail findings) will live in `manual-qa-reports/<date>-<runner>.md`, separate from this retro.
