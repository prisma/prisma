# Typecheck investigation brief — sql-orm-client type-d failures

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Triggering signal:** post-rebase `pnpm typecheck` red on `@internal/sql-orm-client` — 16 errors across 4 type-d test files (full failure context in the rebase subagent's report committed as `4bcd8249` outcome).

## Your role

**READ-ONLY DIAGNOSIS, NO FIXES.** You do not modify any source files, do not stage anything, do not commit. You read git history + test files + the production code they exercise; you produce a structured per-test recommendation. The orchestrator decides what to dispatch next based on your output.

## Failing files

1. `packages/3-extensions/sql-orm-client/test/codec-async.types.test-d.ts`
2. `packages/3-extensions/sql-orm-client/test/orm.types.test-d.ts`
3. `packages/3-extensions/sql-orm-client/test/simplify-deep.test-d.ts`
4. `packages/3-extensions/sql-orm-client/test/value-object-inputs.test-d.ts`

Error patterns observed:

- `AddressShape | null` not satisfying `never` constraints
- Unused `@ts-expect-error` directives

## Investigation steps (per failing file)

For each of the 4 files, do:

1. **Did our branch touch this test?**
   ```
   git log $(git merge-base origin/main HEAD)..HEAD -- <file>
   ```
   Record: commit shas + one-line subjects that touch the file (or "none").

2. **Did main touch this test or its production-code surface area?**
   ```
   git log $(git merge-base origin/main HEAD)..origin/main -- <file>
   ```
   Also check the production source the test exercises:
   - `packages/3-extensions/sql-orm-client/src/**` for things named `Address`, `ValueObject`, `Simplify`, `Codec`, `Orm`, etc.
   - `packages/3-extensions/sql-orm-client/test/fixtures/contract.ts` (the test fixture's TS source)
   - `packages/2-sql/2-authoring/contract-ts/` (the contract builder layer)
   - `packages/2-sql/4-lanes/relational-core/` (the core type plumbing)

   Record main-side commit shas + subjects that look topically relevant.

3. **Read the failing test file and the production code it tests.** Trace each individual `@ts-expect-error` / `expectType` failure to its root cause. For each failure, classify the source as one of:
   - `ours` — caused by a commit on our branch (typically a facade-completion change in `defineContract` typing, subpath re-exports, fixture changes)
   - `main` — caused by a commit on `origin/main` since our branch diverged (typically IR rename, codec-typing change, contract-shape change)
   - `both` — interaction of both branches' changes
   - `unclear` — needs more context

4. **Per failure, recommend an action:**
   - `fix-in-PR` (with one-line scope estimate, e.g. "delete 3 stale `@ts-expect-error` directives" or "update `AddressShape` test expectation to match new codec output")
   - `defer-to-follow-up` (with one-line rationale + Linear-ticket-candidate title)
   - `needs-more-info` (with what specifically you couldn't determine)

## Hard rules

- **No modifications.** `git status` must be clean at end (only the heartbeat file modified).
- **No improvisation.** If a failure doesn't fit one of the four classifications, mark it `unclear` and move on.
- **No PR-description edits, no Linear MCP calls, no force-push.**
- Heartbeat to `wip/heartbeats/typecheck-investigation.txt` every ~5 min or at file boundaries.

## Structured report format

```
## Status
COMPLETE / PARTIAL — <reason if partial>

## File-by-file diagnosis

### test/codec-async.types.test-d.ts
- Our-branch commits touching this file: <list or "none">
- Main-branch commits touching topically: <list or "none">
- Failures (per-failure breakdown):
  - F1: line N, error <short>; source: ours/main/both/unclear; recommendation: fix-in-PR (<scope>) / defer (<rationale>) / needs-info (<what>)
  - F2: ...
- File-level recommendation: <synthesis>

### test/orm.types.test-d.ts
- ...

### test/simplify-deep.test-d.ts
- ...

### test/value-object-inputs.test-d.ts
- ...

## Synthesis
- Total failures: 16
- Classified as ours: N
- Classified as main: N
- Classified as both: N
- Classified as unclear: N

## Recommended next dispatch
- Single fix-in-PR dispatch covering: <files + scope>
- Defer to follow-up (Linear ticket candidate): <title + one-line scope>, OR "none"
- Additional investigation needed: <if any>
```
