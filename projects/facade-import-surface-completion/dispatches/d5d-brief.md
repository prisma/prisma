# D5d brief — Migrate previously-blocked contracts to facade form (post-cycle-break)

## Context

You're picking up D5d of the `facade-import-surface-completion` slice. The architectural cycle that previously blocked extension-pack contracts from importing facade APIs (`@internal/postgres` → `@internal/sql-builder` → `@internal/extension-pgvector` → would-be `@internal/postgres`) was **verifiably broken by D5c R1**:

- Reviewer-confirmed: with the transient `@internal/postgres` devDep on pgvector, `pnpm typecheck --filter @internal/extension-pgvector` returns exit 0 (no cycle).
- Three commits broke the cycle: `82e4e7105` (sql-builder), `8d86ea44b` (sql-orm-client), `cdedc86cb` (mongo-runtime). Two follow-ups (`fb45ba05e`, `ad692094d`) split the model-accessor tests cleanly.

D5d is the **final code dispatch** before D6 docs sweep. Scope is tight: migrate three contract files, add deps, run gates, fix one F4 carryover.

## Read first

1. `projects/facade-import-surface-completion/spec.md` — note that § A7 was just reverted (extension-pack `src/contract.ts` files are NO LONGER exempted; you ARE migrating them).
2. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` § "Dispatch 5d" — your Done-when checklist.
3. `projects/facade-import-surface-completion/reviews/code-review.md` — search for `D5c R1 — reviewer verdict` (the cycle-broken evidence) and `F4` (the carryover finding you'll fix in your first commit).
4. The five D5c commits (`git log --oneline 82e4e7105~1..HEAD`).
5. Quick orientation reads:
   - `packages/3-extensions/pgvector/src/contract.ts` — current verbose form.
   - `packages/3-extensions/postgis/src/contract.ts` — current verbose form.
   - One already-migrated example for reference: `examples/prisma-8-postgis-demo/prisma/contract.ts` (verify form after D5a R1 commit `903c9bc40`).
   - The facade's `defineContract` to know the target shape: `packages/3-extensions/postgres/src/contract/define-contract.ts`.

## Scope

### Migration 1: `packages/3-extensions/pgvector/src/contract.ts`

- Drop the verbose imports: `@internal/sql-contract-ts/contract-builder`'s `defineContract`, `@internal/family-sql/pack` (`sqlFamily`), `@internal/target-postgres/pack` (`postgresPack`).
- Replace with: `import { defineContract } from '@internal/postgres/contract-builder';`
- Drop the `family:` and `target:` keys from the `defineContract(...)` call.
- Verify the wrap accepts `extensionPacks: [...]` and any other config the contract uses. If you hit a `TypesConstraint` rejection or similar wrap-signature issue, **heartbeat and halt** — that's a real finding (parallel to D5b's `PostgresEnumStorageEntry` widening) and should be addressed before continuing.

### Migration 2: `packages/3-extensions/postgis/src/contract.ts`

Same pattern as pgvector.

### Migration 3: The relocated mongo-runtime query-builder test

D5c moved `packages/2-mongo-family/7-runtime/test/query-builder.test.ts` to integration. Find the new location (`git log --diff-filter=R --stat cdedc86cb -- '*query-builder*'` or just `rg --files test/integration/test/mongo-runtime/`). The test had a verbose-with-comment workaround pre-D5c. Now:

- Drop the verbose imports + workaround comment.
- Replace with: `import { defineContract } from '@internal/mongo/contract-builder';`
- Drop `family:` and `target:` from the call.

### Package.json updates

- `packages/3-extensions/pgvector/package.json` — add `@internal/postgres` to dependencies (NOT devDependencies). Check whether `contract.ts` is published or only build-time-consumed; if only build-time, devDeps is fine. **Verify with the package's `exports` map + `files` field**: if `src/contract.ts` is exported as a public entrypoint, it's a runtime dep; otherwise devDep.
- `packages/3-extensions/postgis/package.json` — same as pgvector.
- The mongo-runtime test now lives under `test/integration/` so its deps live in `test/integration/package.json` — verify `@internal/mongo` is already there (it should be from D5b). If not, add it.

### F4 cleanup

Per D5c R1 reviewer finding F4 (at `### D5c R1 — reviewer verdict` in code-review.md):

> [test/integration/test/sql-orm-client/model-accessor.pgvector.test.ts](test/integration/test/sql-orm-client/model-accessor.pgvector.test.ts) L18–19, L36–37 — D5c added accessor-level `as unknown as { cosineDistance(...): unknown }` wrappers. At `f73787e16` those two tests used direct `post['embedding']!.cosineDistance(...)` (integration helpers already wire `pgvectorRuntime`). Restore the baseline call shape; should-fix in D5d.

Fix as your first commit. Should be a 4-line diff.

## "Done when"

- [ ] F4 fixed; `pnpm test:integration` (single-file) on `test/sql-orm-client/model-accessor.pgvector.test.ts` still passes.
- [ ] `packages/3-extensions/pgvector/src/contract.ts` uses `@internal/postgres/contract-builder` and has no `family`/`target` args.
- [ ] `packages/3-extensions/postgis/src/contract.ts` ditto.
- [ ] Moved mongo-runtime query-builder test uses `@internal/mongo/contract-builder` and has no `family`/`target` args + workaround comment removed.
- [ ] `pnpm install` ran cleanly; lockfile reflects new deps.
- [ ] `pnpm typecheck --filter @internal/extension-pgvector --filter @internal/extension-postgis --filter @internal/mongo-runtime --filter integration-tests` all pass.
- [ ] `pnpm test --filter @internal/extension-pgvector --filter @internal/extension-postgis --filter @internal/mongo-runtime` all pass.
- [ ] `pnpm test:integration` for the touched mongo-runtime test (run by path) passes.
- [ ] `pnpm lint:deps` clean (no new layering violations introduced by the new pgvector → postgres / postgis → postgres facade deps).
- [ ] Grep gate: `rg "@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/(pack|control)" packages/3-extensions/{pgvector,postgis}/src/contract.ts test/integration/test/mongo-runtime/` returns zero hits.
- [ ] No skips. No broad `as unknown as Record<string, unknown>` casts.
- [ ] Intent-validation: diff covers only the three migrations + two package.json adds + the F4 4-line revert + lockfile. NO facade source changes, NO test relocations, NO unrelated cleanup.

## How to work

1. **Heartbeat** to `wip/heartbeats/implementer.txt` every ~5 min, at commit boundaries, before/after long shell commands. Format: `ts`, `role: implementer`, `agent_id` (your own), `round=D5d R1`, `phase`, `last_progress`, `next_step`.

2. **Suggested commit shape (one logical change per commit):**
   - Commit 1: F4 cleanup (the accessor cast revert in the moved pgvector test).
   - Commit 2: pgvector contract migration + pgvector/package.json dep + lockfile.
   - Commit 3: postgis contract migration + postgis/package.json dep + lockfile (or merge with commit 2 if lockfile changes are tangled).
   - Commit 4: mongo-runtime test migration.
   - (Or fewer commits if logical; tightly-scoped pgvector+postgis as one commit is also reasonable since the work is identical.)

3. **NO SKIPS, NO BROAD `as unknown as` CASTS.** Same rule that got the sonnet-low implementer banned. If a contract migration uncovers a wrap-signature gap (e.g. `TypesConstraint` rejecting a valid extensionPack), HALT + heartbeat + describe — that's a finding the orchestrator addresses.

4. **Scope discipline:** D5d is purely contract migrations + F4 fix. Do NOT touch facade source files, do NOT touch sql-builder/sql-orm-client/mongo-runtime (D5c's work), do NOT migrate any other contracts (none left).

5. **Cycle re-verification:** After committing the pgvector migration, run `pnpm typecheck --filter @internal/extension-pgvector` directly — confirm the migration succeeds organically (since pgvector now has a real `@internal/postgres` dep, no transient experiment needed). Same for postgis.

## Begin

Write your first heartbeat with `phase: orienting`, then read the spec + plan + code-review verdict + the three source files. Then execute.

## Structured return at end

Verdict (DONE / BLOCKED / NEEDS-FOLLOWUP), commit SHAs + one-liners, gate command outputs (paste exit codes + test counts), per-file decision summary (especially anything non-obvious about pgvector/postgis package.json dep classification — dep vs devDep), any findings, anything noteworthy.
