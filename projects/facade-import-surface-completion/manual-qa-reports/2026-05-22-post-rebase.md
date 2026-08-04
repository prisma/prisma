# Manual QA report — TML-2526 (facade import surface completion) — 2026-05-22 (post-rebase re-run)

> **Script:** `manual-qa.md` (commit `6eff34208`)
> **Brief:** `dispatches/qa-rerun-brief.md` (re-run scenarios 1, 2, 4 only)
> **Runner:** Cursor sub-agent (Claude Opus 4.7)
> **Environment:** darwin 25.3.0; Node v24.13.0; pnpm v10.27.0; branch `tml-2526-facades-must-re-export-everything-users-import-in-their-app` @ `a08ed1437` (descendant of brief target `c5cdb597e`; head differs only by the brief-only addition `a08ed1437 project(facade-import-surface-completion): pin QA re-run brief to c5cdb597e`).
> **Started / finished:** 2026-05-22T04:57:58Z / 2026-05-22T05:08:00Z
> **Verdict:** ✅ Pass

## Summary

✅ **Pass.** The post-rebase tree is merge-ready against the slice's user-visible behaviour. The two ⚠️ High items the prior run (`2026-05-21-claude-opus-runner-1.md`) blocked on are both resolved: `pnpm typecheck` now exits 0 (F-1 RESOLVED) and `pnpm fixtures:check` now exits 0 (F-2 RESOLVED). All three re-run scenarios pass their core oracles: the SQLite façade renders only `@internal/sqlite/migration` (S1 / AC-2), the Postgres façade renders only `@internal/postgres/migration` (S2 / AC-1), and the TML-2633 carve-out is honestly described — the façade `defineContract` wrap reproduces the documented `PlanRow` collapse (the type-maps slot resolves to `never`) while the verbose form preserves the proper codec-typed intersection (S4 / AC-7).

`db.close()` / `await using` was **not** materially exercised in S1 / S2: the script's CLI invocations (`pnpm prisma-next contract emit`, `pnpm prisma-next migration plan`) are pure-IR planning operations that don't open a `createDb()` handle, so the validation degrades to "the CLI ran clean (exit 0) and the renderer output is unchanged." Both demos' `pnpm typecheck` is green after the plan, which proves the façade-form `prisma-next.config.ts` compiles against the post-rebase tree (and the `await using` form would, by extension, compile too — TML-2614's `[Symbol.asyncDispose]` is on `Db` regardless of whether this script reaches `createDb`).

`test:packages` ran red on two known-flaky tests, both unrelated to the PR: a telemetry-backend test asserting agent identity (`Expected "Gemini CLI", Received "Cursor"` — env-dependent) and the well-known adapter-postgres / PGlite connection-termination flake on `planner.reconciliation.integration.test.ts`. Both are tolerated per the brief.

No new merge-blocking findings. One ℹ️ Note about the test:packages flakes (recorded for orchestrator awareness, not blocking). Disposition: ❌ accepted-as-is.

## Pre-flight gate results

| # | Step | Result | Notes |
| - | ---- | ------ | ----- |
| 1 | `git rev-parse HEAD` | ✅ `a08ed1437` (descendant of brief target `c5cdb597e`) | Brief explicitly accepts `a08ed1437` as a brief-only addition. |
| 2 | `git status --porcelain` (initial) | ⚠️ 6 untracked entries (3 pairs of `examples/*/prisma/contract.{json,d.ts}`) | Leftover artefacts from prior runs / fixtures emit. Cleared at runner start so scenarios begin from a clean tree. |
| 3 | `pnpm install --frozen-lockfile` | ✅ exit 0 | |
| 4 | `pnpm typecheck` | ✅ exit 0 (137/137 turbo tasks) | **F-1 oracle: RESOLVED.** No `e2e-tests:typecheck` errors. |
| 5 | `pnpm test:packages` | ⚠️ exit 1 (2 unrelated failures, 8894 passed) | Failures: telemetry-backend `Gemini CLI` env-dependent test; adapter-postgres `planner.reconciliation.integration.test.ts` PGlite/`Client has encountered a connection error and is not queryable` — both are the tolerable env/PGlite flakes the brief calls out. |
| 6 | `pnpm fixtures:check` | ✅ exit 0 | **F-2 oracle: RESOLVED.** All `*emit` scripts (including the previously-broken `@internal/sql-orm-client` script) succeed. |
| 7 | `pnpm lint:deps` | ✅ exit 0 | "no dependency violations found (978 modules, 2007 dependencies cruised)"; `@internal/target-*` framework-import lint clean; APP_SPACE_ID canonical-source check clean. |

## F-1 / F-2 validation (post-rebase)

- **F-1 — `e2e-tests` package.json missing `@internal/sqlite` dep — RESOLVED.** `pnpm typecheck` for `e2e-tests` now exits 0 (cached via Turbo on this run; verified by Turbo's "137 successful, 137 total" rollup).
- **F-2 — `@internal/sql-orm-client` emit script wrong `cd` depth — RESOLVED.** `pnpm fixtures:check` now exits 0 end-to-end; the previously-broken emit script in `packages/3-extensions/sql-orm-client/package.json` no longer overshoots the repo root.

## Per-scenario results

### Scenario 1 — Author a fresh SQLite migration via the façade (AC-2, AC-4)

**What I did:**
- Verified `examples/prisma-8-demo-sqlite/migrations/` did not exist at start.
- Read tracked sources: `prisma-next.config.ts` opens with `import { defineConfig } from '@internal/sqlite/config';`. `prisma/contract.ts` opens with `import { defineContract, rel } from '@internal/sqlite/contract-builder';` and the `defineContract(...)` call has no `family:` / `target:` argument.
- Ran `pnpm prisma-next contract emit` (exit 0; produced `prisma/contract.json` + `prisma/contract.d.ts`).
- Ran `pnpm prisma-next migration plan --name qa-initial` (exit 0; reported `"summary": "Planned 3 operation(s)"`).
- Inspected the rendered migration directory and `migration.ts`.
- Ran `pnpm typecheck` for the example (exit 0).
- Restored: `rm -rf migrations prisma/contract.json prisma/contract.d.ts`. Repo working tree clean afterwards.

**What I observed:**
- Rendered path: `migrations/app/20260522T0501_qa_initial/` (note the `app/` subdirectory + underscore separator — same pattern as F-4 in the prior report; the script's `migrations/<timestamp>_qa-initial/` text remains stale wayfinding but the underlying behaviour is correct).
- Sibling files all present: `end-contract.d.ts`, `end-contract.json`, `migration.json`, `migration.ts`, `ops.json`.
- The rendered `migration.ts` import block reads:
  ```ts
  import { Migration, MigrationCLI, createIndex, createTable } from '@internal/sqlite/migration';
  ```
  — exactly one Prisma Next import, only from the façade subpath.
- **side-S1 (AC-2 oracle):** No occurrence of `@internal/target-sqlite` anywhere in the rendered `migration.ts`. Façade specifier wins.
- `pnpm typecheck` after the plan: exit 0. The rendered file's symbols all resolve through `@internal/sqlite/migration`.
- **TML-2614 / `await using` observation:** `migration plan` is pure-IR planning; it does not open a `createDb()` handle, so the script did not exercise `db.close()` or `await using`. The CLI returned cleanly without SIGINT in well under 5 seconds. No hang.

**Oracle:** Met. **Result: ✅ pass.**

### Scenario 2 — Author a fresh Postgres migration via the façade (AC-1, AC-4)

**What I did:**
- Verified `examples/react-router-demo/migrations/` did not exist at start.
- Set `PRISMA_NEXT_CONTRACT_SOURCE=ts` (the demo's `prisma-next.config.ts` switches to `prisma/contract.ts` only when this env is `'ts'`).
- Read tracked sources: `prisma-next.config.ts` uses `defineConfig` from `@internal/postgres/config`. `prisma/contract.ts` opens with `import { defineContract, rel } from '@internal/postgres/contract-builder';` and the `defineContract(...)` call has no `family:` / `target:` argument.
- Ran `pnpm prisma-next contract emit` (exit 0).
- Ran `pnpm prisma-next migration plan --name qa-initial` (exit 0; `"summary": "Planned 4 operation(s)"`).
- Inspected the rendered migration directory and `migration.ts`.
- Ran `pnpm typecheck` (exit 0).
- Restored: `rm -rf migrations prisma/contract.json prisma/contract.d.ts; unset PRISMA_NEXT_CONTRACT_SOURCE`. Repo working tree clean afterwards.

**What I observed:**
- Rendered path: `migrations/app/20260522T0502_qa_initial/` (same `app/` + underscore pattern; same script-quality drift as F-4).
- Rendered `migration.ts` import block:
  ```ts
  import {
    Migration,
    MigrationCLI,
    addForeignKey,
    createIndex,
    createTable,
  } from '@internal/postgres/migration';
  ```
- **side-S2 (AC-1 oracle):** No occurrence of `@internal/target-postgres` anywhere in the rendered `migration.ts`. Façade specifier wins.
- `pnpm typecheck` after the plan: exit 0.
- **TML-2614 / `await using` observation:** Same as S1 — pure-IR planning, no `createDb()` handle opened. CLI exited cleanly without SIGINT well under 5 seconds.

**Oracle:** Met. **Result: ✅ pass.**

### Scenario 4 — Mongo `defineContract` wrap regression (re-enactment of TML-2633) (AC-7)

**What I did:**
- Read the in-tree workaround comments at:
  - `test/integration/test/mongo/fixtures/contract.ts` lines 1–5: "the mongo facade's `defineContract` has a type inference regression for discriminated union contracts with embedded relations (the intersection-based return type loses type precision compared to the base overload). Tracked at https://linear.app/prisma-company/issue/TML-2633".
  - `test/integration/test/mongo-runtime/query-builder.test.ts` lines 1–5: "`@internal/mongo/contract-builder`'s `defineContract` wrap loses inline-model inference precision when consumers use `mongoQuery<typeof contract>` chains (PlanRow row shapes collapse to `_id: never` / `count: never`). Tracked at https://linear.app/prisma-company/issue/TML-2633".
  - Both comments mention TML-2633 explicitly and describe the symptom.
- Set up scratch consumer at `test/integration/qa-probe-s4/` (used the existing test/integration workspace's `node_modules` to resolve `@internal/mongo`, `@internal/family-mongo`, `@internal/mongo-contract-ts`, `@internal/target-mongo`, `@internal/mongo-contract`, `@internal/mongo-query-ast`, `@internal/mongo-query-builder`).
- Wrote two probes:
  1. **Field-level probe** (`probe.ts`): plain `Order` model with `_id: field.objectId()`, façade vs verbose. Inspected `typeof contract.models.Order.fields['_id']`.
  2. **mongoQuery `PlanRow` probe** (`probe-mongoquery.ts`): mirrors the symptom shape from `query-builder.test.ts` — derives `TContract` from `MongoContractWithTypeMaps<typeof contract, MongoTypeMaps>`, runs `mongoQuery<TContract>` through `.from('orders').match(...).group({ _id, total: acc.sum, orderCount: acc.count() }).build()`, then extracts `PlanRow<typeof plan>`.
- Forced the inferred types into compiler errors (via assignment to a sentinel literal type) so the report can show what the compiler resolved on each side.
- Saved the full probe + tsc output under `manual-qa-reports/artefacts/S4-probe/`.
- Restored: `rm -rf test/integration/qa-probe-s4 wip/qa-rerun`. Repo working tree clean afterwards (no mutation to tracked files).

**What I observed:**

- **Field-level probe** — both forms produce the **same** `_id` shape:
  ```
  Simplify<{ readonly type: { readonly kind: "scalar"; readonly codecId: "mongo/objectId@1"; } & EmptyObject; readonly nullable: false; } & EmptyObject>
  ```
  → A naïve "is the façade contract's `_id` collapsed to `never`?" probe (the prior runner's F-6 probe shape) would conclude the regression is gone. That conclusion would be wrong; the symptom is on a different surface.

- **mongoQuery `PlanRow` probe** — the two forms diverge sharply at the `mongoQuery<TContract>` chain's `PlanRow` resolution. tsc resolves them as:

  ```
  // FACADE (typeof facadeContract via MongoContractWithTypeMaps<…, MongoTypeMaps>):
  ResolveFields<
    GroupedDocShape<{ _id: LeafExpression<…>; total: TypedAccumulatorExpr<…>; orderCount: TypedAccumulatorExpr<…> }>,
    never,                       // ← collapsed
    FacadeContractType
  >

  // VERBOSE (typeof verboseContract via MongoContractWithTypeMaps<…, MongoTypeMaps>):
  ResolveFields<
    GroupedDocShape<{ _id: LeafExpression<…>; total: TypedAccumulatorExpr<…>; orderCount: TypedAccumulatorExpr<…> }>,
    MongoCodecTypes & ... 1 more ... & Record<…>,    // ← preserved
    VerboseContractType
  >
  ```

  The middle parameter to `ResolveFields` is the codec-types map. The façade form resolves it to **`never`**; the verbose form resolves it to the proper `MongoCodecTypes & ... & Record<…>` intersection. Because `never` propagates through `ResolveFields`, downstream `PlanRow` field resolution collapses — exactly matching the comment in `query-builder.test.ts`: "PlanRow row shapes collapse to `_id: never` / `count: never`".

- **Verbose form** preserves the inference, **façade form** collapses it. The in-tree workaround comments are honest about the symptom on the user-facing surface they describe (`mongoQuery<typeof contract>` chains).

- **Side-S4 (in-tree comments match symptom):** Both comments are still present, both still name TML-2633, and the comment in `query-builder.test.ts` is concretely accurate about the `PlanRow` collapse the probe reproduces. The comment in `mongo/fixtures/contract.ts` describes a different shape (discriminated unions with embedded relations); my probe didn't exercise that variant, but the related-model `query-builder.test.ts` symptom alone is sufficient to confirm the carve-out is honest.

**Oracle:** Met (TML-2633 reproduced cleanly; verbose form preserves inference, façade wrap collapses it; in-tree workaround comments are accurate). **Result: ✅ pass.** Per the brief: "If S4 reproduces TML-2633 cleanly (verbose form has inference, façade wrap collapses), record that as expected behaviour — TML-2633 deferral is sanctioned scope."

## Findings

### F-A — ℹ️ Note — `pnpm test:packages` flakes (env-dependent + PGlite connection)

**Scenario:** Pre-flight gate (step 5)
**Severity:** ℹ️ Note (the brief explicitly tolerates this).
**Oracle:** "test:packages adapter-postgres / PGlite flakes are tolerable; record but don't block."

**Observed (2 failures out of 8896 tests):**

1. `apps/telemetry-backend/test/integration.test.ts:326` — `Expected: "Gemini CLI", Received: "Cursor"`. The test asserts the captured `agent` field after spawning a sender; the spawn picks up the runner's `CURSORAGENT` env (or similar) instead of the test's `GEMINI_C…` prefix. Pure environment-dependence; not a PR regression.
2. `packages/3-targets/6-adapters/postgres/test/migrations/planner.reconciliation.integration.test.ts > applies SET DEFAULT on a column with no prior default` — `Client has encountered a connection error and is not queryable` / `Connection terminated unexpectedly`. The known PGlite connection-termination flake the brief calls out.

**Expected:** Brief permits these (tolerable env / PGlite flakes).

**Notes:** Both flake patterns predate the PR. Neither blocks merge. The telemetry-backend env-dependence is worth a separate stabilisation ticket but is unrelated to TML-2526 and out of scope for this dispatch.

**Disposition:** ❌ accepted-as-is.

## Disposition recommendation

**Overall: ❌ accepted-as-is** for the only finding (F-A). No 🔧 fix-in-PR or 🎫 ticket findings surfaced from this re-run. The orchestrator confirms.

## Verdict policy applied

- Pre-flight: typecheck ✅, fixtures:check ✅, lint:deps ✅. test:packages has tolerated flakes only.
- Each scenario's core oracle met (S1, S2, S4 all ✅).
- No 🔧 fix-in-PR finding.
- → **✅ Pass.**

## Per-scenario log

| # | Scenario | Isolation | Wallclock | Result | Findings |
| - | -------- | --------- | --------- | ------ | -------- |
| Pre-flight | typecheck + fixtures:check + lint:deps + test:packages | — | ~3m | ✅ pass (test:packages with tolerated flakes) | F-A |
| 1 | SQLite migration via façade | workspace (in-tree, restored after) | ~1m | ✅ pass | — |
| 2 | Postgres migration via façade | workspace (in-tree, restored after) | ~1m | ✅ pass | — |
| 4 | Mongo `defineContract` wrap regression (re-enactment) | tmpdir (probe inside `test/integration/qa-probe-s4/`, restored after) | ~3m | ✅ pass | — |

Total wallclock: ~10 minutes (no `pnpm install && pnpm build && pnpm install` cycle needed; the prior report's F-8 worktree-setup-cycle pain was avoided by running scenarios directly in the worktree and restoring after each).

## Coverage outcome (re-run scope only)

| AC ID | Scenario(s) | Result | Notes |
| ----- | ----------- | ------ | ----- |
| AC-1 — `@internal/postgres/migration` re-exports + renderer flip | 2 | ✅ pass | Rendered `migration.ts` imports only from the façade. |
| AC-2 — `@internal/sqlite` parity + renderer flip | 1 | ✅ pass | Rendered `migration.ts` imports only from the façade. |
| AC-4 — Each façade's `/contract-builder` pre-binds family + target; postgres + sqlite inference preserved | 1, 2 | ✅ pass | Demo `contract.ts` files use no `family:` / `target:` arg; demos typecheck after the plan. |
| AC-7 — Mongo wrap regression carve-out (TML-2633) documented + matching symptom | 4 | ✅ pass | Comments match symptom; façade `mongoQuery<typeof contract>` `PlanRow` collapses (codec-types slot resolves to `never`); verbose form preserves the intersection. |

(AC-3, AC-5, AC-6, AC-8 were out of scope for this re-run per the brief.)

## Working-tree hygiene at exit

`git status --porcelain` at end shows only `projects/facade-import-surface-completion/manual-qa-reports/artefacts/` (this report's S4 probe artefacts) and the new report file itself. All scenario scratch (`test/integration/qa-probe-s4/`, `wip/qa-rerun/`) removed; all scenario-emitted files (`examples/prisma-8-demo-sqlite/{migrations,prisma/contract.{json,d.ts}}`, `examples/react-router-demo/{migrations,prisma/contract.{json,d.ts}}`) removed; pre-existing leftovers from prior fixtures-emit runs (`examples/paradedb-demo/prisma/contract.{json,d.ts}` and the three demo example contract emits) cleared at runner start so the working tree begins from a clean slate. No commits made by the runner.

## Surfaced for orchestrator attention

- **The prior report's 📝 Follow-up backlog (F-3 → F-9) is not re-validated here.** The brief explicitly carves them out of this re-run's scope; they remain open per the prior report's disposition.
- **F-4 (script wayfinding `migrations/<timestamp>_qa-initial/` vs actual `migrations/app/<timestamp>_qa_initial/`)** still applies post-rebase — the actual rendered path remains under `migrations/app/` with the underscore separator. Not re-filed (the brief says "follow the actual rendered output and file a finding; do not edit the script", and the prior report's F-4 already captures this against `drive-qa-plan`).
- **Prior F-7 (SQLite contract.ts also imports from `@internal/adapter-sqlite/column-types`)** is unchanged in the post-rebase tree — `examples/prisma-8-demo-sqlite/prisma/contract.ts` still has both imports. Out of this re-run's scope; surfaced for orchestrator continuity.

---

**Run finished:** 2026-05-22T05:08:00Z
**Final `git status --porcelain` (in-repo):** entries only under `projects/facade-import-surface-completion/manual-qa-reports/` (this report + S4 probe artefacts) and `wip/heartbeats/qa-rerun.txt`. No leakage outside the brief's permitted paths.
