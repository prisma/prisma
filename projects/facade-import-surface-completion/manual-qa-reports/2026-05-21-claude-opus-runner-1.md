# Manual QA report — TML-2526 (facade import surface completion) — 2026-05-21

> **Script:** `manual-qa.md` (commit `87b91880d`)
> **Runner:** claude-opus-runner-1 (Claude Opus, separate-agent invocation per `drive-qa-run § Author-bias`)
> **Environment:** darwin 25.3.0; Node v24.13.0; pnpm v10.27.0; branch `tml-2526-facades-must-re-export-everything-users-import-in-their-app` @ `87b91880d`
> **Started / finished:** 2026-05-21T11:37:00Z / 2026-05-21T11:58:00Z
> **Verdict:** ❌ Fail

## Summary

❌ **Fail.** The PR HEAD is not merge-ready: the standard pre-QA gate (`pnpm typecheck && pnpm test:packages && pnpm fixtures:check`) is **red on two independent counts** introduced by PR commits:

- **F-1 ⚠️ High** — `pnpm typecheck` fails in `e2e-tests`. Commit `308873659` migrated `test/e2e/framework/test/sqlite/{fixtures/contract.ts,migrations/harness.ts}` to import from `@internal/sqlite/contract-builder` but did not add `@internal/sqlite` to `test/e2e/framework/package.json`'s dependencies (the commit message even brags about doing this for `test/integration` — it was missed here).
- **F-2 ⚠️ High** — `pnpm fixtures:check` fails because commit `7d9116a3b` (`refactor(@internal/sql-orm-client): move pgvector-dependent tests to integration`) wrote an `emit` script with the wrong relative path (`cd ../../../../test/integration` from a directory only 3 levels deep — should be `cd ../../../test/integration`).

Both are 🔧 fix-in-PR. All 8 user-facing scenarios (1–8) dispatched and observed the loaded promises of TML-2526 work end-to-end: the renderer flips to façade specifiers (S1/S2), the `mongo` `.` barrel is gone (S3), the in-tree TML-2633 carve-out comments are honest about the symptom (S4), pre-existing `target-*/migration` imports still work (S5), tree-shaking is clean (S6), and user-facing prose teaches façade form (S7). Six additional 📝 follow-ups surface diagnostic-copy gaps, script-quality drift, and one discoverability question for postgres enums via the TS contract-builder.

The merge-blocking work is the two ⚠️ High items. The 📝 follow-ups can route as a mix of `🎫 ticket` and `❌ accepted-as-is`; the orchestrator confirms disposition.

## Findings

### F-1 — ⚠️ High — `pnpm typecheck` red on PR HEAD: `e2e-tests` package.json missing `@internal/sqlite` dependency

**Scenario:** Pre-flight gate (`drive/qa/README.md § Standard pre-QA gate`)
**Step:** Pre-flight step 1
**Oracle:** Pre-flight gate is green (`pnpm typecheck` exits 0).

**Observed:**
```
e2e-tests:typecheck: test/sqlite/fixtures/contract.ts(7,51): error TS2307: Cannot find module '@internal/sqlite/contract-builder' or its corresponding type declarations.
e2e-tests:typecheck: test/sqlite/migrations/harness.ts(21,23): error TS2307: Cannot find module '@internal/sqlite/contract-builder' or its corresponding type declarations.
e2e-tests:typecheck: test/sqlite/migrations/harness.ts(38,31): error TS2304: Cannot find name 'sqlFamilyPack'.
e2e-tests:typecheck: test/sqlite/migrations/harness.ts(38,54): error TS2304: Cannot find name 'sqlitePack'.
e2e-tests:typecheck:  ELIFECYCLE  Command failed with exit code 2.
 ERROR  e2e-tests#typecheck: command (.../test/e2e/framework) pnpm run typecheck exited (2)
```

**Expected (per script):** `pnpm typecheck` exits 0 against the PR HEAD.

**Reproduction:**
- `git rev-parse HEAD` → `87b91880dd588618d98ed1ea13ec75ae200969e3`
- `git status --porcelain` at failure → 3 untracked orchestrator artefacts under `projects/facade-import-surface-completion/` (unrelated to typecheck).
- Mutated files: none.
- Exact command: `pnpm typecheck`
- Full output captured at `manual-qa-reports/artefacts/F-1/typecheck.log`.

Root cause analysis:
- `git log -1 -- test/e2e/framework/test/sqlite/fixtures/contract.ts` → `308873659 feat(test-fixtures): migrate verbose defineContract form to facade contract-builders`. That commit's message states: *"Also adds @internal/mongo to test/integration package.json since mongo fixtures now import from that facade."* The commit migrated the SQLite e2e fixtures to import from `@internal/sqlite/contract-builder` (façade) but `git show 308873659 -- test/e2e/framework/package.json` shows **no edit** to that file. `test/e2e/framework/package.json` lists `@internal/postgres` as a workspace dep but not `@internal/sqlite` — so pnpm doesn't symlink the sqlite façade into `test/e2e/framework/node_modules`, and the freshly-migrated import fails to resolve.

**Notes:** Trivial fix: add `"@internal/sqlite": "workspace:0.9.0"` to `test/e2e/framework/package.json`'s `dependencies`, run `pnpm install`. The `sqlFamilyPack` / `sqlitePack` errors at `harness.ts:38` likely resolve once the façade is importable (they reference imports that were removed when the file switched to the façade form but a residual line still references them; the typecheck would surface only the import errors if the dependency were declared, but the secondary errors will need inspection too).

### F-2 — ⚠️ High — `pnpm fixtures:check` red on PR HEAD: `sql-orm-client` emit script has wrong relative path

**Scenario:** Pre-flight gate (`drive/qa/README.md § Standard pre-QA gate`)
**Step:** Pre-flight step 1
**Oracle:** Pre-flight gate is green (`pnpm fixtures:check` exits 0).

**Observed:**
```
packages/3-extensions/sql-orm-client emit$ cd ../../../../test/integration && node ../../packages/1-framework/3-tooling/cli/dist/cli.js contract emit --config test/sql-orm-client/fixtures/prisma-next.config.ts && cp test/sql-orm-client/fixtures/generated/contract.json ../../packages/3-extensions/sql-orm-client/test/fixtures/generated/
packages/3-extensions/sql-orm-client emit: sh: line 0: cd: ../../../../test/integration: No such file or directory
packages/3-extensions/sql-orm-client emit: Failed
<repo root>:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @internal/sql-orm-client@0.9.0 emit: `cd ../../../../test/integration && node ...`
Exit status 1
 ELIFECYCLE  Command failed with exit code 1.
```

**Expected (per script):** `pnpm fixtures:check` exits 0.

**Reproduction:**
- `git rev-parse HEAD` → `87b91880dd588618d98ed1ea13ec75ae200969e3`
- Exact command: `pnpm fixtures:check`
- Full output captured at `manual-qa-reports/artefacts/F-2/fixtures-check.log`.

Root cause analysis:
- `git log -1 -- packages/3-extensions/sql-orm-client/package.json` → `7d9116a3b refactor(@internal/sql-orm-client): move pgvector-dependent tests to integration, drop pgvector devDep`. That commit's emit script (`git show 7d9116a3b -- packages/3-extensions/sql-orm-client/package.json`) starts with `cd ../../../../test/integration`. From `packages/3-extensions/sql-orm-client/` (3 levels deep), four `..` overshoots the repo root by one. The same emit script is correct in `packages/2-sql/4-lanes/sql-builder/` (4 levels deep, where four `..` is right) — looks like the path was copy-pasted between packages without adjusting the depth.
- Adjacent observation captured during the same gate run: the root `package.json`'s `fixtures:emit` script references a workspace package `@internal/e2e-sqlite-tests` that does not exist (`No projects matched the filters "@internal/e2e-sqlite-tests"`). pnpm prints the warning but continues; this is **pre-existing** (root `package.json` is unmodified in this PR). Captured as part of the same artefact log but **not** filed as a separate finding against this PR.

**Notes:** Trivial fix: change `cd ../../../../test/integration` → `cd ../../../test/integration` (and adjust the `cp` source/target relative paths accordingly: from `test/sql-orm-client/fixtures/generated/contract.json` → `../packages/3-extensions/sql-orm-client/test/fixtures/generated/` instead of the current `../../packages/...`). Run `pnpm fixtures:check` to confirm green.

### F-3 — 📝 Follow-up — Bare `@internal/mongo` diagnostics don't hint at `/bson`

**Scenario:** 3 — Mongo `.` barrel removal (negative control)
**Step:** Step 4 (TS diagnostic) + the runtime variant via `node -e "import(…)"`
**Oracle:** Whether the diagnostic gives a fighting chance to know to use `/bson`. From the script: "Diagnostics that say only 'cannot find module' without context are functional but unhelpful — note that as observable quality, even if non-blocking."

**Observed (TS):**
```
qa-probe-bare/probe.ts(1,26): error TS2307: Cannot find module '@internal/mongo' or its corresponding type declarations.
```

**Observed (Node runtime, from `examples/mongo-demo`):**
```
ERR: No "exports" main defined in /…/examples/mongo-demo/node_modules/@internal/mongo/package.json imported from /…/examples/mongo-demo/[eval]
```

**Expected (per script):** A diagnostic that nudges the user toward `@internal/mongo/bson`. The script explicitly calls this out as a quality bar even if non-blocking.

**Reproduction:**
- TS: ran `pnpm exec tsc -p qa-probe-bare/tsconfig.json` in a probe directory whose only source file did `import { ObjectId } from '@internal/mongo';`.
- Node runtime: from `examples/mongo-demo`, `node -e "import('@internal/mongo').then(…, e => console.log('ERR:', e.message))"`.
- Both diagnostics tell the user the barrel is gone; neither mentions `/bson` as the right substitute.

**Notes:** Diagnostic-copy quality. Mitigations the project could ship: (a) keep a `"."` exports entry that re-exports a deprecation tombstone whose error message says "use `@internal/mongo/bson` for BSON value constructors" (intentionally non-tree-shaking-friendly, accept the cost for one cycle); (b) ship an ESLint / biome rule that catches `from '@internal/mongo'` and suggests `/bson`; (c) accept the cost and leave the diagnostic as-is (documented in the migration READMEs). The PR's mongo README already names `/bson` as the migration path, so a smart user reaches the right answer; the runner judges this is meaningfully better than nothing and the gap is non-blocking.

### F-4 — 📝 Follow-up — Script's expected migration path doesn't match what the demo emits

**Scenario:** 1 (SQLite migration via façade), 2 (Postgres migration via façade)
**Step:** "What you should see" wording: "migrations/<timestamp>_qa-initial/"
**Oracle:** Script-quality — the script's expected path is the runner's compass for navigating to the rendered artefact.

**Observed:**
- Scenario 1: actual rendered path is `migrations/app/20260521T1145_qa_initial/migration.ts` (note the `app/` subdirectory **and** the underscore separator before `qa_initial`).
- Scenario 2: actual rendered path is `migrations/app/20260521T1146_qa_initial/migration.ts` (same pattern).

**Expected (per script):** `migrations/<timestamp>_qa-initial/migration.ts` (no `app/`; dash separator).

**Notes:** The substantive oracle — what the rendered `migration.ts` imports from — passed cleanly in both scenarios (only `@internal/sqlite/migration` for S1, only `@internal/postgres/migration` for S2). This finding is purely about the script's wayfinding text; an unsophisticated runner could waste minutes hunting for the wrong path. File against `drive-qa-plan` to update for the next QA round; the underlying behaviour is correct.

### F-5 — 📝 Follow-up — Scenario 3's tmpdir-with-`link:` setup is awkward; runner used example workspace instead

**Scenario:** 3 — Mongo `.` barrel removal (negative control)
**Step:** Steps 2–5 (tmpdir consumer setup)
**Oracle:** Script-reproducibility — the script's prescribed setup ought to run without runner improvisation.

**Observed:** The script's tmpdir consumer (`package.json` with `link:../../../packages/3-extensions/mongo` + a sibling `pnpm install`) requires the runner to symlink across an arbitrary number of `..`s relative to `$PN_QA_TMP` (which is in `/var/folders/...`). The script names this as a known issue and offers an alternative ("use `pnpm exec node -e \"require.resolve(…)\"` from the repo root"), so the runner took the alternative — but did so by writing the TS probe inside `examples/mongo-demo/qa-probe-*/` (a tracked workspace path) rather than `$PN_QA_TMP`, because the example's `node_modules` was the only directly-usable resolution root for both TS and Node's NodeNext exports resolver.

**Expected (per script):** A tmpdir consumer that works the way the script describes. The runner restored cleanly (`rm -rf examples/mongo-demo/qa-probe-*` + `git status --porcelain` empty) but the deviation from `tmpdir` isolation merits a script-quality note.

**Notes:** File against `drive-qa-plan` to either (a) document the "run TS probes inside an existing example app's node_modules" route as the canonical S3 path, or (b) author a self-contained probe that uses an absolute `node_modules` path in `tsconfig.paths` and avoids the `link:` step. Restore was clean.

### F-6 — 📝 Follow-up — Scenario 4's scratch contracts don't reproduce the documented TML-2633 symptom

**Scenario:** 4 — Mongo `defineContract` wrap regression (re-enactment of TML-2633)
**Step:** Steps 3–7 (scratch `contract-facade.ts` + `contract-verbose.ts` + probe)
**Oracle:** The in-tree workaround comments name two symptom shapes: (a) "discriminated union contracts with embedded relations" (`test/integration/test/mongo/fixtures/contract.ts`) and (b) "PlanRow row shapes collapse to `_id: never` / `count: never`" when consumers use `mongoQuery<typeof contract>` chains (`test/integration/test/mongo-runtime/query-builder.test.ts`).

**Observed:** The script's scratch `contract-facade.ts` (a single `Order` model with `_id`, `amount`, `status`) typechecks cleanly through the façade wrap. Hover-inspect probe (`type IdType = typeof facadeContract.models.Order.fields['_id']`) does **not** collapse to `never`; it resolves to a concrete codec-shaped type. The scratch contract is too simple to trigger either documented shape (no discriminated union, no embedded relations, no `mongoQuery` chain).

**Expected (per script):** The scratch contract reproduces the documented inference collapse (so the runner can confirm the in-tree workaround is honest about a real symptom).

**Notes:** The in-tree workaround-comment evidence is still sound: both files (`test/integration/test/mongo/{fixtures/contract.ts,..-runtime/query-builder.test.ts}`) carry TML-2633-naming comments matching the symptoms above, and both still import from `@internal/mongo-contract-ts/contract-builder` (the verbose form). AC-7 (documented carve-out) is genuinely covered by those static reads. File against `drive-qa-plan` to either (a) rewrite scenario 4's scratch to mirror one of the actual symptom shapes (discriminated union with embedded relations, or a `mongoQuery<typeof contract>` chain), or (b) drop the scratch probe and restrict scenario 4 to the in-tree-comment static read.

### F-7 — 📝 Follow-up — SQLite demo imports column-types from `@internal/adapter-sqlite`, which skill cluster forbids

**Scenario:** 1 — Author a fresh SQLite migration via the façade
**Step:** Step 2 (read façade-form sources)
**Oracle:** `skills/prisma-next-contract/SKILL.md` line 45: "Never reach into `@internal/cli/*`, `@internal/family-*`, `@internal/target-*`, `@internal/adapter-*`, `@internal/driver-*`, or `@internal/sql-contract-*` from user code."

**Observed:** `examples/prisma-8-demo-sqlite/prisma/contract.ts` opens with:
```ts
import { datetimeColumn, textColumn } from '@internal/adapter-sqlite/column-types';
import { defineContract, rel } from '@internal/sqlite/contract-builder';
```
The first import is from `@internal/adapter-sqlite/*`, an internal-package subpath that skill-cluster prose tells users they should not reach into.

**Expected (per script):** The script's Oracle for S1 explicitly says "Exactly one Prisma Next import in `prisma-next.config.ts`" — and lists `defineContract, rel` from the façade for contract.ts. The script doesn't speak to whether `contract.ts` should also need an `adapter-sqlite` import.

**Notes:** Two possible resolutions: (a) re-export the SQLite column-type primitives from `@internal/sqlite/contract-builder` (or a new `@internal/sqlite/column-types` subpath) so user-authored `contract.ts` files stay strictly on the façade; (b) update the skill rule to exempt column-types specifically. The same `adapter-sqlite/column-types` import pattern is used in `test/e2e/framework/test/sqlite/fixtures/contract.ts`, so any fix has multiple consumers. Note this is an end-user surface gap that TML-2526 partially closes (`/contract-builder` lands on the façade, but adapter-`column-types` remains internal).

### F-8 — 📝 Follow-up — `workspace`-isolation worktree setup needs `pnpm install && pnpm build && pnpm install` cycle

**Scenario:** 1, 2 (workspace-isolated)
**Step:** Setup (before each scenario's Steps)
**Oracle:** Script-reproducibility — the runner can stand up a `workspace` worktree without improvisation.

**Observed:** After `git worktree add --detach $PN_QA_WORKTREES/scenario-1 HEAD`, running `pnpm install --frozen-lockfile` succeeds but emits `WARN  Failed to create bin at .../node_modules/.bin/prisma-next. ENOENT: no such file or directory, open '.../@internal/cli/dist/cli.js'`. The CLI's bin link isn't created because `cli/dist/cli.js` doesn't exist yet at install-time. Running `pnpm build` then populates `cli/dist/`. But `pnpm exec prisma-next` still fails (`Command "prisma-next" not found`) until a **second** `pnpm install` is run to recreate the bin links now that `cli.js` exists.

**Expected (per script):** A single `pnpm install` is enough to set up the worktree, per the manual-qa.md pre-flight step 3 (`pnpm install --frozen-lockfile` exits 0).

**Notes:** File against `drive-qa-plan`. Either (a) add an explicit "after `git worktree add`, run `pnpm install && pnpm build && pnpm install`" step to the workspace-isolation setup, or (b) require the runner to use `pnpm exec node $WORKTREE/packages/1-framework/3-tooling/cli/dist/cli.js …` instead of `pnpm prisma-next …`, side-stepping the bin-link race. The current script implies a clean single-install flow that doesn't actually work for `workspace` scenarios.

### F-9 — 📝 Follow-up — Postgres TS contract-builder doesn't expose `enumType` / `field.enum` in the discoverable surface

**Scenario:** 8 — Exploratory charter
**Step:** Probe minute ~5 (postgres enum field via TS contract-builder)
**Oracle:** Exploratory judgement — a developer trying to declare an enum via the postgres façade's `contract-builder` callback should have a discoverable path.

**Observed:** Naïve probe based on existing demo patterns:
```ts
import { defineContract } from '@internal/postgres/contract-builder';
defineContract({ capabilities: {…} }, ({ field, model, enumType }) => {
  const Status = enumType('Status', ['active', 'inactive', 'pending']);
  const User = model('User', { fields: { id: field.id.uuidv4(), status: field.enum(Status) } });
  return { models: { User } };
});
```
TypeScript errors:
```
qa-explore/postgres-enum.ts(15,20): error TS2339: Property 'enumType' does not exist on type 'ComposedAuthoringHelpers<…>'.
qa-explore/postgres-enum.ts(21,23): error TS2339: Property 'enum' does not exist on type 'CoreFieldHelpers & FieldHelpersFromNamespace<…>'.
```

**Notes:** This may be intentional — postgres enums may live behind PSL only, or behind a different surface (a separate import from `@internal/postgres/contract-builder`, an extension pack, etc.). I didn't search exhaustively. But the natural ergonomic path doesn't surface a discoverable option to the developer; a real user reaching for "how do I declare an enum?" gets the TS2339 wall. Worth a docs sweep or a façade-side ergonomic addition. AC-4 explicitly carves out: "Each façade's `/contract-builder` pre-binds `family` + `target`; inference preserved for **postgres + sqlite**" — the enum entry point may be out of TML-2526's explicit scope but it's adjacent and obviously something the next round of work will surface.

## Per-scenario log

| # | Scenario | Isolation | Wallclock | Result | Findings |
| - | -------- | --------- | --------- | ------ | -------- |
| Pre-flight | `pnpm typecheck && pnpm fixtures:check` | — | ~3m | ❌ fail | F-1, F-2 |
| 1 | SQLite migration via façade | workspace | ~7m (incl. `pnpm install && pnpm build && pnpm install` in worktree) | ✅ pass | F-7, F-8 |
| 2 | Postgres migration via façade | workspace | ~3m | ✅ pass | — |
| 3 | Mongo `.` barrel removal (negative control) | tmpdir (workspace-substitute, see F-5) | ~2m | ✅ pass | F-3, F-5 |
| 4 | Mongo `defineContract` wrap regression (re-enactment) | tmpdir (workspace-substitute) | ~2m | ✅ pass | F-6 |
| 5 | Pre-existing rendered migration backwards-compat | read-only | ~2m | ✅ pass | — |
| 6 | Tree-shaking observable check (judgement) | tmpdir | ~1m | ✅ pass | — |
| 7 | Skill cluster + façade READMEs + ADR 208 read | read-only | ~2m | ✅ pass | — |
| 8 | Exploratory: `/contract-builder` inference probes | tmpdir (workspace-substitute) | ~6m (budget 30m; remaining ideas in Suggested follow-ups) | (notes; see below) | F-9 |

Total wallclock: ~28 minutes (excluding the brief shell-session hang at the start of scenario 8, recovered by spawning a fresh shell context).

## Exploratory notes

**Charter time budget:** 30 minutes. Used: ~6 minutes (limited by the broader runtime overhead — multiple worktree setup + pnpm install cycles consumed budget earlier than expected). Remaining ideas listed in Suggested follow-ups; none of them are blockers and none point at known regressions.

**What was tried:**
- **Postgres enum field via TS contract-builder.** Naïve destructure `({ field, model, enumType })` and `field.enum(Status)` both error out — see F-9.
- **Read of existing `examples/prisma-8-postgis-demo/prisma/contract.json`** to look for emitted enum shapes — confirms enums do exist in the contract IR; the TS authoring path for them is unclear.

**What surprised me:**
- Tree-shaking (S6) is *extremely* clean — the bundle is 298 bytes containing literally `import {…} from 'mongodb'; console.log(new ObjectId().toString());`. The `/bson` subpath is doing the bare-minimum-shim job perfectly. This is a strong positive signal for AC-8.
- Scenario 2's rendered `migrations/.../end-contract.d.ts` (the sibling type-only file, not `migration.ts`) imports many types from `@internal/target-postgres/codec-types`. The script's oracle is about `migration.ts` specifically (which is clean) — but a strict reading of "users see only façade specifiers in their checked-in migration files" would also catch `end-contract.d.ts`. Not filed as a finding because the script's oracle is narrower; flagged here for awareness.
- Workspace-worktree setup is noisier than the script implies (F-8 captures this).

**What "felt off" but I couldn't name:** The mongo bare-import diagnostic ("No `exports` main defined") is technically correct but reads like a system error, not a migration hint. F-3 captures the surface. Diagnostic-copy ergonomics across the façade subpath surfaces is a thread worth pulling on; this round only had time to look at the mongo bare-import case.

## Coverage outcome

Each AC inherits its worst-severity finding from any covering scenario. Pre-flight findings (F-1, F-2) do NOT roll into individual AC results because they're substrate-level (gate failures), not user-surface assertions; the verdict policy handles them at report level.

| AC ID | Scenario(s) | Result | Notes |
| ----- | ----------- | ------ | ----- |
| AC-1 — `@internal/postgres/migration` re-exports + renderer flip | 2, 5, 7 | ✅ pass | Rendered `migration.ts` imports only from `@internal/postgres/migration`. |
| AC-2 — `@internal/sqlite` full surface parity + renderer flip | 1, 7 | ✅ pass (with 📝 F-7) | Rendered `migration.ts` imports only from `@internal/sqlite/migration`. F-7 surfaces an adjacent column-types gap. |
| AC-3 — `@internal/mongo` `/control` + `/bson` + widened `/config` | 3, 6, 7 | ✅ pass | `/bson` subpath resolves and tree-shakes cleanly. |
| AC-4 — Each façade's `/contract-builder` pre-binds family + target; postgres + sqlite inference preserved | 1, 2, 7, 8 | ✅ pass (with 📝 F-9) | S1 + S2 confirm typechecks of demo contract.ts. F-9 surfaces a postgres-enum ergonomic gap (likely out of TML-2526 scope). |
| AC-5 — Breaking change: `@internal/mongo` `.` barrel is gone | 3 | ✅ pass (with 📝 F-3) | Bare import rejects (TS + Node runtime). F-3 surfaces diagnostic copy quality. |
| AC-6 — Backwards-compat: existing rendered migrations on `target-*/migration` continue to work | 5 | ✅ pass | `examples/prisma-8-demo` typechecks; `pnpm prisma-next migration list/check` both happy. |
| AC-7 — Mongo wrap regression carve-out (TML-2633) documented + matching symptom | 4, 7 | ✅ pass (with 📝 F-6) | In-tree comments name TML-2633 + describe symptom. F-6 surfaces scratch-contract mis-fit. |
| AC-8 — Tree-shaking: façade subpaths are independent entrypoints | 6 | ✅ pass | esbuild bundle of `ObjectId`-only consumer is 298 bytes; only `bson.mjs` pulled in. |

## Disposition map (required when any finding exists)

| Finding | Severity | Proposed disposition | Evidence / next step |
| ------- | -------- | -------------------- | -------------------- |
| F-1 | ⚠️ High | 🔧 fix-in-PR | Add `"@internal/sqlite": "workspace:0.9.0"` to `test/e2e/framework/package.json` dependencies; re-run `pnpm typecheck` to confirm green. Trivial edit. May surface secondary `sqlFamilyPack` / `sqlitePack` cleanups in `harness.ts` (lines 38 of that file) that are remnants of the migration. |
| F-2 | ⚠️ High | 🔧 fix-in-PR | `packages/3-extensions/sql-orm-client/package.json`: change `cd ../../../../test/integration` → `cd ../../../test/integration` in the `emit` script and adjust the `cp` source/dest paths to match the corrected base. Re-run `pnpm fixtures:check` to confirm green. Compare with the (working) `packages/2-sql/4-lanes/sql-builder/package.json` emit script for reference. |
| F-3 | 📝 Follow-up | 🎫 ticket | Track as a diagnostic-copy ergonomics ticket (subject: "mongo bare import diagnostic should hint at `/bson`"). Owner: framework team. The PR's README guidance already names `/bson`, so this is gap-filling, not load-bearing. |
| F-4 | 📝 Follow-up | 🎫 ticket | Track against `drive-qa-plan`: update scenario 1/2 "What you should see" path to reflect the `migrations/app/<timestamp>_<name>` rendering pattern (with underscore separator) used by the demos. |
| F-5 | 📝 Follow-up | 🎫 ticket | Track against `drive-qa-plan`: document the "use an example workspace's `node_modules` as resolution root for tmpdir-scratch probes" route as the canonical workaround for the `link:`-tmpdir setup difficulty. |
| F-6 | 📝 Follow-up | 🎫 ticket | Track against `drive-qa-plan`: rewrite scenario 4's scratch to use a discriminated-union-with-embedded-relations shape OR drop the scratch probe and restrict scenario 4 to the static read of in-tree comments + verbose-form imports. |
| F-7 | 📝 Follow-up | 🎫 ticket | Track as a façade-surface adjacency ticket: decide whether `@internal/sqlite/contract-builder` (or a new `/column-types` subpath) should re-export `datetimeColumn`/`textColumn`/etc., or whether the skill rule needs an exemption. End-user surface gap; non-blocking. |
| F-8 | 📝 Follow-up | 🎫 ticket | Track against `drive-qa-plan`: document the `pnpm install && pnpm build && pnpm install` cycle (or an equivalent workaround) as part of `workspace`-isolation setup. |
| F-9 | 📝 Follow-up | 🎫 ticket | Track as a postgres-enum ergonomics ticket (subject: "postgres TS contract-builder: where do enums go?"). Likely out of TML-2526's scope but adjacent; the next "façade ergonomics" round should pick it up. |

Verdict policy: F-1 and F-2 carry 🔧 fix-in-PR. Per `drive-qa-run § The report skeleton`: "Any finding has a 🔧 fix-in-PR disposition → ❌ Fail. The PR is not merge-ready until those land." → ❌ Fail.

## Suggested follow-ups

- **F-1 / 🔧 fix-in-PR** — Add `@internal/sqlite` workspace dep to `test/e2e/framework/package.json`. Inspect `harness.ts:38` for cleanups left over from the `308873659` façade-migration commit (`sqlFamilyPack` / `sqlitePack` references that should have been removed when the file flipped to the façade form).
- **F-2 / 🔧 fix-in-PR** — Fix the `sql-orm-client` emit script's relative path. Adjacent worth-checking: do the same patterns work for `@internal/sql-builder`'s emit script (its depth is correct, but worth a sanity check), and is the root `package.json`'s `@internal/e2e-sqlite-tests` filter a typo for an existing pkg name or a stale reference?
- **F-3 / 🎫 ticket** — File a "diagnostic copy quality on bare `@internal/mongo` import" ticket. The PR's README points the user at `/bson`; close the loop in the error envelope too.
- **F-4 / 🎫 ticket** against `drive-qa-plan` — Refresh the "What you should see" path text in scenarios 1 and 2 of `manual-qa.md` to match the demos' actual rendering pattern (`migrations/app/<timestamp>_qa_initial`).
- **F-5 / 🎫 ticket** against `drive-qa-plan` — Document the "TS probe inside an existing example workspace" route as the canonical S3 setup; the `link:`-tmpdir route is awkward in practice.
- **F-6 / 🎫 ticket** against `drive-qa-plan` — Rewrite S4's scratch to actually reproduce the documented inference collapse, or drop the scratch in favour of a static in-tree-comment read.
- **F-7 / 🎫 ticket** — Decide where column-types (`datetimeColumn`, `textColumn`, etc.) belong for end-user-facing SQLite code. Either the SQLite façade exposes them, or the skill-cluster rule explicitly carves out adapter-`column-types`.
- **F-8 / 🎫 ticket** against `drive-qa-plan` — Document the worktree setup cycle (or recommend the `pnpm exec node …/cli.js` workaround) for `workspace`-isolation scenarios.
- **F-9 / 🎫 ticket** — Investigate the postgres-enum TS-contract-builder ergonomic gap. Either it's intentionally PSL-only, or it should grow a façade-side surface.

**Exploratory ideas the charter didn't get to (filed here, not in Findings):**
- SQLite capability-flag toggling (`capabilities.sql.foreignKeys`) through the façade wrap — does it surface back through `typeof contract`?
- Postgres + `extensionPacks: { pgvector }` through the façade — does the extension-pack typing flow through?
- Multi-relation contracts (`rel.belongsTo` + `rel.hasMany`) inference depth through the postgres wrap, beyond the demo's two-model shape.
- Mongo discriminated-union variant inference depth (paired with F-6's redesigned scratch).
- Malformed shapes (extra `family:` key on a façade `defineContract` call) — does the wrap reject with a useful envelope?

These are next-round candidate probes for the exploratory charter, not findings against this PR.

---

**Run finished:** 2026-05-21T11:58:00Z
**User checkout state at exit:** `git status --porcelain` shows only the 3 untracked orchestrator artefacts (`projects/facade-import-surface-completion/dispatches/qa-{plan,run}-brief.md`, `projects/facade-import-surface-completion/manual-qa.md`) that were present at run start — the runner did not modify them. All scenario worktrees (`$PN_QA_WORKTREES/scenario-{1,2}`) removed via `git worktree remove --force`; all scenario tmpdirs (`$PN_QA_TMP/scenario-*`) removed via `rm -rf`. No worktree or tmpdir leakage.
