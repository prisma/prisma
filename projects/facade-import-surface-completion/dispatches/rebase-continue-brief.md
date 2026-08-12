# Rebase-continue brief — resolve nested-includes conflict + fix imports

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Rebase state:** paused at commit 30/71 (`d7a4ac070 refactor(@internal/sql-builder): move playground tests to integration, drop pgvector devDep`)

## What's happening (orchestrator triage, read-only confirmed)

The current rebase is mid-flight onto `origin/main` (`31b30de98`). It paused on `d7a4ac070`, our commit that moves the entire `packages/3-extensions/sql-orm-client/test/integration/**` tree to `test/integration/test/sql-orm-client/**`.

Since our branch diverged from main (at `cda126a5`), `main` added 4 new files via commit `64cabc886 test(sql-orm-client): add nested-includes integration corpus across strategies`:

- `packages/3-extensions/sql-orm-client/test/integration/nested-includes-helpers.ts`
- `packages/3-extensions/sql-orm-client/test/integration/nested-includes-refinements.test.ts`
- `packages/3-extensions/sql-orm-client/test/integration/nested-includes-strategy.test.ts`
- `packages/3-extensions/sql-orm-client/test/integration/nested-includes.test.ts`

Git's rebase rename-detection inferred (correctly) that these should follow the rest of the tree move. It already placed them in the index at stage 2 with main's content at the NEW path `test/integration/test/sql-orm-client/nested-includes-*.ts`, marked `AU` (added by us / unmerged) — because our `d7a4ac070` didn't explicitly handle them. The OLD-path copies are correctly staged as deleted.

Orchestrator verified:
- Working-tree files at the new path match `origin/main`'s old-path blob content byte-for-byte (via `diff`).
- These 4 files are post-divergence additions to main, not in our base.
- `git ls-files -u` shows only stage-2 entries (no stage-3 conflicts), confirming "added by us" without competing content.

## Resolution — part 1: accept the move at the new path

```bash
git add test/integration/test/sql-orm-client/nested-includes-helpers.ts \
        test/integration/test/sql-orm-client/nested-includes-refinements.test.ts \
        test/integration/test/sql-orm-client/nested-includes-strategy.test.ts \
        test/integration/test/sql-orm-client/nested-includes.test.ts
git rebase --continue
```

Do NOT edit the file contents at this step. Do NOT touch any other file in the working tree during this resolution (the rest of the `R packages/.../X -> test/integration/.../X` rename block must replay as-is). The rebase will keep `d7a4ac070`'s authorship and trailer; do not amend.

The remaining 41 commits should replay clean — they're all from our branch and the only "main-side surprise" was these 4 files. If any further commit hits a conflict, STOP and report. Do not guess.

## Resolution — part 2: repair stale relative imports in `nested-includes-helpers.ts`

After `git rebase` completes (no more pending commits), one file from the adopted batch has broken relative imports because it was written for the OLD path:

**File:** `test/integration/test/sql-orm-client/nested-includes-helpers.ts`

**Current (broken at new path):**
```ts
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import { Collection } from '../../src/collection';
import { getTestContext, getTestContract, type TestContract } from '../helpers';
import type { PgIntegrationRuntime } from './runtime-helpers';
```

**Fix (matches the `ee84b8982` D5c pattern for siblings):**
```ts
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import { Collection } from '@internal/sql-orm-client';
import { getTestContext, getTestContract, type TestContract } from './helpers';
import type { PgIntegrationRuntime } from './runtime-helpers';
```

Two line changes. The other three nested-includes files (`-refinements.test.ts`, `-strategy.test.ts`, `.test.ts`) use only same-directory imports (`./helpers`, `./runtime-helpers`, `./nested-includes-helpers`) and need NO changes — verified by orchestrator with `grep ^import`.

**Verification cross-check** — read the analogous already-fixed file at `test/integration/test/sql-orm-client/include.test.ts` to confirm the pattern (`from '@internal/sql-orm-client'` + `from './helpers'`).

Then commit:

```bash
git add test/integration/test/sql-orm-client/nested-includes-helpers.ts
git commit -m 'fix(test/integration): repair stale src/ imports in main-added nested-includes tests

The rebase onto origin/main adopted four nested-includes test files
that main introduced post-divergence (commit 64cabc886) at the OLD
sql-orm-client test/integration/ path. Our d7a4ac070 moves that whole
tree to test/integration/test/sql-orm-client/, and git rename-detection
correctly carried the four files along. nested-includes-helpers.ts had
two relative imports that pointed at the old layout:

  - ../../src/collection (resolved into the package src/)
  - ../helpers (resolved into the package test/helpers.ts)

This switches both to the post-D5c-cleanup pattern that the sibling
include.test.ts uses (workspace import for Collection, same-dir
helpers). The other three nested-includes files use only same-dir
imports and need no changes.

Signed-off-by: Will Madden <madden@prisma.io>'
```

## DCO sanity check

Before pushing:

```bash
git log origin/main..HEAD --format='%h | author: %an <%ae> | signoff: %(trailers:key=Signed-off-by)'
```

Every commit's `author:` and `signoff:` must both be `Will Madden <madden@prisma.io>`. If any commit shows `Composer <noreply@cursor.com>` in the signoff column, STOP and report — that would re-fail DCO.

## Validation gates

1. `pnpm install --frozen-lockfile` — must exit 0.
2. `pnpm typecheck` — must exit 0.
3. `pnpm build` — must exit 0 (66/66 turbo tasks).
4. `pnpm fixtures:check` — must exit 0.
5. `pnpm lint:deps` — must exit 0.

If any gate is red, STOP and report. Don't expand scope.

## Push

If all gates green and DCO sanity passes:

```bash
git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app
```

Pre-push HEAD on origin is `9c0eb947b`; your push will replace the line with the rebased commits plus the import-fix commit on top.

## Hard rules

- DCO signoff identity must be Will Madden, NOT Composer. The rebase preserves existing signoffs; your one new commit (the import fix) must signoff as Will Madden too (the brief's heredoc includes the trailer; if your `git commit` infrastructure auto-adds Composer, edit the trailer in `--amend` before pushing).
- Explicit staging only — never `-A`, never `.`.
- Do NOT touch any file under `projects/` — orchestrator-owned.
- Do NOT touch any file in the worktree besides:
  - The 4 nested-includes files at the new path (for the `git add` in part 1).
  - `test/integration/test/sql-orm-client/nested-includes-helpers.ts` (for the import fix in part 2).
- Use `--force-with-lease` for the push.
- Heartbeat to `wip/heartbeats/rebase-continue.txt` at start, post-add, post-rebase-continue, post-import-fix, post-gates, pre-push (overwrite, don't append).

## Structured report

```
## Status
GREEN / YELLOW / RED

## Rebase resolution
- 4 nested-includes files added at new path: yes / no
- Rebase continued cleanly to end: yes / no (with conflict-N if hit)
- Total commits replayed: <N> (expected 71)

## Import fix
- nested-includes-helpers.ts patched: yes / no
- Pattern matches include.test.ts cross-check: yes / no
- Commit: <sha>

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
