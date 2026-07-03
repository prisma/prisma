# Code review — `agent-native`

> Initial scaffold. The reviewer maintains this document across rounds. The orchestrator and implementer read it but do not edit it (orchestrator owns § Subagent IDs and § Orchestrator notes).

## Summary

- **Current verdict:** S2-D3 R1 — SATISFIED (slice-final; slice 2 at DoD)
- **Dispatches SATISFIED:** S1: D1, D2, D3 (slice-final) — S2: D1, D2, D3 (slice-final)
- **AC scoreboard totals:** 5 PASS / 0 FAIL / 0 NOT VERIFIED / 1 ACCEPTED DEFERRAL (AC-3)
- **Open findings:** 0
- **Open escalations:** 0 (operator to-do Monday: file the two prepared issues — see `unattended-decisions.md` D14)

## Acceptance criteria scoreboard

> Populated from `projects/agent-native/slices/init-skill-install/spec.md § Slice-specific done conditions`. CI-green + reviewer-accept + project-DoD floor are inherited and not restated. Update on every round.

| AC ID | Description (short) | Dispatch | Status | Evidence |
| ----- | ------------------- | -------- | ------ | -------- |
| AC-1 | Real `prisma init` run produces `.claude/skills/prisma-*`, `.windsurf/skills/prisma-*`, `.agents/skills/prisma-*`, `skills-lock.json`; evidence captured | D3 | PASS | Live capture in `slices/init-skill-install/verification.md § Final captures` (exit 0; 8 skills × 3 dirs = 24 `SKILL.md`; `find -type l` = 0); code claims verified on disk at commit `ca261b483` (`--copy` in `installArgs`, four-line summary in `Init.ts:730`, asserted in `Init.vitest.ts` + 18 snapshots) |
| AC-2 | Simulated install failure leaves init exit 0 with manual-command hint | D2 (tests) + D3 (live) | PASS | Tests: mocked failure leaves `Init.parse` resolving normally with `console.warn` carrying the manual command (`packages/cli/src/__tests__/Init.vitest.ts`, commit `1f5058f5e`); runner failure shape unit-verified in `skill-install.vitest.ts` (commits `a84a3e46a`, `ca261b483`). Live: unreachable-registry run exit 0 with `--copy`-bearing manual command (`verification.md § Final captures`) |
| AC-3 | Per-ORM-minor tagging ask filed on prisma/skills, URL recorded | D3 | ACCEPTED DEFERRAL — `unattended-decisions.md` D14 | Sandbox correctly refused external issue creation under the operator's identity; prepared title + body preserved in `verification.md § Operator to-do` for the operator to file |
| AC-4 | Live TTY once-ever demo: first `prisma generate` shows the offer, declining writes `skills-offer.json`, second run silent; captured | S2-D3 | PASS | Live pty capture in `slices/generate-skill-offer/verification.md` (decline → `outcome: "declined"` ack; second run silent, exit 0); prompt text and persistence shape match code verified at `9966964c1` (`skills-offer.vitest.ts`) |
| AC-5 | Accept path demonstrated live: skills land via S1 runner | S2-D3 | PASS | Live capture: accept → 24 `SKILL.md` (8 × `.agents`/`.claude`/`.windsurf`) + `skills-lock.json`, ack `outcome: "accepted"` (`verification.md`); matches S1 `--copy` behavior and the ack→install ordering verified at `9966964c1` |
| AC-6 | Non-TTY / CI-env run shows no prompt (capture) | S2-D3 | PASS | Live non-TTY capture: no prompt, generate normal, no acknowledgement written (`verification.md`); matches code — gate short-circuits precede any `writeAcknowledgement`, per the spec's after-prompt-only persistence |

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

### S2-D1 R1 — SATISFIED

**Scope:** S2-D1 (offer module + shared timeout helper), branch `tml-2971-s2-one-time-skill-offer-on-prisma-generate` stacked on `ca261b483`. Commit `9966964c1`.

**Tasks:** S2-D1 clean — gate chain matches the spec order exactly (ack file → already-installed with `already-installed` ack write → interactive → Deno → CI → git hook → npm hook → container → `daysSinceFirstCommand >= 1`); prompt text, 30s timeout-to-No, and four-outcome `skills-offer.json` persistence as specced; accept path calls S1 `installSkills({ cwd })` with init's warning pattern; `skills_offer_resolved { outcome, cliVersion }` fires only when prompted; `timeout()` extracted verbatim to `utils/prompt-timeout.ts` with `survey.ts` touched for the import swap only (`createSafeReadlineProxy` was already exported). 27 tests verified on disk, non-tautological (real fs, injected prompt/capture/runner, fake-timer timeout with timer-count guard). Gates trusted green (vitest 27/27, jest nps 14/14, tsc, eslint).

**AC delta:** none promoted (AC-4..6 are S2-D3-owned; rows added with substrate evidence).

**Findings:** none. Transient-ID scan on `9966964c1`: zero hits.

**For orchestrator:** For S2-D3 planning, the implementer's observation matters: `loadOrInitializeCommandState` writes `commands.json` without creating the config dir, so the isolated `env-paths` dir used for live captures must be pre-created — otherwise the state loader rejects and the days gate silently suppresses the demo prompt.

### S2-D2 R1 — SATISFIED

**Scope:** S2-D2 (Generate wiring + mutual exclusion). Commit `744539ec0`.

**Tasks:** S2-D2 clean — `skillsOfferHandler` constructor param defaults to `handleSkillsOffer`, mirroring the adjacent `surveyHandler` seam; sole call site sits inside the existing `!hideHints` guard in the non-watch success path, offer first, survey only when `prompted === false` (`Generate.ts:274-281`); watch branch structurally never reaches the block and the new watch test pins it. Four tests replace the two survey tests with no coverage loss (survey-called-when-hints-enabled is subsumed by the ordering assertion `['offer', 'survey']`; not-called-with-`--no-hints` is extended to both handlers) plus two new behaviors (prompted → survey skipped; watch → neither). All four inject both handlers; the module-wide `Watcher` mock is exercised only by the watch test — no other test in the file constructs a `Watcher`. Gates trusted green (jest Generate 42/42, jest nps 14/14, tsc, eslint).

**AC delta:** none promoted (AC-4..6 are S2-D3-owned; reasons updated to "S2-D3 pending").

**Findings:** none. Transient-ID scan on `744539ec0`: zero hits.

**For orchestrator:** none.

### S2-D3 R1 — SATISFIED (slice-final)

**Scope:** S2-D3 (live TTY evidence; no code changes). Worktree verified clean, branch `tml-2971-s2-one-time-skill-offer-on-prisma-generate` unchanged at `744539ec0` (`9966964c1` → `744539ec0` atop S1's `ca261b483`).

**Tasks:** Evidence in `slices/generate-skill-offer/verification.md` cross-checks against the code verified in S2-D1/D2 with no inconsistency: prompt text verbatim from `promptForInstall`; decline/accept acks match the persistence shape and ack→install ordering; second-run silence matches the ack-file gate; accept lands 24 `SKILL.md` + `skills-lock.json` per S1's `--copy`; both environment traps (pre-created `prisma-nodejs` config dir, aged `commands.json`) applied; container/CI gates verified against real implementations. The no-ack-on-gated-out nuance is blessed: the spec ties persistence to prompt resolution (or already-installed), so gated-out runs correctly leave the offer available. The cosmetic install-output-before-summary ordering is expected from `Generate.parse` returning the message for the caller to print.

**AC delta:** AC-4, AC-5, AC-6 NOT VERIFIED → PASS (`verification.md` + commits `9966964c1`/`744539ec0`). Slice 2 at DoD.

**Findings:** none. No new commits — worktree/branch check performed in lieu of the transient-ID scan.

**For orchestrator:** The captures' NPS silence is partly environmental (no active NPS timeframe remotely); mutual exclusion rests on the S2-D2 unit tests, which I judge adequate — no live NPS-collision capture needed.

## Orchestrator notes

- Unattended mode 2026-07-03 → Monday; decisions in `projects/agent-native/unattended-decisions.md`.
