# Rebase-onto-main-3 brief

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Current HEAD:** `0f2b86d38`
**Target base:** current `origin/main` (orchestrator just ran `git fetch origin main`; ~10 cli-telemetry + sql-builder commits ahead of our base)

## Why

GitHub's mergeability cache claims `dirty`/`conflicting` and won't re-trigger the `CI (PR)` workflow on subsequent pushes. Local `git merge --no-commit --no-ff origin/main` runs completely clean (auto-merges 5 files: `drive/retro/findings.md`, `pnpm-lock.yaml`, `test/integration/test/cli-journeys/init-journey/harness.ts`, `test/integration/test/sql-orm-client/include.test.ts`, `test/integration/test/sql-orm-client/self-relations.test.ts` — no conflict markers). A fresh rebase will pull main's recent landings into our history, unstick GitHub's cache, and let CI run against current main.

## The rebase

```bash
git fetch origin main
git rebase origin/main
```

Local dry-run confirmed zero conflicts. **Do NOT use `--signoff`** — rebases preserve original author/signoff trailers from each commit. If you pass `--signoff`, you'll APPEND a fresh Composer signoff to every commit and re-fail DCO. The orchestrator just fixed DCO via `filter-branch`; don't undo that.

If you somehow hit a conflict despite the clean dry-run:
- STOP, do not auto-resolve, report immediately with `git status` output.
- Preferred resolution policy if forced: take `origin/main` for `pnpm-lock.yaml` then run `pnpm install` to regenerate; take ours for `projects/`; merge `drive/qa/findings.md` and `drive/retro/findings.md` chronologically; for everything else, surface for orchestrator judgement.

## Validate after rebase

1. `pnpm install --frozen-lockfile` — must exit 0 (lockfile must be in sync if main bumped any deps).
2. `pnpm typecheck` — must exit 0.
3. `pnpm build` — must exit 0 (66/66 turbo tasks).
4. `pnpm fixtures:check` — must exit 0.
5. `pnpm lint:deps` — must exit 0.

If any gate is red and the failure looks rebase-induced (e.g. main moved a file we still reference in our commits), STOP and report with the exact failure. Don't try to fix beyond what the rebase requires.

## DCO sanity check

After rebase, before pushing:

```bash
git log origin/main..HEAD --format='%h | author: %an <%ae> | signoff: %(trailers:key=Signed-off-by)' | head -30
```

Every commit's `author:` and `signoff:` must both be `Will Madden <madden@prisma.io>`. If you see `Composer <noreply@cursor.com>` anywhere in the signoff column, STOP and report — that's the DCO regression we just fixed and we don't want it back.

## Push

If all gates green and DCO sanity passes:

```bash
git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app
```

## Hard rules

- DCO signoff identity must be Will Madden, NOT Composer. The rebase should preserve existing signoffs; if it doesn't, surface immediately.
- Explicit staging only — never `-A`, never `.` (this matters if you hit any conflict).
- Do NOT touch any file under `projects/` — orchestrator-owned.
- Use `--force-with-lease`, not plain `--force`.
- Heartbeat to `wip/heartbeats/rebase-onto-main-3.txt` at start, mid-rebase, post-rebase, and pre-push (overwrite, don't append).

## Structured report

```
## Status
GREEN / YELLOW / RED

## Rebase
- Conflicts encountered: none / <list with resolution>
- Commits replayed: <N>
- Pre-rebase HEAD: 0f2b86d38
- Post-rebase HEAD: <sha>

## DCO sanity
- All signoffs `Will Madden <madden@prisma.io>`: yes / no (with details)

## Validation
- pnpm install: green / red
- typecheck: green / red
- build: green / red
- fixtures:check: green / red
- lint:deps: green / red

## Push
- pushed / blocked — <reason>
- New HEAD sha: <sha>

## Surfaced for orchestrator attention
- <anything>
```
