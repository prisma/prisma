# Code review — `agent-native`

> Initial scaffold. The reviewer maintains this document across rounds. The orchestrator and implementer read it but do not edit it (orchestrator owns § Subagent IDs and § Orchestrator notes).

## Summary

- **Current verdict:** D3 R2 — SATISFIED (slice-final)
- **Dispatches SATISFIED:** D1, D2, D3
- **AC scoreboard totals:** 2 PASS / 0 FAIL / 0 NOT VERIFIED / 1 ACCEPTED DEFERRAL (AC-3)
- **Open findings:** 0
- **Open escalations:** 0 (operator to-do Monday: file the two prepared issues — see `unattended-decisions.md` D14)

## Acceptance criteria scoreboard

> Populated from `projects/agent-native/slices/init-skill-install/spec.md § Slice-specific done conditions`. CI-green + reviewer-accept + project-DoD floor are inherited and not restated. Update on every round.

| AC ID | Description (short) | Dispatch | Status | Evidence |
| ----- | ------------------- | -------- | ------ | -------- |
| AC-1 | Real `prisma init` run produces `.claude/skills/prisma-*`, `.windsurf/skills/prisma-*`, `.agents/skills/prisma-*`, `skills-lock.json`; evidence captured | D3 | PASS | Live capture in `slices/init-skill-install/verification.md § Final captures` (exit 0; 8 skills × 3 dirs = 24 `SKILL.md`; `find -type l` = 0); code claims verified on disk at commit `ca261b483` (`--copy` in `installArgs`, four-line summary in `Init.ts:730`, asserted in `Init.vitest.ts` + 18 snapshots) |
| AC-2 | Simulated install failure leaves init exit 0 with manual-command hint | D2 (tests) + D3 (live) | PASS | Tests: mocked failure leaves `Init.parse` resolving normally with `console.warn` carrying the manual command (`packages/cli/src/__tests__/Init.vitest.ts`, commit `1f5058f5e`); runner failure shape unit-verified in `skill-install.vitest.ts` (commits `a84a3e46a`, `ca261b483`). Live: unreachable-registry run exit 0 with `--copy`-bearing manual command (`verification.md § Final captures`) |
| AC-3 | Per-ORM-minor tagging ask filed on prisma/skills, URL recorded | D3 | ACCEPTED DEFERRAL — `unattended-decisions.md` D14 | Sandbox correctly refused external issue creation under the operator's identity; prepared title + body preserved in `verification.md § Operator to-do` for the operator to file |

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

### D3 R1+R2 — SATISFIED (slice-final)

**Scope:** D3 (end-to-end evidence + externalities); R1 I12 halt (skills@1.5.14 symlink no-op falsified the spec's layout assumption; resolved by decision D13) and R2 resolution. Commit `ca261b483`.

**Tasks:** D3 clean against the amended spec — `--copy` inserted before `-y` in `installArgs` with a why-comment naming the upstream symlink no-op; four-artifact `skillsSummary` (`Init.ts:730`); `skillsCliArgs` fixture and all three failure-shape `manualCommand` assertions updated; Init summary test asserts all four artifacts; live captures (default success, failure path, `--no-skills`) recorded in `verification.md`. Gates trusted green (tsc, vitest 43/43, eslint).

**AC delta:** AC-1 NOT VERIFIED → PASS (commit `ca261b483` + `verification.md § Final captures`). AC-2 PASS (tests) → PASS in full (live failure capture added). AC-3 NOT VERIFIED → ACCEPTED DEFERRAL (`unattended-decisions.md` D14; prepared body in `verification.md`).

**Findings:** none. Transient-ID scan on `ca261b483`: zero hits. Snapshot delta verified: exactly 18 × `+  .windsurf/skills/`, zero removals. Untouched mock `manualCommand` literal in the Init failure test accepted — an opaque injected value testing pass-through printing, not command assembly.

**For orchestrator:** Operator Monday to-do stands — file the tagging ask and the upstream symlink bug from `verification.md § Operator to-do`, then record the URLs.

## Orchestrator notes

- Unattended mode 2026-07-03 → Monday; decisions in `projects/agent-native/unattended-decisions.md`.
