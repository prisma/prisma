# Brief: QA Run dispatch (post-slice manual-QA execution)

**Skill:** `drive-qa-run` (read [`.claude/skills/drive-qa-run/SKILL.md`](../../../.claude/skills/drive-qa-run/SKILL.md) before starting; treat it as the binding spec for what you produce).

**Project context overlay:** [`drive/qa/README.md`](../../../drive/qa/README.md). Read it. Note especially the standard pre-QA gate (`pnpm typecheck && pnpm test:packages && pnpm fixtures:check`) and the where-QA-artefacts-live convention.

**Slice DoD invariant (`SDoD4` in the slice spec):** the slice's PR cannot satisfy DoD without `manual-qa.md` + ≥1 run report. Your output is the report. **You are not the script author** and the script author is not you — `drive-qa-run § Author-bias` explicitly requires a separate agent invocation, and you've been dispatched as that separate invocation.

---

## What to execute

[`projects/facade-import-surface-completion/manual-qa.md`](../manual-qa.md) — 789 lines, 8 scenarios, AC-1 through AC-8 with a sign-off coverage map. Execute end-to-end per `drive-qa-run § Workflow`.

## What to produce

A run report at `projects/facade-import-surface-completion/manual-qa-reports/2026-05-21-<your-runner-id>.md`, structured per `drive-qa-run § The report skeleton`. Use a runner handle that identifies you (e.g. `claude-opus-runner-1`). Findings live there; severity, disposition map, and verdict all live there.

## Mandatory inputs to read before executing

1. **The script in full**: `projects/facade-import-surface-completion/manual-qa.md`. Per `drive-qa-run § Step 1`, read it end-to-end before running anything. Note isolation tags, dependency edges, time budgets for the exploratory charter.
2. **Canonical skill body**: `.claude/skills/drive-qa-run/SKILL.md`. The severity rubric, the disposition-map requirement, the verdict policy, the parallelism contract — all binding.
3. **Project-context overlay**: `drive/qa/README.md`.
4. **Optional but useful for severity calibration**: `drive/calibration/failure-modes.md § QA coverage-gate gaps` and `drive/calibration/dod.md`.

## Operational constraints

- **Do NOT modify the script.** If you find script defects (stale step, missing tag, wrong file path), file them as 📝 Follow-up findings against `drive-qa-plan` in your report. The script stays clean.
- **Capture observations verbatim.** Per `drive-qa-run § Common Pitfalls #2`, paste actual command + actual output, not paraphrases.
- **Capture artefacts immediately on each finding** (per § Common Pitfalls #4). Copy mutated files into `projects/facade-import-surface-completion/manual-qa-reports/artefacts/F-N/` *before* tearing down the source worktree/tmpdir.
- **Parallelise per isolation tags** (per § Key Concepts). Default concurrency cap 5; cap `external` at 2. Workspace scenarios get `git worktree add --detach $PN_QA_WORKTREES/scenario-N HEAD`; tmpdir scenarios get `$PN_QA_TMP/scenario-N`. Read-only scenarios share the workspace.
- **Stop dispatching new scenarios on 🛑 Blocker** (per § Workflow Step 4). Let in-flight scenarios complete; mark un-dispatched ones in the per-scenario log.
- **Disposition map is non-optional.** Every finding gets one of 🔧 fix-in-PR / 🎫 ticket / ⏳ post-merge / ❌ accepted-as-is / ✅ resolved. Empty disposition cells = triage incomplete = 🔍 Triage required verdict regardless of severity distribution.

## Context the script author flagged (not in the script itself)

The plan subagent surfaced 5 procedural / calibration findings that did NOT go into the script (since the script is the test plan, not the report):

1. **`pnpm prisma-next init` doesn't list `sqlite` as a `--target` option** — only `postgres` and `mongodb`. Possible follow-up; you may probe this incidentally during scenario 1 if `init` is in your path.
2. **Scenario 4's static-types probe is awkward without a vitest harness.** The script documents both `expectTypeOf` (in-tmpdir vitest) and editor-LSP routes; pick whichever runs cleanly in your context. Document which you used.
3. **Slice spec edge-case table predates D5e deferral.** Not blocking; calibration only.
4. **PR description omits `pnpm fixtures:check` in its Verification list.** Calibration only; the pre-QA gate in `drive/qa/README.md` includes it — run it as part of your pre-flight regardless.
5. **789-line script vs `drive-qa-plan`'s 300-500 guideline.** Calibration question for the planner skill; doesn't affect your run.

These are calibration context. If your run surfaces matching evidence (e.g. you incidentally hit the `init` SQLite gap), upgrade the relevant finding from "calibration note" to "📝 Follow-up" in your report's Findings section with a proposed disposition.

## Heartbeats + completion

- Write a heartbeat to `wip/heartbeats/qa-run.txt` every ~5 min: current scenario (or "pre-flight"), DAG state (ready / in-flight / completed counts), wallclock elapsed, findings count by severity, blockers.
- On completion, your final message to the orchestrator must include:
  - Report path.
  - Verdict (✅ Pass / 🔍 Triage required / ❌ Fail).
  - Total findings by severity (e.g. "🛑 0 / ⚠️ 1 / 📝 3").
  - The disposition map verbatim (so the orchestrator can confirm/override dispositions without opening the report).
  - Any scenarios that were un-dispatched (with blocking finding IDs).
  - The exploratory charter's wallclock + notes summary.
- If verdict is ❌ Fail or 🔍 Triage required: do NOT soften the hand-off. Lead with what's broken or what awaits orchestrator confirmation. The orchestrator routes from there.

## Tear-down

After the report is saved:
- `git worktree remove --force $PN_QA_WORKTREES/scenario-N` for each scenario.
- Remove `$PN_QA_TMP/*`.
- Confirm `git status` in the original workspace is clean (no leaked files).
- The user's checkout must be left in the same state you found it.

## Done-when gates

- [ ] Report at `projects/facade-import-surface-completion/manual-qa-reports/2026-05-21-<runner-id>.md`.
- [ ] Every scenario in the script appears in the per-scenario log (✅ pass / ❌ fail / ⏸ not dispatched with reason).
- [ ] Every finding has a proposed disposition (🔧 / 🎫 / ⏳ / ❌ / ✅ resolved).
- [ ] Coverage outcome table walks every AC the script's coverage map enumerates.
- [ ] Verdict in the header keys off the disposition map per § Step 5.
- [ ] Worktrees torn down; tmpdirs cleaned; user's checkout left clean.
- [ ] Did NOT edit the script in place.
- [ ] Did NOT use "✅ Pass-with-follow-ups" as a verdict.
