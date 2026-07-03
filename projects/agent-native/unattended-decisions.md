# Unattended decisions — agent-native

Operator instruction (2026-07-03 ~15:40 UTC): "work unattended and record any decisions you
make. I'll check on you on Monday." Decisions the orchestrator made without the operator are
logged here, newest last.

## 2026-07-03

- **D1 — Decision-log location.** `drive-check-health` names `wip/unattended-decisions.md` as
  the unattended-decisions surface, but the orchestrator file-write boundary is
  `projects/<project>/` and this repo has no `wip/` convention. Logging here
  (`projects/agent-native/unattended-decisions.md`) instead.
- **D2 — Proceed-to-build policy.** The operator's "work unattended" is taken as standing
  authorization to proceed from recommended-next-pick into `drive-build-workflow` without
  per-slice confirmation (the policy gate in `drive-check-health` § Step 5). Halt points
  remain: scope shifts (promote/demote/spec amendment) and project close-out.
- **D3 — TML-2972 closed.** PR prisma/prisma#29684 merged 2026-07-03 13:48 UTC (approved);
  marked TML-2972 Done and treat S3 (TML-2969) as unblocked. Not a judgment call, but recorded
  since the operator last saw it "in review".
- **D4 — Slice branch discipline.** Slice work happens on branches cut from `origin/main`
  (Linear-derived names, e.g. `tml-2968-...`), implemented by dispatched subagents in isolated
  worktrees, so this session's checkout stays on `agent-native-spec` where the project
  workspace lives. Slice PRs target `main` and do not include `projects/` or `drive/` files.
- **D5 — S2 stacking.** If S1's PR is still unmerged when S2 becomes the next pick, S2 is
  authored stacked on S1's branch (PR base = S1's branch, retargeted to `main` after S1
  merges). Weekend review latency makes waiting-for-merge equivalent to halting; stacking is
  reversible.
- **D6 — "Delivered" over the weekend = PR open.** Slice PRs cannot merge without human
  review; `slice-completed` (result "merged") is only emitted on actual merge. The weekend
  goal is: every unblocked slice at DoD with a PR open. Per-slice-merge health checks convert
  to per-PR-open checks (recorded cadence deviation).
- **D7 — Workspace commit cadence.** `projects/agent-native/` updates (trace, rollups, this
  log) are batch-committed to `agent-native-spec` and pushed at checkpoints (slice PR opened,
  session end), so the operator can follow progress from PR #29688 without waiting for
  Monday.
- **D8 — S1 installs from the prisma/skills default branch.** The task draft sketched runtime
  tag-resolution (`#v<matching-tag>` with fallback); no such tags exist yet, so the runtime
  check would always take the fallback while adding a network probe to init. S1 ships
  default-branch installs and files the tagging ask; pinning activates in a follow-up once
  tags exist. Recorded in the slice spec's Chosen design.
