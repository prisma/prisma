# Code review — `agent-native`

> Initial scaffold. The reviewer maintains this document across rounds. The orchestrator and implementer read it but do not edit it (orchestrator owns § Subagent IDs and § Orchestrator notes).

## Summary

- **Current verdict:** D2 R1 — SATISFIED
- **Dispatches SATISFIED:** D1, D2
- **AC scoreboard totals:** 1 PASS (AC-2 test half; live capture pending D3) / 0 FAIL / 2 NOT VERIFIED
- **Open findings:** 0
- **Open escalations:** 0

## Acceptance criteria scoreboard

> Populated from `projects/agent-native/slices/init-skill-install/spec.md § Slice-specific done conditions`. CI-green + reviewer-accept + project-DoD floor are inherited and not restated. Update on every round.

| AC ID | Description (short) | Dispatch | Status | Evidence |
| ----- | ------------------- | -------- | ------ | -------- |
| AC-1 | Real `prisma init` run produces `.claude/skills/prisma-*` and `.agents/skills/prisma-*`; evidence captured | D3 | NOT VERIFIED — round 1 pending | — |
| AC-2 | Simulated install failure leaves init exit 0 with manual-command hint | D2 (tests) + D3 (live) | PASS (tests) — live capture pending D3 | D2 half verified on disk: mocked failure leaves `Init.parse` resolving normally with `console.warn` carrying the manual command (`packages/cli/src/__tests__/Init.vitest.ts`, commit `1f5058f5e`); runner failure shape unit-verified in `skill-install.vitest.ts` (commit `a84a3e46a`) |
| AC-3 | Per-ORM-minor tagging ask filed on prisma/skills, URL recorded | D3 | NOT VERIFIED — round 1 pending | — |

Status values: `PASS` / `FAIL` / `NOT VERIFIED — <reason>` / `ACCEPTED DEFERRAL — <link>` / `OUT OF SCOPE`.

## Subagent IDs

> Persistent implementer + reviewer per project; resumed across every round and dispatch.

- **Implementer:** `a10a394da70c31079` — first spawned D1 R1 (2026-07-03). Dedicated worktree: `/home/aqrln.guest/worktrees/prisma/solid-otter/agent-native-s1`, branch `tml-2968-s1-install-prisma-skills-during-prisma-init`.
- **Reviewer:** `a67a4fd8e8636f291` — first spawned D1 R1 (2026-07-03).

## Findings log

_(no findings yet)_

## Round notes

### D1 R1 — SATISFIED

**Scope:** D1 (skill-install runner module). Commit `a84a3e46a`.

**Tasks:** D1 clean — exports and constants match the spec's Chosen design; per-runner argv (`npx --yes` / `pnpm dlx` / `yarn dlx` / `bunx` + `skills@1.5.14 add prisma/skills --agent cursor claude-code codex windsurf --skill '*' -y`) verified on disk; never-throws holds including detection failures (npm fallback for `manualCommand`); 14 tests cover the named cases non-tautologically; gates trusted green (vitest 14/14, tsc, eslint).

**AC delta:** none (all three ACs are D2/D3-owned). AC-2 evidence annotated: failure-shape substrate unit-verified (commit `a84a3e46a`, `packages/cli/src/__tests__/skill-install.vitest.ts`).

**Findings:** none. Transient-ID scan: zero hits.

**For orchestrator:** (1) Yarn 1 (classic) has no `dlx`: a `yarn/1.x` user agent maps to `yarn dlx …`, which fails — non-fatally, but the printed `manualCommand` is equally broken for those users. The spec fixes the mapping, so this is a spec-amendment candidate (e.g. yarn 1 → npx path) for D2/D3 or a later round, not a D1 finding. (2) The duplicated `isBun` check is module-local (not exported); if D2 dedupes, it touches `Init.ts` anyway and can hoist or export then.

### D2 R1 — SATISFIED

**Scope:** D2 (Init wiring + integration tests) plus yarn-1 side-task per amended spec. Commits `1f5058f5e`, `a891e45dc`.

**Tasks:** D2 clean — `--no-skills` in arg spec and help; `installSkills({ cwd: outputDir })` runs after scaffolding on both the default and PPG-new-project paths; success appends exactly the three summary lines; failure prints the `console.warn` manual-command hint and init completes normally; 4 Init integration tests + snapshot updates verified on disk. Side-task clean — `yarn/1.x` UA routes to `npx --yes` (3 new unit tests incl. manual-command shape); unparseable yarn versions default to modern `dlx`. `isBun` move verified: no external importers of the removed `Init.ts` export. Gates trusted green (vitest 43/43, tsc, eslint).

**AC delta:** AC-2 NOT VERIFIED → PASS (tests) for its D2 half (commit `1f5058f5e`, `packages/cli/src/__tests__/Init.vitest.ts`); live capture pending D3. AC-1, AC-3 unchanged (D3-owned).

**Findings:** none. Transient-ID scan: zero hits (snapshot delta checked: 18 hunks, each exactly the three summary lines). Yarn-1-via-lockfile residual treated as OUT OF SCOPE per orchestrator decision D12.

**For orchestrator:** none.

## Orchestrator notes

- Unattended mode 2026-07-03 → Monday; decisions in `projects/agent-native/unattended-decisions.md`.
