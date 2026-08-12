# Drive: project-context memory for prisma-next

This directory is **prisma-next's home for project-context Drive memory** — the team's accumulated lessons, calibrations, and conventions overlaid onto the canonical Drive skill bodies.

Per the **protocol-as-memory** architecture, the methodology has two memory homes:

- **Canonical skill bodies** (in `.agents/skills/drive-*/SKILL.md`, eventually pulled from upstream `prisma/ignite`). Portable methodology — the protocol every team adopts.
- **Project context** (here). Team-specific protocol — the calibration the team has accumulated, plus the operational conventions for integrating Drive with the team's tracker, branch conventions, and tooling.

Both are loaded by drive-* skills at workflow entry. Both are human-readable and human-runnable (workflow vs atomic skill tiers — operators can run steps manually without invoking skills). A team member who hasn't invoked a single drive-* skill can read these directly to consult the team's protocol.

## Calibration (cross-cutting)

[`calibration/`](calibration/README.md) is the **single home for the team's accumulated calibration** — sizing anchors, model-tier routing, DoR / DoD overlays at every scope, the failure-mode catalogue, the grep library, and the patterns the team has learnt to recognise. Calibration is cross-cutting (one failure mode informs multiple categories' overlays), so it lives in one place rather than smeared across the category READMEs.

Every category README links out to the relevant calibration files; skills load both.

## Category READMEs (operational conventions)

Each category README documents how this team operates the matching skill — the per-team conventions that don't shift with retro accretion the way calibration does.

| Category | Loaded by | Holds (operational) | Links to (calibration) |
|---|---|---|---|
| [`triage/`](triage/README.md) | `drive-triage-work`, `drive-start-workflow` | Ticket-shape patterns, "direct change vs slice in this repo" rules, Linear-sync conventions, promote / demote ceremony | `calibration/sizing.md` |
| [`spec/`](spec/README.md) | `drive-specify-project`, `drive-specify-slice` | Required sections beyond template | `calibration/patterns.md`, `calibration/failure-modes.md`, `calibration/dor.md`, `calibration/dod.md` |
| [`plan/`](plan/README.md) | `drive-plan-project`, `drive-plan-slice`, `drive-build-workflow` | Plan-shape conventions (file paths, dispatch-brief layout) | All of `calibration/` |
| [`project/`](project/README.md) | `drive-create-project`, `drive-close-project`, `drive-deliver-workflow`, `drive-plan-project` | Linear conventions, status-update cadence, ADR cadence, close-out destinations | `calibration/dor.md`, `calibration/dod.md`, `calibration/patterns.md` |
| [`pr/`](pr/README.md) | `drive-pr-description`, `drive-pr-walkthrough` | PR-title / body conventions, walkthrough conventions, Linear-issue conventions, Linear state conventions, commit-style rules | `calibration/dod.md` |
| [`qa/`](qa/README.md) | `drive-qa-plan`, `drive-qa-run` | Substrate locations, standard pre-QA gate, where QA artefacts live, when to mark N/A | `calibration/patterns.md`, `calibration/failure-modes.md`, `calibration/dod.md` |
| [`retro/`](retro/README.md) | `drive-run-retro` | Team-specific retro prompts, landing-surface preferences | (Retros *update* calibration, don't read from it) |
| [`health/`](health/README.md) | `drive-check-health`, `drive-deliver-workflow` | Drift-signal thresholds, pick-next heuristics, throughput baselines | `calibration/sizing.md` |

## Reconciliation loop

Lessons accumulate in `calibration/` from `drive-run-retro` invocations. When a lesson generalises across teams, it gets promoted to canonical via `drive-update-skills`. When a canonical body changes upstream, `drive-reconcile-skills` flags overlays that may now be redundant or contradictory.

The split between canonical (portable) and project-context (team-specific) is the load-bearing protocol-as-memory architecture. Don't move team-specific things into canonical; don't keep cross-team things only in project-context.
