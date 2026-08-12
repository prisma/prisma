# Rebase brief — onto current origin/main + complete pre-flight + force-push

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Target:** current `origin/main`
**Triggering signal:** GitHub shows the PR (#557) has merge conflicts; `origin/main` has advanced since the prior local rebase landed onto `cda126a56`.

## What you own end-to-end

1. Fetch `origin` and rebase the branch onto current `origin/main`.
2. Resolve all conflicts per the **conflict-resolution policy** below.
3. Regenerate `pnpm-lock.yaml` via `pnpm install` at the end (NEVER hand-edit the lockfile — that's a workspace rule).
4. Fix the **stale sql-orm-client package fixture** (see § Known issues) so typecheck goes green.
5. Run the **pre-flight gates** in order; stop on first hard failure and report.
6. Force-push the rebased branch to `origin` (so PR #557 reflects the new tree).
7. Return a structured report (template at the bottom of this brief).

## Conflict-resolution policy (accumulated from the prior rebase)

These patterns held across all 14 conflict points in the prior local rebase onto `cda126a56`. Expect them to hold again; deviate only when the conflict's content makes them obviously wrong, and document the deviation in your report.

### `package.json` workspace-version drift

Almost every package.json conflict on this branch is a **workspace-version pin disagreement** between main's pins (typically `workspace:0.10.0` or current main version) and our branch's pre-bump pins (`workspace:0.9.0`).

**Resolution:** take main's version pins; preserve our adds and removes. Concretely:

- The branch **adds** new dependency entries to several facades (for tree-shaking via subpath imports). These adds should survive at main's version number.
- The branch **removes** `extension-pgvector` devDep from `sql-builder/package.json` and `sql-orm-client/package.json`, and `mongo-contract-ts` devDep from `mongo-runtime/package.json` (D5c work — relocating extension-pack-dependent tests out of these packages). These removals should survive.
- The branch **adds** `@internal/postgres` as a devDep to `pgvector/package.json` and `postgis/package.json` (D5d work — extension-pack contracts migrated to facade form). These adds should survive at main's version.
- The branch **adds** `@internal/cli` to `mongo/package.json` deps (D2 work — control client wiring). Should survive at main's version.
- The branch **adds** `@internal/sqlite` to `test/e2e/framework/package.json` deps (F-1 fix). Should survive.

### `pnpm-lock.yaml`

Per workspace rule `.cursor/rules/no-direct-lockfile-edits.mdc`: **never hand-edit**. During the rebase, take `--ours` on every lockfile conflict (`git checkout --ours pnpm-lock.yaml && git add pnpm-lock.yaml`). At the end of the rebase, run `pnpm install` once to regenerate the lockfile against the final package.json state, then commit it as a separate `chore: realign pnpm-lock for rebase onto origin/main` commit (already in branch history from the prior rebase — you may need a fresh equivalent commit on top).

### `test/integration/package.json`

Main's structure includes most deps; our branch adds `@internal/mongo` (D5b — was the first time we needed the facade as a runtime dep). Take main's structure, add `@internal/mongo` at main's version, no `@internal/sqlite` (test/integration doesn't import from the sqlite facade in our slice).

### Source-file conflicts

Decide per-file by reading the imports and the body:

- If both sides add an import that the body uses, keep both (the classic `import A` vs `import B` conflict in `test/integration/test/sql-orm-client/upsert.test.ts`).
- If one side deletes a file entirely (`projects/prisma-next-agent-skill/references/workflows-catalog.md` was deleted on `main` while D6 modified it), accept the deletion via `git rm`.
- For other conflicts, prefer the resolution that preserves the intent of our commit (the rebase replays our commits one at a time, so the commit message is your guide).

### `drive/qa/findings.md` and `drive/retro/findings.md`

Both files accumulate findings stanzas chronologically. Our branch contributes 2026-05-21 entries; main may have added later entries. Combine: keep all entries from both sides, ordered chronologically. Conventions in `drive/trial.md`:

- `drive/qa/findings.md` appears to be **chronological-ascending** (oldest first).
- `drive/retro/findings.md` appears to be **reverse-chronological** (newest first).

Match the existing file's order when inserting. Do **not** drop any entries from either side.

## Known issues to expect

### Stale `sql-orm-client` package fixture (must fix during rebase)

After the prior local rebase + `pnpm install`, `pnpm typecheck` reported one failure:

```
@internal/sql-orm-client:typecheck: test/where-binding.test.ts(536,35): error TS2345:
  ... Type '{ readonly __unspecified__: ... }' is not assignable to
      type 'Readonly<Record<string, SqlNamespace>> & { readonly __unbound__: SqlNamespace; }'.
```

**Root cause:** `main` renamed the unbound-namespace key from `__unspecified__` to `__unbound__` (storage IR rename). The integration-side fixture at `test/integration/test/sql-orm-client/fixtures/generated/contract.{json,d.ts}` already uses `__unbound__`. The package-local copy at `packages/3-extensions/sql-orm-client/test/fixtures/generated/contract.{json,d.ts}` still uses the old key.

**Fix:** regenerate the package-local fixture. The package's `emit` script is `cd ../../../test/integration && node ../../packages/1-framework/3-tooling/cli/dist/cli.js contract emit --config test/sql-orm-client/fixtures/prisma-next.config.ts && cp test/sql-orm-client/fixtures/generated/contract.json ../../packages/3-extensions/sql-orm-client/test/fixtures/generated/`. Note the `cp` only copies `contract.json`, not `contract.d.ts` — you may need to also copy the `.d.ts` (extend the script if necessary; the missing `.d.ts` copy is likely what caused the drift in the first place since `contract.json` would have been regenerated by other `emit:check` runs but `.d.ts` wouldn't). Commit the script extension + the regenerated fixture as one commit (e.g. `fix(@internal/sql-orm-client): also copy contract.d.ts in emit script (was the source of fixture drift)`).

Verify the fix: `pnpm --filter @internal/sql-orm-client run typecheck` returns clean.

### `harness.ts:38` is broken on main too — NOT ours to fix

`test/e2e/framework/test/sqlite/migrations/harness.ts:38` references unimported identifiers `sqlFamilyPack` and `sqlitePack` in an exported `pack` constant. Confirmed (via `git show origin/main:test/e2e/framework/test/sqlite/migrations/harness.ts`) that this exact bug exists on `origin/main`. Do not fix it in this rebase. If it surfaces in pre-flight, note it in the report under "Known main-side issues" and proceed.

## Pre-flight gates (run in order, stop on first hard failure)

After rebase + lockfile regen + stale-fixture fix:

1. `pnpm build` — must pass 66/66 tasks.
2. `pnpm typecheck` — must be clean post-fixture-fix.
3. `pnpm fixtures:check` — must be clean.
4. `pnpm test:packages` — must pass. Environmental flakes (PGlite "Connection terminated unexpectedly") are pre-existing and OK to re-try once; persistent test failures must be reported.
5. `pnpm lint:deps` — must be clean.

If any gate goes red, **stop** before force-pushing. Capture the failure surface and put it in the report. The operator/orchestrator will decide whether to fix-in-dispatch, file a follow-up, or revert.

## Force-push (only if pre-flight is green)

```
git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app
```

Use `--force-with-lease` (safer than plain `--force`; it refuses to overwrite if `origin` has commits you don't have locally).

## Out of scope for this dispatch

- QA scenario re-run (orchestrator will dispatch a separate `qa-rerun-scripts` brief once your work lands clean).
- CodeRabbit review iteration (orchestrator will dispatch `/github-review-iteration` after force-push).
- Upgrade-instructions scan (orchestrator will dispatch a separate `upgrade-instructions-scan` brief; result feeds PR description, not this rebase).
- PR description update (orchestrator owns).
- Anything in `projects/facade-import-surface-completion/` other than this brief file.

## Heartbeat cadence

Every ~5 minutes or at commit boundaries, write a one-line status to `wip/heartbeats/rebase-tml-2526-onto-main.txt` (e.g. `2026-05-21T13:05Z conflict 7/N — packages/3-extensions/mongo/package.json — resolved per policy`). The orchestrator monitors this file rather than waiting on completion-notification latency.

## Structured report format

When you return, structure your message as:

```
## Status
GREEN / YELLOW / RED

## Rebase summary
- Commits replayed: N
- Conflicts encountered: N
- Resolution deviations from policy: <list, or "none">

## Pre-flight results
- build: green / red (details if red)
- typecheck: green / red
- fixtures:check: green / red
- test:packages: green / red
- lint:deps: green / red

## Force-push
- pushed / blocked — <reason if blocked>

## Known main-side issues encountered
- <list, or "none">

## Surfaced for orchestrator attention
- <anything that needs a decision>
```
