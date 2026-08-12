# drive/plan — project-context for plan authoring

Loaded by `drive-plan-project`, `drive-plan-slice`, and `drive-build-workflow`. This category has almost no operational content of its own — plan authoring is calibration-heavy by nature. The plan-shape conventions for prisma-next live next to the team's calibration, in [`drive/calibration/`](../calibration/).

> **Trial period in effect (ends 2026-06-02).** When any drive-* skill in this category produces a finding, record it in [`findings.md`](./findings.md). Quality bar, tags, and format live in [`drive/trial.md`](../trial.md).

## Calibration

Plan authoring reads all of:

- [`drive/calibration/sizing.md`](../calibration/sizing.md) — dispatch-sizing reference anchors + parallelisation heuristics
- [`drive/calibration/model-tier.md`](../calibration/model-tier.md) — which dispatch shapes go to which model tier
- [`drive/calibration/dor.md`](../calibration/dor.md) — slice-DoR + dispatch-DoR overlays (plan-side items live there)
- [`drive/calibration/dod.md`](../calibration/dod.md) — dispatch-DoD validation gates + dispatch-DoD + slice-DoD overlays
- [`drive/calibration/failure-modes.md`](../calibration/failure-modes.md) — failure-mode catalogue (briefs thread relevant entries into edge-case tables; includes stop-conditions for `drive-build-workflow`)
- [`drive/calibration/grep-library.md`](../calibration/grep-library.md) — grep patterns (briefs thread relevant entries as "Done when" gates)

`drive-plan-project` additionally reads [`drive/calibration/patterns.md § Slice-composition patterns`](../calibration/patterns.md#slice-composition-patterns) for project decomposition.

## Plan-shape conventions (operational)

These are stable per-team conventions about how plans are organised — independent of which calibration entries a given plan references.

- Slice plans live at `projects/<project>/slices/<slice>/plan.md` (in-project) or inline in the PR description (orphan slice).
- Dispatch briefs are siblings of the slice plan: `projects/<project>/slices/<slice>/dispatches/<NN>-<slug>.md` (numbered to preserve sequence) or inline in the slice plan's "Dispatches" section for short plans.
- Spike artefacts live at `projects/<project>/spikes/<date>-<question>.md`.
- The project plan (`projects/<project>/plan.md`) references each slice by Linear issue ID + folder path.

## When this file changes

Append (rarely; this file is meant to stay small):

- A new plan-shape convention emerges from a retro (e.g. "we standardised on numbered dispatch files").
- A new skill joins the plan family and loads this README.

For calibration changes (sizing anchors, failure modes, grep patterns, model-tier routing, DoR/DoD overlays), edit the matching file under [`drive/calibration/`](../calibration/) — never duplicate calibration here.
