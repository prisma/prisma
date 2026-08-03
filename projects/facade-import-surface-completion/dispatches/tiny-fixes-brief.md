# Tiny fixes brief — harness.ts dead export + helpers.ts pgvector stub-id

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Current HEAD:** `d6abfd518` (post-review-iteration force-pushed; PR #557 review-clean)

Two scoped fixes. Both tiny. One push at the end.

## Fix 1 — drop dead `pack` export from sqlite migration harness

**File:** `test/e2e/framework/test/sqlite/migrations/harness.ts:38`

**Current line 38:**
```ts
export const pack = { family: sqlFamilyPack, target: sqlitePack } as const;
```

`sqlFamilyPack` and `sqlitePack` are not imported anywhere in the file; the body uses the imported `sqlFamilyDescriptor` and `sqliteTargetDescriptor` instead. This bug exists on `origin/main` too — confirmed via `git show origin/main:<file>` in earlier orchestrator monitoring.

**Action:** delete line 38 (the dead export) and any blank line orphaned by the delete. **First verify** no consumer in the codebase imports `pack` from this file:
```
rg "from ['\"].*sqlite/migrations/harness['\"]" --type ts
rg "\\bpack\\b" test/e2e/framework/test/sqlite/migrations/ --type ts
```
If grep finds any consumer of the `pack` export, STOP and report — that changes the fix shape (likely needing the missing imports added rather than the export deleted). Otherwise delete.

**Commit subject:** `fix(test/e2e/framework): drop dead pack export from sqlite migration harness`

**Commit body:** explain that `sqlFamilyPack`/`sqlitePack` were never imported (the body uses the matching `*Descriptor` symbols), no consumer used the export, and this typecheck error existed pre-rebase on `origin/main` too.

**Validation:** `pnpm --filter e2e-tests run typecheck` returns clean.

## Fix 2 — align pgvector stub id with contract extension pack

**File:** `packages/3-extensions/sql-orm-client/test/helpers.ts`

**Surrounding code (lines ~55-93 of helpers.ts):** defines `pgVectorCodecStubExtension` with `id: 'pgvector-codec-stub'`. The package-local fixture's contract.json declares `extensionPacks.pgvector` (legitimately — the fixture models contain vector fields). `assertExecutionStackContractRequirements` throws at runtime when these IDs don't match, breaking ~24 test files.

**Background:** the prior type-fix subagent (`a4cc4ec4`) surfaced this as a latent runtime bug pre-existing on the branch:

> `sql-orm-client/test/helpers.ts` defines `pgVectorCodecStubExtension` with `id: 'pgvector-codec-stub'`, but the fixture's contract JSON declares `extensionPacks.pgvector`, causing `assertExecutionStackContractRequirements` to throw at runtime in ~24 test files. … Likely the stub's `id` should be `'pgvector'` to match the contract requirement, or the fixture JSON should also have pgvector stripped.

**Recommended action: Route A — rename the stub id.** Change `id: 'pgvector-codec-stub'` to `id: 'pgvector'`. Rationale: the fixture genuinely uses pgvector (vector fields in models); stripping pgvector from the fixture JSON would mean stripping vector fields too, which would break tests beyond the 24. Route A is the smaller, more honest fix.

**If Route A causes more failures than it fixes** — pause and report. Don't escalate to Route B without orchestrator confirmation.

**Commit subject:** `fix(@internal/sql-orm-client): align pgvector stub id with contract extension pack`

**Commit body:** explain the runtime ID mismatch (`pgvector-codec-stub` vs the contract's `extensionPacks.pgvector`), the assertion-failure surface, and that this bug pre-existed on origin (verified by the prior type-fix dispatch).

**Validation:** `pnpm --filter @internal/sql-orm-client run test` and report pass/fail file counts. Baseline before this dispatch (per the type-fix subagent's verification): 24 failed test files / 0 type errors. Target after this fix: substantial recovery (ideally 0 or near-0 failures from the pgvector class; other unrelated failures, if any, are out of scope).

## Validate + push

After both fixes are committed:

1. `pnpm typecheck` — must be fully green now (`harness.ts:38` was the last red after the rebase).
2. `pnpm build` — re-verify 66/66.
3. `pnpm fixtures:check` — green.
4. `pnpm lint:deps` — green.
5. `pnpm --filter @internal/sql-orm-client run test` — report pass/fail counts; do not block push if remaining failures are unrelated to pgvector (per type-fix subagent's note about adapter-postgres PGlite flakes, cli init.test.ts, emitter/sql-runtime/sql-contract single-test failures).

If gates green: `git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app`.

## Hard rules (composer-tier)

- DCO signoff every commit.
- Explicit staging only (`git add <path>`, never `-A` or `.`).
- Heartbeat to `wip/heartbeats/tiny-fixes.txt` every ~5 min or at commit boundaries.
- Do NOT touch any file outside the two listed source files (plus generated lockfile if `pnpm install` is somehow needed — which it shouldn't be).
- Do NOT touch any file under `projects/` — orchestrator-owned.
- Force-push uses `--force-with-lease`.
- If TLS / GitHub API errors during push: stop and report; do not work around.

## Out of scope

- Mongo facade `defineContract` regression (TML-2633).
- Pre-existing adapter-postgres test flakes.
- PR description updates (orchestrator-side, separate dispatch).
- QA scenarios re-run (separate dispatch after this one).

## Structured report

```
## Status
GREEN / YELLOW / RED

## Fix 1 — harness.ts pack export
- Pre-grep consumer check: <none found / found N consumers>
- Action taken: deleted line / added imports (with rationale)
- Commit: <sha>
- Validation: `pnpm --filter e2e-tests run typecheck` <green/red>

## Fix 2 — helpers.ts pgvector stub id
- Route chosen: A / B (with rationale if not A)
- Commit: <sha>
- Validation: `pnpm --filter @internal/sql-orm-client run test`
  - Before: <N> failed test files (per type-fix dispatch baseline: 24)
  - After: <N> failed test files
  - Delta: <description>

## Final pre-flight
- typecheck: green / red
- build: green / red
- fixtures:check: green / red
- lint:deps: green / red
- sql-orm-client tests: <N> failed / <N> passed (unrelated failures listed)

## Push
- pushed / blocked — <reason>
- New HEAD sha: <sha>

## Surfaced for orchestrator attention
- <anything>
```
