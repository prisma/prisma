# CI-fix brief — turn all 4 CI reds green on PR #557

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Current HEAD:** `ceaa0d9ab` (origin and local aligned)
**PR:** https://github.com/prisma/prisma-next/pull/557
**CI workflow run:** `https://github.com/prisma/prisma/actions/runs/26270756097`

The branch is mergeable (no conflicts) and DCO is green. Four CI checks are red:

| Check | Job ID | Class |
|---|---|---|
| Type Check | 77323456121 | Real — needs fix in this PR |
| Integration Tests | 77323643025 | Mixed — one real regression in this PR, plus likely flakes |
| Test | 77323643031 | Likely PGlite flake class |
| Coverage | 77323643030 | Likely PGlite flake class |

Your job: turn all four green (or definitively establish flake/pre-existing and document accordingly). One push at the end.

## Reproducing the failures locally

For each failed job, pull the log via `gh run view --job <id> --log-failed` to see the exact errors. The orchestrator's initial triage is below — verify it, don't trust it blindly.

## Failure 1 — Type Check (CONFIRMED real, in-scope fix needed)

**Errors observed in CI log:**

```
test/contract-builder/define-contract.test-d.ts(2,46): error TS2307: Cannot find module '@internal/postgres/contract-builder' or its corresponding type declarations.
test/contract-builder/define-contract.test.ts(1,46): error TS2307: Cannot find module '@internal/postgres/contract-builder' or its corresponding type declarations.
test/migration/re-export.test.ts(1,34): error TS2307: Cannot find module '@internal/postgres/migration' or its corresponding type declarations.
```

These three test files live at `packages/3-extensions/postgres/test/{contract-builder,migration}/`. They were added by this PR to verify the new subpaths re-export correctly. They typecheck locally only if `pnpm build` has been run first to refresh `dist/*.d.mts` (per the AGENTS.md golden rule).

The CI `Type Check` job (`.github/workflows/ci.yml`) does:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter prisma-orm-demo prisma:generate`
3. `pnpm typecheck:packages`
4. `pnpm typecheck:examples`

No `pnpm build` step.

**Investigation tasks (read-only first):**

1. Read `.github/workflows/ci.yml` in full. How is `Type Check` configured? Does the `Build` job already run and is the `dist/` cached and restored for the `Type Check` job? Or do the two jobs run on separate runners with no shared filesystem?
2. Read `turbo.json`. Does the `typecheck` task already declare `dependsOn: ["^build"]` or similar? If so, why isn't it propagating to the failing tests?
3. Check `origin/main`'s recent `Type Check` runs (`gh run list --branch main --workflow ci.yml --limit 5`). Were they all green? If yes, what makes them work and our PR not — is it because our PR introduces *new* subpaths that need a build step to materialize? If no, this is a pre-existing CI bug.
4. Look at how the other facade packages' new subpaths typecheck. `@internal/sqlite/contract-builder` is also new in this PR — does its test file (`packages/3-extensions/sqlite/test/contract-builder/...`) typecheck cleanly in CI, or does it fail the same way? Same question for the mongo subpaths. If they pass and only postgres fails, there's a postgres-specific issue (probably an absent or out-of-date `dist/contract-builder.d.mts`).

**Likely fix candidates (pick after investigation, don't guess):**

- (a) Add a `Build` step before `Type Check` in `.github/workflows/ci.yml`. Smallest change; matches the AGENTS.md golden rule. Run `pnpm build` (or `pnpm build:packages` if it exists).
- (b) Add `dependsOn: ["build"]` to the `typecheck` task in `turbo.json` so `pnpm typecheck` implicitly builds first. Architectural change; might slow down everyone's local workflow.
- (c) Change the three failing test files' import shape from `@internal/postgres/contract-builder` to a relative `../../src/exports/contract-builder` path so they don't depend on `dist/`. Smallest scope but defeats the purpose of the parity test (which is supposed to exercise the facade specifier exactly as users would).

Default to (a) if investigation confirms it works on other facades' tests via some other mechanism (e.g. their dist was cached). If (a) requires substantial workflow surgery (e.g. cross-job artifact sharing), prefer (c) with a comment explaining why and a follow-up Linear ticket recommendation.

## Failure 2 — Integration Tests (one CONFIRMED real regression + likely flakes)

**Real regression visible in CI log:**

```
FAIL test/cli-journeys/init-journey.e2e.test.ts > init-journey · 'mongo × typescript' > step 5 (user code: ObjectId import) (TML-2487 seam)
AssertionError: ObjectId import failed
  exit code: 1
    Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in /tmp/pn-journey-mongo-typescript-SXlBlT/node_modules/@internal/mongo/package.json imported from /tmp/pn-journey-mongo-typescript-SXlBlT/check-objectid.ts
```

Same failure for `'mongo × psl'` variant.

The init-journey test scaffolds a fresh mongo template, writes a `check-objectid.ts` that does `import { ObjectId } from '@internal/mongo'`, and expects it to succeed. Our PR removed the top-level `.` barrel from `@internal/mongo` — this is the documented "one genuine breaking change" in the PR description. The init-journey test's `check-objectid.ts` template needs to be updated to import from `@internal/mongo/bson` instead.

**Find the source of the `check-objectid.ts` template.** It's probably either:
- inline in `test/integration/test/cli-journeys/init-journey.e2e.test.ts` (search for `check-objectid`), or
- in a templates directory under `test/integration/test/cli-journeys/init-journey/` (the rebase-continue brief mentioned `test/integration/test/cli-journeys/init-journey/harness.ts` was auto-merged during the rebase).

Update the import shape to `@internal/mongo/bson` and verify with the local test run:

```bash
pnpm --filter integration-tests run test test/cli-journeys/init-journey.e2e.test.ts
```

**Likely-flake failures in the same job log:**

```
[streams] failed to ingest WAL events into prisma-wal Error: PGlite is closed
```

Many of these. They match the QA report's pre-existing flake class. **Confirm** by checking if the SAME test files fail on a clean `origin/main` integration run. If they fail there too, the flake is pre-existing and the only blocker in this job is the ObjectId regression. If they fail only on our branch, that's a new issue that needs deeper investigation — report and don't fix in this dispatch.

## Failure 3 + 4 — Test and Coverage

CI log excerpts show repeated `[streams] failed to ingest WAL events into prisma-wal Error: PGlite is closed`. This matches the known PGlite flake class that the QA report explicitly classified as `❌ accepted-as-is`.

**Characterize precisely:**

1. Pull the full failure summary for each job (`gh run view --job 77323643031 --log-failed > /tmp/test.log` then `grep -E "(FAIL|×|✗)" /tmp/test.log` and the same for Coverage's 77323643030).
2. For each failing test file, check if it ran (and passed/failed) on a recent green `origin/main` run.
3. If all the failures match the PGlite-closed pattern AND the same tests run flaky on `origin/main`, document them in the structured report as "confirmed pre-existing flakes, no action this PR" and proceed. The DCO+Build+Lint+Type Check+E2E green is the merge criterion; flakes here are accepted-as-is per the QA report.
4. If the failures include NEW classes (anything not PGlite-closed), STOP and surface for orchestrator triage. Don't try to fix flakes unless they're pinpointed regressions from our PR.

## Validate locally before pushing

The local gates that the QA report ran clean at `c5cdb597e` should still pass at `ceaa0d9ab`-plus-your-fixes:

1. `pnpm install --frozen-lockfile` — green
2. `pnpm build` — green (66/66 turbo tasks)
3. `pnpm typecheck` — green
4. `pnpm fixtures:check` — green
5. `pnpm lint:deps` — green
6. `pnpm --filter integration-tests run test test/cli-journeys/init-journey.e2e.test.ts` — green (after the ObjectId fix)

If the CI workflow fix needs running `pnpm typecheck:packages` without prior `pnpm build`, verify locally too: `rm -rf packages/*/dist packages/*/*/dist && pnpm install --frozen-lockfile && pnpm typecheck:packages`. If THAT succeeds with your fix, the CI fix is real.

## Push

If gates green: `git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app`.

After pushing, wait ~30s and then `gh run list --branch tml-2526-facades-must-re-export-everything-users-import-in-their-app --workflow ci.yml --limit 1` to confirm a new run started. Don't wait for it to complete (CI runs ~15 min); orchestrator will check on completion.

## Hard rules (composer-tier)

- **Always use `git commit -s` (signoff flag), never hand-write the `Signed-off-by:` trailer into the message body.** Your git identity in this worktree is configured to Will Madden; `-s` will read it correctly. Hand-writing the trailer has previously substituted "Composer <noreply@cursor.com>" which the DCO probot rejects.
- **Always use `git rebase --signoff` if rebasing during this dispatch** (shouldn't be needed but stated for hygiene).
- Explicit `git add <path>` only — never `-A`, never `.`.
- Before each commit: `git diff --cached --stat` + `git diff --stat` to confirm only the intended files are staged and nothing else is dirty.
- Use `--force-with-lease`, not plain `--force`.
- Touch only the files the fix requires. Do NOT touch `projects/` (orchestrator-owned).
- One commit per logical concern (separate the Type Check fix from the ObjectId fix; one commit per fix).
- Heartbeat to `wip/heartbeats/ci-fix.txt` at start, after each gate result, and pre-push (overwrite, don't append).
- If your investigation surfaces a fix that needs deeper scope than this dispatch (e.g. turbo.json change with cross-package implications), STOP and report — don't expand scope.

## Structured report

```
## Status
GREEN / YELLOW / RED

## Type Check fix
- Root cause confirmed: <description>
- Investigation summary: <ci.yml + turbo.json + other-facades comparison>
- Fix chosen: (a) ci.yml build step / (b) turbo.json dependsOn / (c) test import shape change / (d) other
- Commit: <sha>
- Local validation: typecheck green / red after fix

## Integration Tests fix
- ObjectId import location: <file:line>
- Fix: `@internal/mongo` → `@internal/mongo/bson`
- Commit: <sha>
- Local validation: init-journey.e2e.test.ts green / red

## PGlite flake characterization (Test + Coverage + Integration Tests remainder)
- Test failures: <list of failed test files>
- Coverage failures: <list>
- Integration Tests remainder failures: <list>
- All match PGlite-closed pattern on origin/main: yes / no (with evidence)
- Any new failure classes: <list, or "none">

## Final pre-flight
- pnpm install --frozen-lockfile: green / red
- pnpm build: green / red (66/66)
- pnpm typecheck: green / red
- pnpm fixtures:check: green / red
- pnpm lint:deps: green / red
- init-journey.e2e.test.ts: green / red

## Push
- pushed / blocked — <reason>
- New HEAD sha: <sha>
- New CI run ID: <id>

## Surfaced for orchestrator attention
- <anything>
```
