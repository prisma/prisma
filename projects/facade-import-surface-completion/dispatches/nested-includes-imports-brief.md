# Fix nested-includes test imports — followup to commit 357805f2f

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Current HEAD:** `56a22e22b`
**Origin HEAD:** `9c0eb947b` (push still pending — was blocked by typecheck red)

## Why this exists (orchestrator miss)

The rebase-continue dispatch (`8f59ed5a`) correctly fixed imports in `nested-includes-helpers.ts` per the orchestrator's brief. The build-then-validate dispatch (`5f36b2e4`) then surfaced that the **three sibling test files** (`nested-includes.test.ts`, `nested-includes-refinements.test.ts`, `nested-includes-strategy.test.ts`) have the SAME class of broken import — they import `createUsersCollection`, `timeouts`, `withCollectionRuntime` from `./helpers`, but those symbols live in `./integration-helpers` post-move.

Root cause: on `origin/main`, these symbols and the package-level helpers symbols both lived in `packages/3-extensions/sql-orm-client/test/integration/helpers.ts` at the OLD location. Our `d7a4ac070` split that file's destination across two new files at the new location:

| Old path | New path |
|---|---|
| `packages/3-extensions/sql-orm-client/test/integration/helpers.ts` (had `createUsersCollection`, `timeouts`, `withCollectionRuntime`) | `test/integration/test/sql-orm-client/integration-helpers.ts` |
| `packages/3-extensions/sql-orm-client/test/helpers.ts` (had `getTestContext`, `getTestContract`, etc.) | `test/integration/test/sql-orm-client/helpers.ts` |

Main's `64cabc886` (which added the four nested-includes files at the old location) wrote `from './helpers'` because at the old location that's where everything lived. The orchestrator's prior triage only looked at `nested-includes-helpers.ts`'s imports and missed that the sibling test files have the same drift.

## Fix

Three single-line edits, each just changing the source module specifier:

### File 1: `test/integration/test/sql-orm-client/nested-includes.test.ts`

**Current line 33:**
```ts
import { createUsersCollection, timeouts, withCollectionRuntime } from './helpers';
```

**Change to:**
```ts
import { createUsersCollection, timeouts, withCollectionRuntime } from './integration-helpers';
```

### File 2: `test/integration/test/sql-orm-client/nested-includes-refinements.test.ts`

**Current line 11:**
```ts
import { createUsersCollection, timeouts, withCollectionRuntime } from './helpers';
```

**Change to:**
```ts
import { createUsersCollection, timeouts, withCollectionRuntime } from './integration-helpers';
```

### File 3: `test/integration/test/sql-orm-client/nested-includes-strategy.test.ts`

**Current line 16:**
```ts
import { timeouts, withCollectionRuntime } from './helpers';
```

**Change to:**
```ts
import { timeouts, withCollectionRuntime } from './integration-helpers';
```

The line numbers above come from the prior dispatch's typecheck error output; verify with `grep -n "from './helpers'"` before editing, in case formatting shifts the line.

## Cross-check before committing

Confirm `createUsersCollection`, `timeouts`, and `withCollectionRuntime` are all exported from `test/integration/test/sql-orm-client/integration-helpers.ts`:

```bash
grep -n "^export" test/integration/test/sql-orm-client/integration-helpers.ts | head -15
```

The orchestrator already verified this:
- `createUsersCollection` exported at line 14
- `timeouts` re-exported at line 12 (`export { timeouts };`)
- `withCollectionRuntime` exported at line 48

## Commit

Single commit:

```bash
git add test/integration/test/sql-orm-client/nested-includes.test.ts \
        test/integration/test/sql-orm-client/nested-includes-refinements.test.ts \
        test/integration/test/sql-orm-client/nested-includes-strategy.test.ts
git commit -m 'fix(test/integration): retarget nested-includes sibling tests at integration-helpers

Followup to 357805f2f. That commit fixed nested-includes-helpers.ts
but the three sibling test files (nested-includes.test.ts,
nested-includes-refinements.test.ts, nested-includes-strategy.test.ts)
have the same class of stale-import drift mains 64cabc886 wrote them
with from "./helpers" because at the old packages/3-extensions/
sql-orm-client/test/integration/ location everything lived in one
helpers.ts. Our d7a4ac070 split that file across two new locations:
package-level helpers.ts kept getTestContext/getTestContract/etc; the
old test/integration/helpers.ts became integration-helpers.ts (gained
createUsersCollection, timeouts, withCollectionRuntime, et al).

The three sibling tests need their from "./helpers" retargeted at
"./integration-helpers" for the symbols that moved.

Signed-off-by: Will Madden <madden@prisma.io>'
```

## Validate + push

After the commit:

1. `pnpm typecheck` — must exit 0 (the integration-tests block should be gone).
2. `pnpm fixtures:check` — must exit 0.
3. `pnpm lint:deps` — must exit 0.

No need to re-run `pnpm build` — we're not changing any exported symbols, just consumer-side import specifiers.

If all gates green:

```bash
git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app
```

Force-with-lease should expect origin at `9c0eb947b` and replace with the new HEAD (which will be `<sha-of-this-commit>` on top of `56a22e22b`).

## DCO sanity

Before pushing:

```bash
git log origin/main..HEAD --format='%h | author: %an <%ae> | signoff: %(trailers:key=Signed-off-by)' | head -10
```

Every commit must signoff as `Will Madden <madden@prisma.io>`. If your `git commit` infrastructure auto-stamps `Composer <noreply@cursor.com>` despite the manual trailer in the heredoc, AMEND the new commit before pushing (rewrite the message preserving everything except the Composer line).

## Hard rules

- Touch ONLY the 3 listed files. No source edits outside them.
- Do NOT touch any file under `projects/` — orchestrator-owned.
- Do NOT run `pnpm build` (not necessary, wastes ~30s; skip it).
- Do NOT pass `--signoff` to `git commit` — the heredoc has the trailer.
- Use `--force-with-lease`, not plain `--force`.
- Heartbeat to `wip/heartbeats/nested-includes-imports.txt` at start, post-edits, post-commit, post-typecheck, pre-push (overwrite).

## Structured report

```
## Status
GREEN / RED

## Edits
- nested-includes.test.ts: line N changed from './helpers' → './integration-helpers' ✓/✗
- nested-includes-refinements.test.ts: line N changed ✓/✗
- nested-includes-strategy.test.ts: line N changed ✓/✗

## Cross-check
- integration-helpers.ts exports verified: yes / no

## Commit
- sha: <sha>
- signoff: Will Madden / Composer (if Composer, document the amend)

## Validation
- typecheck: green / red (if red, paste output)
- fixtures:check: green / red
- lint:deps: green / red

## DCO sanity
- All signoffs Will Madden: yes / no

## Push
- pushed / blocked — <reason>
- New origin HEAD: <sha>

## Surfaced for orchestrator attention
- <anything>
```
