# Manual QA — TML-2526 (facade import surface completion)

> **Be the user.** You're a developer who installs `@internal/<target>` and writes every import as `@internal/<target>/<subpath>`. You author a contract, scaffold a migration, drop a tree-shake-aware BSON import into a scratch app, and confirm the workarounds carved out for TML-2633 still match the symptom they describe. You are not exercising the test harness — you are exercising the live façade surface, the renderer's output on disk, and the documentation that teaches that surface.
>
> **Out of scope of this script.**
> - Re-running `pnpm test:packages` / `pnpm test:integration` / `pnpm test:e2e` against the clean tree (CI already runs these — see "Scenarios deliberately not in this script").
> - Running the renderer string-pin tests in `packages/3-targets/**/test/migrations/**` directly (CI covers them; the user-visible question is what *new* renderer output looks like, scenarios 1 and 2 below).
> - Exercising the live MongoDB control client (requires `mongod`; the integration test suite already covers it, and a manual run adds no judgement signal CI lacks).
> - Re-rendering existing user migrations (explicit non-goal in the project spec; scenario 5 confirms they keep working unmodified).
>
> **Spec:** `projects/facade-import-surface-completion/spec.md`
> **Slice spec:** `projects/facade-import-surface-completion/slices/facade-completion/spec.md`
> **Plan:** `projects/facade-import-surface-completion/slices/facade-completion/plan.md`
> **PR:** https://github.com/prisma/prisma-next/pull/557

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Author a fresh SQLite migration via the façade | A SQLite user can plan a migration from a façade-only `prisma-next.config.ts` + `prisma/contract.ts`, and the rendered `migration.ts` imports `@internal/sqlite/migration` | workspace | AC-2, AC-4 |
| 2 | Author a fresh Postgres migration via the façade | A Postgres user can plan a migration the same way, and the rendered `migration.ts` imports `@internal/postgres/migration` | workspace | AC-1, AC-4 |
| 3 | Mongo `.` barrel removal **(negative control)** | Importing from bare `@internal/mongo` fails with a useful diagnostic; users must reach for `/bson` | tmpdir | AC-5 |
| 4 | Mongo `defineContract` wrap regression **(re-enactment of TML-2633)** | The two in-tree workaround files honestly describe the symptom — the verbose form preserves inference, the façade wrap collapses it | tmpdir | AC-7 |
| 5 | Pre-existing rendered migration keeps working (backwards-compat) | An on-disk `migration.ts` that still imports `@internal/target-postgres/migration` typechecks against the updated workspace; the `target-*` `/migration` subpath is still in place | read-only | AC-6 |
| 6 | Tree-shaking observable check **(judgement)** | Bundling a consumer that only imports `ObjectId` from `@internal/mongo/bson` does not pull `/control`, `/runtime`, or any other façade subpath | tmpdir | AC-8 |
| 7 | Read of skill cluster + façade READMEs + ADR 208 example | The durable docs a new user encounters teach façade form unconditionally; no `target-*` rhetoric lingers in user-facing prose | read-only | AC-1, AC-2, AC-3, AC-4 |
| 8 | Exploratory: `/contract-builder` inference probes across three façades | Probe unanticipated `defineContract` shapes (enums, embedded relations, FK chains, capability flags, extension packs) — discover surprises the scripted scenarios skipped | tmpdir | (no AC; charter) |

> Scenarios marked **(negative control)** plant a violation, observe the failure, then restore. **(Judgement)** scenarios require runner evaluation against an explicit oracle no test can easily assert. **(Re-enactment)** scenarios reproduce an originally-failing user flow on real artefacts. **(Exploratory)** scenarios are time-boxed charters with no scripted steps.
>
> The **Isolation** column tells the runner how to schedule the scenario in parallel: `tmpdir` (own scratch dir, shared read-only clone), `workspace` (own `git worktree`), `read-only` (no isolation needed), or `external` (network-bound; rate-limit-aware).

## Pre-flight

1. From the repo root, confirm the runner-standard pre-QA gate is green:

   ```bash
   pnpm typecheck && pnpm test:packages && pnpm fixtures:check
   ```

   If any of these are red on PR HEAD, halt and surface to the orchestrator before continuing — QA findings against an unverified tree waste runner time.

2. Confirm the PR's commits are checked out (`git log --oneline | head -10` includes recent D6 docs-sweep commits — `6c9cf38b9` or `cbecd1a7a`, per the PR description).

3. Confirm `pnpm install` has been run on the current HEAD (`pnpm install --frozen-lockfile` exits 0).

4. Confirm `$PN_QA_TMP` is set and the directory is empty (the runner allocates this; if invoking manually, `export PN_QA_TMP=$(mktemp -d)`).

5. Confirm a clean `git status` (`git status --porcelain` is empty). Scenarios 1 and 2 take a `workspace` isolation tag — the runner allocates a fresh `git worktree` for each — so the in-repo working tree must start clean.

---

## Scenario 1 — Author a fresh SQLite migration via the façade

**What you're proving from the user's seat.** A developer who has installed `@internal/sqlite` should be able to set `defineConfig({ contract, db })`, write a `contract.ts` whose only Prisma Next import is `defineContract` from `@internal/sqlite/contract-builder`, run `pnpm prisma-next migration plan`, and end up with a `migration.ts` on disk whose only Prisma Next import is `@internal/sqlite/migration`. This is the **end-to-end journey smoke** for the largest new surface (sqlite was `/runtime`-only before this PR) and the most user-visible piece of evidence that the renderer flip + the contract-builder wrap line up.

**Covers:** AC-2, AC-4

**Isolation:** `workspace` (writes a tracked `migrations/` directory inside `examples/prisma-8-demo-sqlite/`).

**Oracle:**
- The freshly-rendered `migrations/<timestamp>_qa-initial/migration.ts` file's `import` lines reference **only** `@internal/sqlite/migration` (and possibly relative imports of the sibling `ops.json` / `end-contract.json`); no `@internal/target-sqlite/*` and no `@internal/family-sql/*` specifiers appear.
- The example's `prisma-next.config.ts` and `prisma/contract.ts` (read these first, before running the plan) already model the façade-only shape promised by the PR: `defineConfig` from `@internal/sqlite/config` and `defineContract` from `@internal/sqlite/contract-builder`, with no `family:` or `target:` argument in the `defineContract` call.

**Preconditions:**
- Pre-flight gate green.
- `examples/prisma-8-demo-sqlite/migrations/` does not exist at start (`ls examples/prisma-8-demo-sqlite/migrations 2>&1` returns "No such file or directory").

### Steps

1. From the worktree root, change into the SQLite demo:

   ```bash
   cd examples/prisma-8-demo-sqlite
   ```

2. Read the façade-form sources the user would have written. These are tracked files — confirm with `git show HEAD:prisma-next.config.ts | head -20` and `git show HEAD:prisma/contract.ts | head -20`. The runner is looking at:
   - Exactly one Prisma Next import in `prisma-next.config.ts`: `import { defineConfig } from '@internal/sqlite/config';`.
   - In `prisma/contract.ts`: `import { defineContract, rel } from '@internal/sqlite/contract-builder';` with no `family` or `target` argument in the `defineContract(…)` call.

3. Emit the contract:

   ```bash
   pnpm prisma-next contract emit
   ```

   This produces `prisma/contract.json` and `prisma/contract.d.ts` (or refreshes them). Should exit 0.

4. Plan the migration:

   ```bash
   pnpm prisma-next migration plan --name qa-initial
   ```

   Should exit 0 and report the new migration directory path in its summary output.

5. Inspect the rendered `migration.ts`:

   ```bash
   ls migrations/
   cat migrations/*_qa-initial/migration.ts
   ```

### What you should see

- `pnpm prisma-next migration plan` exits 0 and prints a summary mentioning a new migration package at `migrations/<timestamp>_qa-initial/`.
- The newly-created `migrations/<timestamp>_qa-initial/migration.ts` file's `import` block at the top of the file reads exactly:

  ```ts
  import { … } from '@internal/sqlite/migration';
  ```

  (where `…` is whatever subset of `Migration`, `MigrationCLI`, `placeholder`, `createTable`, `addColumn`, op-factory calls, etc., the planner emitted for this contract).
- No occurrence of `@internal/target-sqlite` anywhere in the new `migration.ts`.
- The sibling files `migration.json`, `ops.json`, `end-contract.json`, `end-contract.d.ts` exist in the same migration directory.
- The example's own `pnpm typecheck` is still clean after the plan:

  ```bash
  pnpm typecheck
  ```

  Exit 0.

### Failure modes (anything matching these = a finding the runner will classify)

- `migration plan` exits non-zero; capture stdout + stderr verbatim.
- Rendered `migration.ts` imports `@internal/target-sqlite/migration` instead of (or alongside) `@internal/sqlite/migration` — indicates the renderer flip and/or the `TARGET_MIGRATION_MODULE` constant flip didn't fully land.
- Rendered `migration.ts` mixes specifiers (`Migration` from façade but `addColumn` from `target-*`, or any similar mix) — indicates `op-factory-call.ts`'s `TARGET_MIGRATION_MODULE` is out of sync with `render-typescript.ts`'s `BASE_IMPORTS`.
- The contract emit step fails with a `defineContract` argument-shape error mentioning `family` or `target` — indicates the SQLite contract-builder wrap signature regressed.
- `pnpm typecheck` for the example becomes red after the plan — indicates the freshly-rendered `migration.ts` imports symbols the new `@internal/sqlite/migration` does not re-export.
- The new migration directory is created but is empty (no `migration.ts`) — indicates renderer wiring is broken further upstream.

### Restore

1. From the SQLite demo directory:

   ```bash
   rm -rf migrations
   # The contract.json + contract.d.ts may also have refreshed; restore them too.
   git restore prisma/contract.json prisma/contract.d.ts
   git status --porcelain
   ```

   `git status --porcelain` should be empty.

---

## Scenario 2 — Author a fresh Postgres migration via the façade

**What you're proving from the user's seat.** Same as scenario 1, but for the flagship Postgres target. Confirms the renderer flip + the contract-builder wrap line up symmetrically across both SQL targets — and that the rendered `migration.ts` imports `@internal/postgres/migration`, not `@internal/target-postgres/migration`. **End-to-end journey smoke** for the FR8 + FR1 combination.

**Covers:** AC-1, AC-4

**Isolation:** `workspace` (writes a tracked `migrations/` directory inside `examples/react-router-demo/`).

**Oracle:**
- The freshly-rendered `migrations/<timestamp>_qa-initial/migration.ts` file's `import` lines reference **only** `@internal/postgres/migration`; no `@internal/target-postgres/*` and no `@internal/family-sql/*`.
- The example's `prisma/contract.ts` (read before running) uses `defineContract` from `@internal/postgres/contract-builder` with no `family:` / `target:` argument.

**Preconditions:**
- Pre-flight gate green.
- `examples/react-router-demo/migrations/` does not exist at start (`ls examples/react-router-demo/migrations 2>&1` reports "No such file or directory").
- `PRISMA_NEXT_CONTRACT_SOURCE=ts` env var is set so the example reads `prisma/contract.ts` (per the demo's `prisma-next.config.ts` switch); otherwise it defaults to `prisma/contract.prisma`, which does not exercise the contract-builder wrap.

### Steps

1. From the worktree root:

   ```bash
   cd examples/react-router-demo
   export PRISMA_NEXT_CONTRACT_SOURCE=ts
   ```

2. Read the façade-form sources:

   ```bash
   git show HEAD:prisma-next.config.ts | head -25
   git show HEAD:prisma/contract.ts | head -10
   ```

   Confirm `prisma/contract.ts` opens with `import { defineContract, rel } from '@internal/postgres/contract-builder';` and the `defineContract` call has no `family:` or `target:` keys.

3. Emit the contract:

   ```bash
   pnpm prisma-next contract emit
   ```

4. Plan the migration:

   ```bash
   pnpm prisma-next migration plan --name qa-initial
   ```

5. Inspect the rendered `migration.ts`:

   ```bash
   ls migrations/
   cat migrations/*_qa-initial/migration.ts
   ```

### What you should see

- `pnpm prisma-next migration plan` exits 0.
- The rendered `migration.ts`'s `import` block reads exactly:

  ```ts
  import { … } from '@internal/postgres/migration';
  ```

  with no occurrence of `@internal/target-postgres` anywhere in the file.
- The example's `pnpm typecheck` is clean after the plan.

### Failure modes

- Mirror of scenario 1's failure modes, swapping `sqlite` → `postgres` and `target-sqlite` → `target-postgres`.
- The `defineContract` call refuses an extension-pack-free contract — would indicate the Postgres contract-builder wrap's input type incorrectly requires `family` / `target` / `extensionPacks`.

### Restore

```bash
rm -rf migrations
git restore prisma/contract.json prisma/contract.d.ts 2>/dev/null || true
unset PRISMA_NEXT_CONTRACT_SOURCE
git status --porcelain
```

`git status --porcelain` should be empty.

---

## Scenario 3 — Mongo `.` barrel removal (negative control)

**What you're proving from the user's seat.** The PR's one genuine breaking change is `@internal/mongo`'s top-level `.` barrel removal. A user who had `import { ObjectId } from '@internal/mongo'` in their app must now see that import fail at typecheck (and at runtime resolution), and the failure should be legible enough to point them at `@internal/mongo/bson`. This is the **negative control** that proves the gate actually fires — re-running tests against today's clean tree would only prove CI passed; only planting the now-disallowed import proves the barrel is gone.

**Covers:** AC-5

**Coverage boundary statement.** This scenario proves that importing the BSON value constructors (specifically `ObjectId`) from the bare `@internal/mongo` specifier no longer resolves. It does **not** prove that every conceivable adjacent ergonomic survives the barrel drop — only that the path the PR's prose explicitly calls out is gone. Other former barrel re-exports (`Binary`, `Decimal128`, `Long`, `MongoClient`, `Timestamp`) are subject to the same gate by construction (the `exports` map has no `"."` entry); proving one means proving all under the same gate.

**Isolation:** `tmpdir` (writes only inside `$PN_QA_TMP/scenario-3`).

**Oracle:**
- `@internal/mongo`'s on-disk `package.json` has no `"."` entry in its `exports` map (`cat packages/3-extensions/mongo/package.json | jq '.exports'`).
- Module resolution against the bare specifier `@internal/mongo` (no subpath) should fail. Both `tsc --noEmit` and a Node `require.resolve`-style probe should refuse the import.
- The PR's README guidance gives the migration: `@internal/mongo/bson`. Re-running the same import from `/bson` should succeed.

**Preconditions:**
- Pre-flight gate green.
- `$PN_QA_TMP/scenario-3` is empty.

### Steps

1. Confirm the `exports` map has no `"."` entry:

   ```bash
   cd <worktree for `tml-2526-facades-must-re-export-everything-users-import-in-their-app`>
   jq '.exports | keys' packages/3-extensions/mongo/package.json
   ```

2. Set up the scratch consumer:

   ```bash
   mkdir -p "$PN_QA_TMP/scenario-3"
   cd "$PN_QA_TMP/scenario-3"
   cat > package.json <<'JSON'
   {
     "name": "mongo-barrel-drop-probe",
     "private": true,
     "type": "module",
     "dependencies": {
       "@internal/mongo": "link:../../../packages/3-extensions/mongo",
       "typescript": "*"
     }
   }
   JSON
   cat > tsconfig.json <<'JSON'
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "strict": true,
       "noEmit": true,
       "skipLibCheck": true
     },
     "include": ["index.ts"]
   }
   JSON
   ```

   Alternative resolution route (if `link:` against the workspace folder is awkward in the runner's sandbox): use `pnpm` from the repo root to install the workspace package into the tmpdir via a one-off `pnpm exec node -e "require.resolve('@internal/mongo')"` instead of standing up a separate dependency graph. The runner picks whichever route exercises the same `exports`-map resolution.

3. Plant the now-disallowed barrel import:

   ```bash
   cat > index.ts <<'TS'
   import { ObjectId } from '@internal/mongo';

   const x = new ObjectId();
   console.log(x.toString());
   TS
   ```

4. Run TypeScript against it:

   ```bash
   cd "$PN_QA_TMP/scenario-3"
   pnpm install --no-frozen-lockfile 2>&1 | tail -5 || true
   pnpm exec tsc --noEmit 2>&1 | head -40
   ```

5. Now flip to the documented migration target and confirm it succeeds:

   ```bash
   sed -i.bak "s|from '@internal/mongo'|from '@internal/mongo/bson'|" index.ts
   pnpm exec tsc --noEmit 2>&1 | head -10
   ```

### What you should see

- Step 1's `jq` output: an array of subpaths (`"./bson"`, `"./config"`, `"./contract-builder"`, `"./control"`, `"./family"`, `"./runtime"`, `"./target"`, possibly others) — **no `"."` entry**.
- Step 4's `tsc --noEmit` against the bare import: **non-zero exit**; the diagnostic should mention either the absence of the `.` export, an unresolvable module, or a "no exported member `ObjectId`" style error. The runner is looking at:
  - Whether the diagnostic gives the user a fighting chance to know to use `/bson`. Diagnostics that say only "cannot find module" without context are functional but unhelpful — note that as observable quality, even if non-blocking.
- Step 5's `tsc --noEmit` against the `/bson` import: **exit 0**. Confirms the documented migration path works.

### Failure modes

- Step 1 shows a `"."` key in the `exports` map — the barrel was not actually dropped.
- Step 4 unexpectedly succeeds — module resolution is finding `@internal/mongo` from somewhere it shouldn't (maybe a stale `node_modules` cache from before the barrel-drop commit, maybe a `package.json` `main` field still present). Capture which.
- Step 5 fails — the documented `/bson` migration path is broken. This is the load-bearing PR claim and a regression would be high-impact.
- The diagnostic in step 4 is actively misleading (suggests a typo, suggests a different unrelated package, etc.) — diagnostic copy quality is the kind of judgement only manual QA catches.

### Restore

```bash
rm -rf "$PN_QA_TMP/scenario-3"
```

No repo-tree mutation; `git status --porcelain` (from the repo root) should still be empty.

---

## Scenario 4 — Mongo `defineContract` wrap regression (re-enactment of TML-2633)

**What you're proving from the user's seat.** The PR explicitly carves out a known mongo-facade `defineContract` wrap regression and points to TML-2633. Two in-tree files (`test/integration/test/mongo/fixtures/contract.ts` and `test/integration/test/mongo-runtime/query-builder.test.ts`) deliberately keep the verbose `@internal/mongo-contract-ts/contract-builder` import with a workaround comment. This scenario **re-enacts the originally-failing flow** the carve-out describes: try the façade form against the same contract shapes those files use, observe the documented inference collapse, then confirm the verbose form preserves the precision. The script does **not** treat the regression as a bug to file — it proves the in-tree workaround comments are honest about the symptom.

**Covers:** AC-7

**Isolation:** `tmpdir` (scratch consumer; reads the two in-tree files but does not mutate them).

**Oracle:**
- The two files in tree carry inline comments naming TML-2633 and describing the symptom in concrete terms. Source-of-truth references:
  - `test/integration/test/mongo/fixtures/contract.ts` — top-of-file comment: "the mongo facade's `defineContract` has a type inference regression for discriminated union contracts with embedded relations (the intersection-based return type loses type precision compared to the base overload)."
  - `test/integration/test/mongo-runtime/query-builder.test.ts` — top-of-file comment: "`@internal/mongo/contract-builder`'s `defineContract` wrap loses inline-model inference precision when consumers use `mongoQuery<typeof contract>` chains (PlanRow row shapes collapse to `_id: never` / `count: never`)."
- A scratch consumer that mirrors `query-builder.test.ts`'s inline-model shape but switches the `defineContract` import to `@internal/mongo/contract-builder` (i.e., the façade wrap) must show `expectTypeOf<PlanRow<TPlan>>().toBeNever()` or equivalent inference collapse for the model fields, exactly as the workaround comment promises.
- The same consumer written against `@internal/mongo-contract-ts/contract-builder` (the verbose form, with explicit `family` + `target` args) must show the row shape's fields resolving to their concrete types.

**Preconditions:**
- Pre-flight gate green.
- `$PN_QA_TMP/scenario-4` is empty.

### Steps

1. Read the two workaround comments first — these are the oracle for the symptom:

   ```bash
   cd <worktree for `tml-2526-facades-must-re-export-everything-users-import-in-their-app`>
   sed -n '1,20p' test/integration/test/mongo/fixtures/contract.ts
   sed -n '1,20p' test/integration/test/mongo-runtime/query-builder.test.ts
   ```

   Confirm both comments mention TML-2633 explicitly and describe the symptom in the terms above.

2. Set up the re-enactment scratch:

   ```bash
   mkdir -p "$PN_QA_TMP/scenario-4"
   cd "$PN_QA_TMP/scenario-4"
   ```

3. Write a scratch `contract-facade.ts` (the would-be migrated form, using the façade wrap):

   ```bash
   cat > contract-facade.ts <<'TS'
   import { defineContract, field, model } from '@internal/mongo/contract-builder';

   export const contract = defineContract({
     models: {
       Order: model('Order', {
         collection: 'orders',
         fields: {
           _id: field.objectId(),
           amount: field.double(),
           status: field.string(),
         },
       }),
     },
   });
   TS
   ```

4. Write a scratch `contract-verbose.ts` (the workaround form, mirroring the in-tree fixture):

   ```bash
   cat > contract-verbose.ts <<'TS'
   import mongoFamily from '@internal/family-mongo/pack';
   import { defineContract, field, model } from '@internal/mongo-contract-ts/contract-builder';
   import mongoTarget from '@internal/target-mongo/pack';

   export const contract = defineContract({
     family: mongoFamily,
     target: mongoTarget,
     models: {
       Order: model('Order', {
         collection: 'orders',
         fields: {
           _id: field.objectId(),
           amount: field.double(),
           status: field.string(),
         },
       }),
     },
   });
   TS
   ```

5. Write the inference probe:

   ```bash
   cat > probe.ts <<'TS'
   import { contract as facadeContract } from './contract-facade';
   import { contract as verboseContract } from './contract-verbose';

   type FacadeOrderFields = typeof facadeContract.models.Order.fields;
   type VerboseOrderFields = typeof verboseContract.models.Order.fields;

   declare const facadeId: FacadeOrderFields['_id'];
   declare const verboseId: VerboseOrderFields['_id'];

   export { facadeId, verboseId };
   TS
   ```

6. Stand up a `tsconfig.json` pointed at the workspace's node_modules so module resolution finds the workspace versions:

   ```bash
   cat > tsconfig.json <<'JSON'
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "strict": true,
       "noEmit": true,
       "skipLibCheck": true,
       "baseUrl": ".",
       "paths": {
         "@internal/*": ["../../../node_modules/@internal/*"]
       }
     },
     "include": ["*.ts"]
   }
   JSON
   ```

   (Adjust `paths` so it resolves into the worktree's installed workspace links; the runner picks the smallest tsconfig that successfully resolves.)

7. Probe the inference via the TypeScript compiler's `--noEmit` + a type-introspection helper, OR via `tsc --listFiles` + reading the resolved types. Easiest reproducible probe is `pnpm dlx tsx` (or `pnpm exec tsx`) running a tiny script that uses `expectTypeOf` from `vitest`'s `expectTypeOf` helper to assert the inference collapse:

   ```bash
   # Alternative: stand up a vitest harness in the tmpdir and run a single .test-d.ts file.
   # The simplest manual probe is to hover-inspect `facadeId` vs `verboseId` in your editor,
   # which is what the runner is supposed to evaluate as the "observable quality" judgement.
   pnpm exec tsc --noEmit 2>&1 | head -40
   ```

8. Editor / language-server step (the judgement piece — this is what manual QA adds):
   - Open `probe.ts` in an editor (or LSP-capable inspector).
   - Hover over `facadeId` and over `verboseId` — record the inferred types.

### What you should see

- Step 1: both files' comments mention `TML-2633` and describe the symptom (`_id: never` / `count: never` collapse OR "discriminated union with embedded relations loses precision"). If a comment is absent, the in-tree workaround is undocumented — that's a finding.
- Steps 7 + 8: `verboseId` resolves to the concrete codec-typed shape (e.g. an object with `codecId: 'mongo/objectId@1'` or a runtime-mapped type), while `facadeId` collapses to `never` or to a structurally-empty type. **This collapse is the documented symptom; observing it confirms the in-tree workaround comments are honest about the bug they describe.**
- The runtime behaviour (running an actual query) is **not** part of this scenario — the carve-out explicitly says runtime is unaffected; only the static-types story is incomplete.

### Failure modes

- One or both of the in-tree workaround files lack a comment naming TML-2633 — D6's carve-out comment work is incomplete.
- The comment text describes a symptom that **doesn't** match what the probe reproduces (e.g., comment says `_id: never` but probe shows `_id` resolving correctly) — comment is stale and misleading; either the regression was incidentally fixed (in which case the workaround should be retired) or the comment describes the wrong shape.
- The façade form **succeeds** — `facadeId` resolves to the same concrete type as `verboseId`. Surprising; the carve-out may have been fixed incidentally by another change. Note this as a positive finding (the runner classifies severity — could be a "delete the workaround" follow-up rather than a defect).
- The verbose form **fails** — would mean both forms are broken, which would re-expose the original regression more broadly. High-impact finding.

### Restore

```bash
rm -rf "$PN_QA_TMP/scenario-4"
```

No repo-tree mutation.

---

## Scenario 5 — Pre-existing rendered migration keeps working (backwards-compat)

**What you're proving from the user's seat.** A user who upgraded to this PR's version of Prisma Next must keep working without re-rendering their existing migration files. The PR's compatibility section makes one explicit promise: `@internal/target-{postgres,sqlite}/migration` exports stay in place forever; on-disk migrations that still import them continue to typecheck and run. This is the **end-to-end journey smoke** for NFR2 — and the only one CI cannot meaningfully prove (CI never sees a "pre-upgrade migration meets post-upgrade framework" combination by construction; the in-tree fixtures are the only such combination, and they're our best proxy for the user-repo case).

**Covers:** AC-6

**Isolation:** `read-only` (no mutation; reads tracked example migrations and runs typecheck against them).

**Oracle:**
- The example's existing rendered migrations live at `examples/prisma-8-demo/migrations/app/*/migration.ts` and import `@internal/target-postgres/migration` — these were rendered *before* the renderer flip and are the in-repo stand-in for "a user's existing migration on disk."
- The internal `@internal/target-postgres/migration` subpath continues to export the symbols those files reference (`Migration`, `MigrationCLI`, `addForeignKey`, `createIndex`, `createTable`, `rawSql`, etc.).
- `pnpm typecheck` against the example is clean.
- `pnpm prisma-next migration list` (or the equivalent inspection command — see step 3) accepts the migrations and reports them in topological order without complaint.

**Preconditions:**
- Pre-flight gate green.

### Steps

1. From the repo root, confirm the existing rendered migrations still pin the `target-*` specifier (so they actually exercise the backwards-compat path; if they had been re-rendered, the scenario degenerates):

   ```bash
   grep -h "^import" examples/prisma-8-demo/migrations/app/*/migration.ts | sort -u
   ```

2. Confirm the internal `target-postgres` `/migration` subpath still exists and re-exports the named symbols those migrations import:

   ```bash
   cat packages/3-targets/3-targets/postgres/src/exports/migration.ts
   ```

3. Typecheck the example end-to-end:

   ```bash
   cd examples/prisma-8-demo
   pnpm typecheck
   ```

4. Ask the CLI to list the on-disk migrations (no DB required; `migration list` reads the directory):

   ```bash
   pnpm prisma-next migration list
   ```

5. As an extra read of "the framework is happy with these files," run the integrity check:

   ```bash
   pnpm prisma-next migration check
   ```

### What you should see

- Step 1: the unique import lines include `@internal/target-postgres/migration` — these are the pre-flip migrations.
- Step 2: `packages/3-targets/3-targets/postgres/src/exports/migration.ts` exists and contains a `Migration` / `MigrationCLI` / op-factory re-export surface. (The exact contents are an implementation detail; the user-facing claim is "the subpath is still there.")
- Step 3: `pnpm typecheck` exits 0. The example's TS understands the old migration files.
- Step 4: `pnpm prisma-next migration list` exits 0, prints the migration directory names in order, and reports no errors. Look at the human-readable output: it should not say anything like "unrecognised migration" or "specifier mismatch."
- Step 5: `pnpm prisma-next migration check` exits 0 and reports integrity-OK. Look for any prose hint that the framework is unhappy with the import line.

### Failure modes

- Step 1 returns no hits for `@internal/target-postgres/migration` — the example's migrations were re-rendered as part of this PR (which would be a non-goal violation per the project spec); the scenario can't validate backwards-compat. Surface as a finding.
- Step 2 — the file is missing or its exports are reduced — would mean the `target-*` `/migration` subpath was inadvertently trimmed; the PR's compatibility promise breaks.
- Step 3 — `pnpm typecheck` fails with a "no exported member" / "cannot find module" error pointing at the old import — direct evidence the backwards-compat path is broken.
- Steps 4 or 5 — the CLI rejects the on-disk migrations or emits a deprecation warning that wasn't called out in the PR — surface the wording verbatim; "deprecation warning that asks the user to re-render" would contradict the PR's explicit non-goal.

### Restore

No mutation. `git status --porcelain` should still be empty.

---

## Scenario 6 — Tree-shaking observable check (judgement)

**What you're proving from the user's seat.** The architectural justification for dropping the `.` barrel and keeping every façade subpath as its own entrypoint file is tree-shaking discipline: a consumer that imports only `ObjectId` from `@internal/mongo/bson` should not pull in `@internal/mongo/control`, `@internal/mongo/runtime`, or any other subpath's dependency graph. CI's `pnpm test:packages` does not (and cannot easily) verify this — it asserts shape, not bundle size. This is the **observable-quality judgement** that justifies NFR1 and that an end user's bundle analyzer would catch.

**Covers:** AC-8

**Isolation:** `tmpdir`.

**Oracle:**
- The esbuild metafile (via `--metafile=meta.json --bundle`) for a tiny consumer that only imports `ObjectId` from `@internal/mongo/bson` should list only the `bson` entrypoint and its transitive imports — not `control.ts`, `runtime.ts`, `config.ts`, or `contract-builder.ts`.
- Equivalent check: `node --input-type=module -e "import('@internal/mongo/bson').then(m => console.log(Object.keys(m)))"` should resolve without touching `/runtime` or `/control` entry files. (`require.resolve('@internal/mongo/runtime')` from inside that probe should be a no-op — the resolver runs it lazily only if asked.)

**Preconditions:**
- Pre-flight gate green.
- `esbuild` available via `pnpm dlx esbuild` or already installed in the worktree.
- `$PN_QA_TMP/scenario-6` is empty.

### Steps

1. Set up the scratch consumer:

   ```bash
   mkdir -p "$PN_QA_TMP/scenario-6"
   cd "$PN_QA_TMP/scenario-6"
   cat > consumer.mjs <<'JS'
   import { ObjectId } from '@internal/mongo/bson';
   console.log(new ObjectId().toString());
   JS
   ```

2. Run esbuild with `--metafile`, resolving from the worktree's `node_modules`:

   ```bash
   cd <worktree for `tml-2526-facades-must-re-export-everything-users-import-in-their-app`>
   pnpm exec esbuild \
     --bundle \
     --platform=node \
     --format=esm \
     --metafile="$PN_QA_TMP/scenario-6/meta.json" \
     --outfile="$PN_QA_TMP/scenario-6/bundle.mjs" \
     --external:mongodb \
     "$PN_QA_TMP/scenario-6/consumer.mjs"
   ```

   (`mongodb` is marked external because the BSON re-exports from there are runtime peers; the question we're answering is about Prisma Next's tree-shaping, not `mongodb`'s.)

3. Inspect the metafile:

   ```bash
   cd "$PN_QA_TMP/scenario-6"
   jq '.inputs | keys' meta.json | head -30
   jq '[.inputs | keys[] | select(test("@internal/mongo"))]' meta.json
   ```

4. Cross-check via the bundle itself:

   ```bash
   grep -c "@internal/mongo/control" bundle.mjs || echo "0 hits"
   grep -c "@internal/mongo/runtime" bundle.mjs || echo "0 hits"
   grep -c "@internal/mongo/config" bundle.mjs || echo "0 hits"
   grep -c "@internal/mongo/contract-builder" bundle.mjs || echo "0 hits"
   grep -c "@internal/mongo/bson" bundle.mjs || echo "0 hits"
   ```

### What you should see

- Step 2: esbuild exits 0 and produces both `bundle.mjs` and `meta.json`.
- Step 3's first `jq` shows the input list — the only `@internal/mongo/*` inputs should be the `bson` entrypoint and (if its implementation re-exports from a nested file) that file. The runner is looking at:
  - Is `control.ts` in the inputs? It should not be.
  - Is `runtime.ts` in the inputs? It should not be.
  - Is `config.ts` in the inputs? It should not be.
- Step 4's `grep` counts: `bson` should be > 0; `control`, `runtime`, `config`, `contract-builder` should all be **0**.

### Failure modes

- Step 2 fails — esbuild cannot resolve `@internal/mongo/bson`. Would indicate the `/bson` subpath's `exports` entry is misconfigured (file path wrong, `import` condition missing).
- Step 3 reveals other `@internal/mongo/*` subpaths in the inputs — the bundle is pulling more than the user asked for. This is the tree-shake regression the architectural choice is supposed to prevent.
- Step 4's `grep` finds non-zero hits for `control` / `runtime` / `config` / `contract-builder` — same finding; the bundle leaks dependencies.
- The bundle inflates dramatically beyond what `ObjectId` should require (e.g., > 1 MB when `ObjectId` alone is ~10–50 KB) — judgement signal that something is wrong even if structural inputs look clean.

### Restore

```bash
rm -rf "$PN_QA_TMP/scenario-6"
```

---

## Scenario 7 — Read of skill cluster + façade READMEs + ADR 208 example

**What you're proving from the user's seat.** A new developer who lands in the repo (or in Prisma Next's published docs) and reads the skill cluster, the façade package READMEs, and the ADR 208 illustrative code should see one teaching: façade form everywhere, no `target-*` rhetoric in user-facing prose. D6 swept these surfaces; this scenario is the **human read of durable docs** that confirms the sweep is coherent and that no stale "use `@internal/target-postgres/migration`" snuck back in. Tests cannot meaningfully assert "this prose teaches the right thing."

**Covers:** AC-1, AC-2, AC-3, AC-4

**Isolation:** `read-only`.

**Oracle:**
- The skill cluster files D6 touched (`skills/prisma-next-migrations/SKILL.md`, `skills/prisma-next-contract/SKILL.md`, `skills/prisma-next-queries/SKILL.md`, `skills/prisma-next-runtime/SKILL.md`, `skills/DEVELOPING.md`) and the façade READMEs (`packages/3-extensions/{postgres,mongo,sqlite}/README.md`) plus `docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md` (illustrative code only) all teach façade form.
- No reference to `TML-2526` remains outside `projects/facade-import-surface-completion/`.
- The two mongo test files (`test/integration/test/mongo/fixtures/contract.ts`, `test/integration/test/mongo-runtime/query-builder.test.ts`) explicitly reference `TML-2633` in their workaround comments.

**Preconditions:**
- Pre-flight gate green.

### Steps

1. Read each of these files in full and form a judgement on whether the prose teaches façade form unconditionally:

   ```bash
   cat skills/prisma-next-migrations/SKILL.md
   cat skills/prisma-next-contract/SKILL.md
   cat skills/prisma-next-queries/SKILL.md
   cat skills/prisma-next-runtime/SKILL.md
   cat skills/DEVELOPING.md
   cat packages/3-extensions/postgres/README.md
   cat packages/3-extensions/mongo/README.md
   cat packages/3-extensions/sqlite/README.md
   sed -n '1,80p' "docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md"
   ```

2. Run the project-DoD grep gates the slice plan promises will be clean:

   ```bash
   rg 'TML-2526' skills/ docs/ packages/ examples/ test/
   ```

   This should return no hits outside `projects/facade-import-surface-completion/` (and that directory itself isn't searched here).

3. Confirm the two mongo workaround comments still reference `TML-2633`:

   ```bash
   rg 'TML-2633' test/integration/test/mongo/fixtures/contract.ts test/integration/test/mongo-runtime/query-builder.test.ts
   ```

4. Confirm no user-facing prose (skills/, docs/, READMEs in `packages/3-extensions/`) teaches `@internal/target-*/migration` as the recommended specifier:

   ```bash
   rg '@internal/target-(postgres|sqlite)/migration' skills/ docs/ packages/3-extensions/*/README.md
   ```

   Expected hits are limited to:
   - the cipherstash extension authoring docstring (deliberate per A7),
   - the parity tests' reference in package source (these are not user-facing prose),
   - any "before this PR" comparison block that explicitly frames the old form as the previous shape.

### What you should see

- Step 1 — the prose teaches façade form. The runner is reading like a new developer would; the question is whether anywhere in these documents a reader is told to import from `@internal/target-postgres/migration` (or any `target-*` specifier) as the recommended user-facing form. Comparison blocks of the form "Before this PR users wrote X; now they write Y" are fine; standalone recommendations of `target-*` form are not.
- Step 2 returns no hits.
- Step 3 returns one hit in each file (the workaround comment block).
- Step 4 returns only the expected exemptions (cipherstash docstring, parity-test plumbing, before/after framing). The runner is looking at whether any hit is a recommendation rather than a historical reference.

### Failure modes

- Step 1 surfaces prose that teaches `@internal/target-*` form as the recommended import in a user-facing document — D6's sweep is incomplete.
- Step 2 returns any hit — D6's TML-2526 cleanup is incomplete.
- Step 3 misses either file — the workaround comment was deleted or never added.
- Step 4 returns a hit in a context that reads as a recommendation rather than a historical/exemption reference — surface the file + line.
- A skill's example code block uses the verbose `family: sqlFamily, target: postgresPack` form for `defineContract` — D6 was supposed to sweep these too.

### Restore

No mutation. `git status --porcelain` should still be empty.

---

## Scenario 8 — Exploratory: `/contract-builder` inference probes across three façades

**Charter.** Explore the three façades' `/contract-builder` subpaths (`@internal/postgres/contract-builder`, `@internal/sqlite/contract-builder`, `@internal/mongo/contract-builder`) with the scratch contracts you'd actually write as a new user — multi-model contracts with foreign keys, embedded relations (mongo) or relation chains (SQL), enum fields (postgres), capability flags, and extension packs — to discover behaviours that surprise you, inference that collapses unexpectedly, error envelopes that read poorly, or shapes the scripted scenarios didn't enumerate.

**Covers:** (no specific AC; surfaces unknowns)

**Isolation:** `tmpdir` (write scratch contracts under `$PN_QA_TMP/scenario-8/{postgres,sqlite,mongo}/`).

**Time budget:** 30 minutes. Stop when the timer rings even if you have probes left — log them as candidate scenarios for a future round.

**Suggested probes (not exhaustive — improvise):**
- Postgres: a contract with two related models via `rel.belongsTo` + `rel.hasMany`, plus an enum field; confirm `field.enum` inference flows through the wrap without collapsing.
- Postgres: a contract that uses `extensionPacks: { pgvector }` and a vector field; confirm extension packs typecheck through the wrap.
- SQLite: a contract that opts into `capabilities.sql.foreignKeys: true`; confirm capability gating still works through the wrap.
- SQLite: a contract with a single-column `field.id.uuidv4()` PK; confirm the wrap doesn't require an `id` field in the input shape.
- Mongo: a contract with an inline `model('Order', { fields: { _id: field.objectId(), ... } })` (the symptom shape from TML-2633); record what hover-types resolve to as a complement to scenario 4.
- Mongo: a discriminated-union contract (parent + variants via `discriminator`) mirroring the in-tree fixture; record inference at the variant level.
- Across all three: try malformed shapes (missing required field, wrong capability key, an extra `family:` key that the wrap should reject) and judge the error envelope — is it actionable?

**Notes capture:** Write down what you tried, what surprised you, what hover-types resolved to, and any prose that "felt off." Findings get classified in the run report the same way scripted-scenario findings do. If a probe deserves to become a scripted scenario in a future round, name it.

---

## Scenarios deliberately not in this script

| AC / surface | Why it's not a manual-QA scenario |
| ------------ | --------------------------------- |
| "All unit + integration tests pass" | `pnpm test:packages` + `pnpm test:integration` are CI gates. Re-running them here proves only that the runner's machine matches CI. |
| "`pnpm lint:deps` clean" | Architectural lint over today's tree; CI owns it. The user-meaningful version would be a negative control (plant a layering violation, observe the lint fire); the scope of this PR doesn't add a new layering gate so no negative control is warranted. |
| "Façade subpath parity tests in `packages/3-extensions/{postgres,sqlite,mongo}/test/.../re-export.test.ts` pass" | These tests assert named-export structural parity. CI runs them on every push; the user-facing parity (importing the symbols and using them) is exercised end-to-end by scenarios 1, 2, and 5. |
| "`pnpm fixtures:check` clean" | Pure structural gate over emitted artefacts. Scenarios 1 and 2 produce fresh artefacts and inspect them — the user-facing version of the same check. |
| Renderer string-pin tests (`packages/3-targets/**/test/migrations/*.test.ts`, `test/integration/test/cli-journeys/*.e2e.test.ts`) | Structural assertions on the rendered specifier; CI owns them. The user-facing version is "does the renderer write the right specifier into a real `migration.ts`," which scenarios 1 and 2 cover. |
| Live MongoDB control-client end-to-end | Requires running `mongod`; the integration suite's `mongodb-memory-server` already covers it. The manual-QA judgement add ("does the client *feel* right") is low because `createMongoControlClient` mirrors the well-trodden `createPostgresControlClient` pattern exactly. |
| Migration *apply* against a live database | Out of scope of this PR (the PR changes specifiers and surfaces; it doesn't change apply behaviour). Existing apply tests cover the apply path; this PR doesn't perturb them. |
| Cloudflare Worker / serverless façade | The serverless façade existed before this PR and isn't touched by it (only Postgres has `/serverless`, and TML-2526 didn't extend it). The example app's typecheck is covered by the project-DoD `pnpm typecheck` gate. |
| Existing extension-pack hand-authored migrations under `packages/3-extensions/{cipherstash,pgvector,postgis,paradedb}/migrations/` | Deliberately kept on `target-*` specifier per the extension authoring contract (project spec A7). Not a user-facing surface for the end-user audience. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| ----- | ----------------------- |
| AC-1 — `@internal/postgres/migration` re-exports + renderer flip emits façade specifier | 2, 5, 7 |
| AC-2 — `@internal/sqlite` full surface parity (`/config`, `/contract-builder`, `/control`, `/migration`) + renderer flip emits façade specifier | 1, 7 |
| AC-3 — `@internal/mongo` `/control` + `/bson` + widened `/config` | 3, 6, 7 |
| AC-4 — Each façade's `/contract-builder` pre-binds `family` + `target`; inference preserved for postgres + sqlite | 1, 2, 7, 8 |
| AC-5 — Breaking change: `@internal/mongo` `.` barrel is gone | 3 |
| AC-6 — Backwards-compat: existing rendered migrations on `@internal/target-*/migration` continue to work | 5 |
| AC-7 — Mongo `defineContract` wrap inference regression carve-out (TML-2633) is documented and matches the symptom | 4, 7 |
| AC-8 — Tree-shaking: each façade subpath is its own entrypoint; consumers of one subpath don't pull others | 6 |
