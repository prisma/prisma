# Drive trial — findings

> **Trial window:** 2026-05-19 → 2026-06-02. See [`drive/trial.md`](../trial.md) for the quality bar, tags, and format. Record only what meets the bar — `friction`, `gap`, `win`, `surprise`, `boundary`. One stanza per finding.

## 2026-05-20 · drive-pr-description · boundary

A PR-open specialist was dispatched before the orchestrator finalised the branch name (a methodology shift mid-project triggered a branch rename). The specialist opened PR #540 against the about-to-be-renamed branch; the PR was immediately stale and had to be closed; PR #541 then opened cleanly against the correct branch.

**Suggested action:** added a "branch identity must be settled before PR open" section to `drive/pr/README.md` (project-context). Orchestrator should re-state branch name + Linear ticket in the first heartbeat of any PR-open dispatch brief so any drift since brief authoring is caught before `gh pr create` fires.

**Upstream candidate?** Maybe — the pattern is general but the team's specific orchestration of project ↔ branch identity may vary across teams.
