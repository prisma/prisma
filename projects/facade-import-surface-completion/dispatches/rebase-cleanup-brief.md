# Rebase-cleanup brief — fix two rebase-resolution misses on helpers.ts + missing unbound-tables.ts

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Current HEAD:** `9ad36520f` (post-tiny-fixes force-pushed)

## What happened

The orchestrator's tiny-fixes dispatch surfaced two pre-tiny-fixes reds. Both are **rebase-resolution misses on our branch** (we kept `--ours` for a file that origin/main moved forward) and **TML-2520 IR migration misses** in our D5 work. Neither is pre-existing on `origin/main` — both are firmly in-scope for this PR.

The orchestrator confirmed the diagnosis via read-only triage:

### Bug 1 — `packages/3-extensions/sql-orm-client/test/helpers.ts` uses old pre-TML-2520 storage shape

On `origin/main`, the helper functions `buildMixedPolyContract()` (line 124) and `buildStiPolyContract()` (line 189) reference the per-namespace storage IR introduced by TML-2520:

```ts
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
// ...
raw.storage.namespaces[UNBOUND_NAMESPACE_ID].tables.tasks = { ... };
```

On our HEAD, the same file uses the old pre-TML-2520 shape:

```ts
// no UNBOUND_NAMESPACE_ID import
raw.storage.tables.tasks = { ... };
```

This produces 4 failing package-level test files at runtime (`raw.storage.tables` is undefined under the new per-namespace IR):

- `packages/3-extensions/sql-orm-client/test/collection-contract.test.ts`
- `packages/3-extensions/sql-orm-client/test/collection-runtime.test.ts`
- `packages/3-extensions/sql-orm-client/test/collection-variant.test.ts`
- `packages/3-extensions/sql-orm-client/test/query-plan-select.test.ts`

The likely cause is a rebase conflict resolution that kept our pgvector-stub additions (D5 intent — correct) but dropped TML-2520's storage-shape update. The integration twin at `test/integration/test/sql-orm-client/helpers.ts` is correct (uses the new namespaced shape) — only the package-level twin regressed.

### Bug 2 — `test/integration/test/sql-orm-client/unbound-tables.ts` missing

Our D5 commit `d7a4ac070` (`refactor(@internal/sql-builder): move playground tests to integration, drop pgvector devDep`) moved 3 files from `packages/3-extensions/sql-orm-client/test/` to `test/integration/test/sql-orm-client/`:

- `collection-fixtures.ts`
- `collection-mutation-defaults.test.ts`
- `polymorphism.test.ts`

The moved `collection-mutation-defaults.test.ts` does `import { unboundTables } from './unbound-tables';` (line 10). The `unbound-tables.ts` file is **not** at the integration location — it's still at `packages/3-extensions/sql-orm-client/test/unbound-tables.ts` (and several other locations, all identical blobs per `git ls-tree`).

Result: `integration-tests` typecheck fails with `Cannot find module './unbound-tables'`.

## Fix 1 — restore TML-2520 storage shape in package-level helpers.ts

**File:** `packages/3-extensions/sql-orm-client/test/helpers.ts`

**Steps:**

1. Add the import at the top of the file (alphabetical order in the existing import block — slots in after `framework-components/codec`, before `framework-components/runtime`):
   ```ts
   import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
   ```

2. Replace all 5 occurrences of `raw.storage.tables.X = ...` with `raw.storage.namespaces[UNBOUND_NAMESPACE_ID].tables.X = ...`. Run:
   ```
   grep -n "raw\.storage\.tables" packages/3-extensions/sql-orm-client/test/helpers.ts
   ```
   to enumerate the 5 sites. Each should become `raw.storage.namespaces[UNBOUND_NAMESPACE_ID].tables.<same suffix>`.

3. **Sanity reference** (read-only — do NOT modify): origin/main's version is at `git show origin/main:packages/3-extensions/sql-orm-client/test/helpers.ts | sed -n '100,235p'`. Use it to confirm your edit shape matches.

**Validate:**
```bash
pnpm --filter @internal/sql-orm-client run typecheck
pnpm --filter @internal/sql-orm-client run test
```
Target: all 4 previously failing test files (`collection-contract`, `collection-runtime`, `collection-variant`, `query-plan-select`) now pass.

**Commit subject:** `fix(@internal/sql-orm-client): restore TML-2520 namespaced storage shape in package-level helpers.ts`

**Commit body:** explain that the rebase conflict resolution kept our pgvector stub additions but dropped TML-2520's per-namespace IR migration; this restores the `raw.storage.namespaces[UNBOUND_NAMESPACE_ID].tables.X` pattern so `buildMixedPolyContract` / `buildStiPolyContract` work against the post-TML-2520 contract shape.

## Fix 2 — add `unbound-tables.ts` at the integration location

**File to create:** `test/integration/test/sql-orm-client/unbound-tables.ts`

**Source content:** copy verbatim from `packages/3-extensions/sql-orm-client/test/unbound-tables.ts` (the source file is small — read it, write the same contents to the new location). The project already keeps identical copies of this file in 3 separate test directories on `origin/main` per `git ls-tree origin/main | grep unbound-tables.ts`; this is a sanctioned pattern, not a workaround.

**Validate:**
```bash
pnpm --filter integration-tests run typecheck
```
Target: the `Cannot find module './unbound-tables'` error in `test/integration/test/sql-orm-client/collection-mutation-defaults.test.ts` is gone.

**Commit subject:** `fix(test/integration): add unbound-tables fixture for moved sql-orm-client tests`

**Commit body:** explain that D5's relocation of `collection-mutation-defaults.test.ts` to integration dropped a relative-import dependency on `./unbound-tables`; this restores the fixture at the new location, matching the project's existing pattern of identical-blob copies under `packages/2-sql/2-authoring/contract-{psl,ts}/test/` and `packages/3-extensions/sql-orm-client/test/`.

## Validate + push

After both fixes:

1. `pnpm typecheck` — **must exit 0** (the QA re-run's hard precondition).
2. `pnpm build` — re-verify 66/66.
3. `pnpm fixtures:check` — green.
4. `pnpm lint:deps` — green.
5. `pnpm --filter @internal/sql-orm-client run test` — record before/after counts; target is 0 failed test files from the namespaced-storage class (4 → 0). Adapter-postgres / PGlite flakes elsewhere are out of scope.

If green: `git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app`.

## Hard rules (composer-tier)

- DCO signoff every commit.
- Explicit `git add <path>` only — never `-A`, never `.`.
- Touch only the two listed source files (plus the new `unbound-tables.ts` at integration).
- Do NOT touch any file under `projects/` — orchestrator-owned.
- Do NOT touch package.json / pnpm-lock.yaml — these fixes don't need dep changes.
- Use `--force-with-lease` for the push.
- If `pnpm typecheck` is still red after these two fixes, STOP and report — don't expand scope.

## Out of scope

- Mongo facade `defineContract` regression (TML-2633).
- Any other pre-existing test flakes.
- PR description updates (separate orchestrator-driven dispatch).
- QA re-run (separate dispatch after typecheck is green).

## Structured report

```
## Status
GREEN / YELLOW / RED

## Fix 1 — package helpers.ts storage shape
- Import added: yes / no
- Occurrences updated: <N> (expected 5)
- Commit: <sha>
- Validation: `pnpm --filter @internal/sql-orm-client run typecheck` <green/red>
- 4 target tests now passing: yes / no / partial (with detail)

## Fix 2 — integration unbound-tables.ts
- File created: yes / no
- Bytes/lines: <N>
- Commit: <sha>
- Validation: `pnpm --filter integration-tests run typecheck` <green/red>

## Final pre-flight
- typecheck: green / red (full output for any remaining errors)
- build: green / red
- fixtures:check: green / red
- lint:deps: green / red
- sql-orm-client tests: <N> failed / <N> passed (compared to YELLOW baseline of 4 failed / 37 passed)

## Push
- pushed / blocked — <reason>
- New HEAD sha: <sha>

## Surfaced for orchestrator attention
- <anything>
```
