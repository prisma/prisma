# D5c — Fix architectural layering: remove extension-pack devDeps from sql-builder, sql-orm-client, mongo-runtime

You are implementing **D5c** in project `facade-import-surface-completion`. This dispatch fixes the architectural violation that D5a R1 surfaced (Turbo cycle blocked extension-pack contract migration) and D5b R1 confirmed (analogous cycle for mongo-runtime). After D5c lands, D5d will migrate the previously-blocked contracts (`pgvector`, `postgis`, mongo-runtime test) to the facade form.

## Context (orient yourself before starting)

Read in this order:

1. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` § Dispatch 5a, 5b (your prior rounds).
2. `projects/facade-import-surface-completion/reviews/code-review.md` § D5a R1 orchestrator note (captures the cycle finding) + the D5b R1 entry (when it lands; for now read the implementer's structured-return analysis of the mongo-runtime cycle).
3. `projects/facade-import-surface-completion/dispatches/d5c-brief.md` (this file — you're already here).
4. Sample the affected files: `packages/2-sql/4-lanes/sql-builder/test/playground/resolved-field-types.test-d.ts`, `packages/3-extensions/sql-orm-client/test/collection-mutation-defaults.test.ts`, `packages/2-mongo-family/7-runtime/test/query-builder.test.ts`.

## Intent

Three in-monorepo packages have `devDependencies` on extension packs (`@internal/extension-pgvector`) or the mongo facade (`@internal/mongo`) for their test fixtures. Turbo treats `devDependencies` as part of the build graph, so these create cycles that prevent the corresponding facade `defineContract` from being used inside the extension packs themselves:

- `@internal/postgres` (facade) → `sql-builder` (dep) → `extension-pgvector` (devDep) → would-be `postgres` (cycle)
- `@internal/postgres` (facade) → `sql-orm-client` (dep) → `extension-pgvector` (devDep) → would-be `postgres` (cycle)
- `@internal/mongo` (facade) → `mongo-runtime` (dep) → would-be `mongo` (cycle, for `mongo-runtime`'s test)

The fix per the architectural layering principle: extension-pack composition tests belong in `test/integration/`, not in package-level `test/` directories that participate in the build graph. Move the offending test files out of the packages into `test/integration/test/`, drop the package-level devDeps, and let `test/integration/` (which already deps on every extension pack) be where cross-pack composition is verified.

## Scope (files in play)

### sql-builder → pgvector cycle

**Files to move from `packages/2-sql/4-lanes/sql-builder/`:**

- `test/playground/resolved-field-types.test-d.ts` — type-test playground using pgvector codecs. Move to `test/integration/test/sql-builder/resolved-field-types.test-d.ts` (or similar; pick a sensible path that aligns with existing integration-test structure).
- `test/fixtures/generated/contract.json` + `test/fixtures/generated/contract.d.ts` — these are EMITTED artifacts. Two options:
  - (a) Move to `test/integration/test/sql-builder/fixtures/generated/` alongside the test that consumes them.
  - (b) Re-emit them in the new location via `prisma-next contract emit` if that's the project's convention for fixtures.

  Check `test/integration/test/sql-builder/fixtures/` (already exists per D5b's migration) for the pattern used by the other sql-builder integration fixtures.

**`packages/2-sql/4-lanes/sql-builder/package.json` updates:**

- Drop `@internal/extension-pgvector` from `devDependencies`.
- Drop any other extension-pack devDeps (none currently; verify with `jq '.devDependencies' package.json | rg extension-`).
- Keep `@internal/adapter-postgres`, `@internal/target-postgres`, `@internal/sql-contract-ts`, etc. — these are framework-level deps, not extension packs.

### sql-orm-client → pgvector cycle

**Files to move from `packages/3-extensions/sql-orm-client/`:**

- `test/collection-mutation-defaults.test.ts` — test exercising collection mutations with pgvector codecs.
- `test/integration/codec-async.test.ts` — codec async integration test.
- `test/integration/runtime-helpers.ts` — helpers used by the above.
- `test/helpers.ts` — test helpers (verify whether they're pgvector-specific or generally useful; if generally useful, keep them in package and refactor the pgvector parts out).
- `test/fixtures/contract.ts` + `test/fixtures/prisma-next.config.ts` + `test/fixtures/generated/contract.json` + `test/fixtures/generated/contract.d.ts` — fixture set.

  All 8 of these should land under `test/integration/test/sql-orm-client/` (or similar — check existing integration-test layout for the convention).

**`packages/3-extensions/sql-orm-client/package.json` updates:**

- Drop `@internal/extension-pgvector` from `devDependencies`.
- Likely also drop `@internal/cli`, `@internal/family-sql`, `@internal/adapter-postgres`, `@internal/driver-postgres`, `@internal/target-postgres` from devDeps IF the only consumer was the moved tests. Verify by checking what's still left in `packages/3-extensions/sql-orm-client/{src,test}/` that imports them.
- Keep `@internal/sql-contract-ts` and `@repo/test-utils` if any remaining source/tests need them.

**Important:** sql-orm-client may have OTHER tests in `test/` that don't use pgvector (e.g. core ORM client functionality tests). Those stay in `packages/3-extensions/sql-orm-client/test/`. Inspect each remaining test file's imports before deciding.

### mongo-runtime → mongo facade cycle

**Files involved:**

- `packages/2-mongo-family/7-runtime/test/query-builder.test.ts` — D5b R1 left this file verbose-with-comment because the test would need `@internal/mongo` as a devDep to use the wrapped `defineContract`, which would close a cycle.
- Move this test file (plus any helpers it uses, e.g. `packages/2-mongo-family/7-runtime/test/setup.ts` — verify dependency) to `test/integration/test/mongo-runtime/query-builder.test.ts` (or similar).

**`packages/2-mongo-family/7-runtime/package.json` updates:**

- Drop any devDeps that were only needed for the moved test (`@internal/family-mongo`, `@internal/mongo-contract-ts`, `@internal/mongo-query-builder`, etc. — inspect carefully; some may be needed by remaining tests in the package).

### `test/integration/` updates

- The moved files need to typecheck and run from their new location.
- `test/integration/package.json` may already have all the necessary deps (it deps on every facade + every extension pack); verify with `pnpm install` + `pnpm typecheck --filter integration-tests`.
- If any moved file imports from `./` relative paths that no longer resolve, fix the imports.

## How to work

1. **Inventory first.** Before moving anything, build a complete file list:

   ```bash
   echo '--- sql-builder ext-pack consumers ---'
   rg -l 'extension-pgvector|@internal/extension-' packages/2-sql/4-lanes/sql-builder/

   echo '--- sql-orm-client ext-pack consumers ---'
   rg -l 'extension-pgvector|@internal/extension-' packages/3-extensions/sql-orm-client/

   echo '--- sql-orm-client tests staying in package ---'
   ls packages/3-extensions/sql-orm-client/test/ | grep -v -E '(collection-mutation-defaults|integration|fixtures|helpers)'

   echo '--- mongo-runtime test using facade ---'
   rg -l '@internal/mongo[^-]|@internal/family-mongo|@internal/target-mongo' packages/2-mongo-family/7-runtime/test/
   ```

   Use this inventory to confirm scope before any moves. If the actual file count diverges from the brief's ~15 estimate by more than 50%, escalate via heartbeat with `phase: scope-escalation`.

2. **Move files with `git mv`** so history is preserved.

3. **Pick the right destination path.** Don't invent a structure. Check what `test/integration/test/` already looks like for similar tests (`ls test/integration/test/sql-builder/`, `ls test/integration/test/mongo/`) and mirror the convention.

4. **Update imports** in moved files. They'll likely need new relative paths (e.g. `'./setup'` → `'../setup'` or whatever fits the new location).

5. **Update package.json files** to drop the now-unused devDeps.

6. **Run `pnpm install`** after package.json changes to refresh the lockfile.

7. **Verify the cycle is broken:**

   ```bash
   pnpm typecheck --filter @internal/sql-builder
   pnpm typecheck --filter @internal/sql-orm-client
   pnpm typecheck --filter @internal/mongo-runtime
   pnpm typecheck --filter integration-tests
   ```

   None should fail. If any of the three packages errors with `Cyclic dependency detected`, the cycle isn't fully broken — investigate.

8. **Run the moved tests in their new location** to verify they still work:

   ```bash
   pnpm test:integration test/integration/test/sql-builder/resolved-field-types.test-d.ts
   pnpm test:integration test/integration/test/sql-orm-client/collection-mutation-defaults.test.ts
   pnpm test:integration test/integration/test/sql-orm-client/codec-async.test.ts
   pnpm test:integration test/integration/test/mongo-runtime/query-builder.test.ts
   ```

   (Adjust paths per your chosen destination.)

9. **Run `pnpm test:packages --filter @internal/sql-builder --filter @internal/sql-orm-client --filter @internal/mongo-runtime`** to confirm the packages still pass their REMAINING (non-moved) tests.

10. **Heartbeat cadence:** every ~5 min, at commit boundaries, before/after long shell commands. Use all required keys (`ts`, `role`, `agent_id`, `round=D5c R1`, `phase`, `last_progress`, `next_step`). D5b had a long silent stretch in `integration-test` phase that required orchestrator ping — don't repeat.

11. **Structured return** at end: verdict, commits + SHAs + one-liners, gate results (per Done-when), explicit before/after on the cycle (`pnpm typecheck --filter` for each of the three packages, showing it doesn't cycle anymore), the new test-file destination paths, anything noteworthy.

## Done when

- [ ] `@internal/extension-pgvector` no longer in `devDependencies` of `sql-builder` or `sql-orm-client`.
- [ ] `@internal/mongo` not added to `mongo-runtime`'s devDeps (it can't be without the cycle); the test that needed it was moved instead.
- [ ] All moved test files run cleanly from their new location (`pnpm test:integration <path>` passes for each).
- [ ] All three packages still typecheck independently and pass their remaining tests.
- [ ] `pnpm install` ran successfully; `pnpm-lock.yaml` reflects the dep changes.
- [ ] `pnpm lint:deps` clean.
- [ ] **The cycle is verifiably broken:** add `@internal/postgres` as a devDep to `packages/3-extensions/pgvector/package.json` and run `pnpm typecheck --filter @internal/extension-pgvector`. It must succeed (no `Cyclic dependency detected`). Revert the experimental devDep after verifying — D5d will do the real migration.
- [ ] Intent-validation: diff covers ONLY (a) `git mv`-ed files, (b) package.json dep updates, (c) `pnpm-lock.yaml` refresh, (d) at most a handful of import-path fixes inside the moved files. No facade source changes, no contract.ts migrations (that's D5d).

## Notes

- **History preservation matters.** Use `git mv` so blame/log on the moved tests still works.
- **Don't migrate any contract.ts files in this dispatch.** D5d handles that. D5c is purely "break the cycle by moving tests + updating deps". Even though it's tempting to also migrate `pgvector/src/contract.ts` in the same commit while you're already here, keep the commit narrowly scoped — that pays off in review readability.
- **mongo/fixtures/contract.ts is OUT OF SCOPE.** That's the file D5b left verbose due to the Mongo facade type regression, not the cycle. Separate problem, separate dispatch.
- **If you find an additional cycle the brief missed,** halt and heartbeat with `phase: scope-escalation` describing what you found. Don't blast through.

## Begin

Acknowledge by writing your first heartbeat with `phase: orienting`. Then inventory + plan + execute.
