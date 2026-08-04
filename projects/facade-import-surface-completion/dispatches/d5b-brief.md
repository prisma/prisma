# D5b — Test fixtures migrate to façade form

You are implementing **D5b** in `projects/facade-import-surface-completion/slices/facade-completion/`. D5b is the test-fixture half of the D5 split. D5a (your prior round, `903c9bc40`) established the migration pattern on 4 example contracts; D5b mechanically scales that pattern across ~60 test fixture files. After D5b lands, `pnpm test:integration` should go green (currently 17 failures from D1/D2/D3's `defineContract` input-type drop fallout in test setups).

## Context (orient yourself before starting)

Read in this order (skim — you already know most of it):

1. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` § Dispatch 5b (the canonical scope).
2. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` § Dispatch 5a (your prior round — the pattern you established + the A7 cycle finding).
3. `projects/facade-import-surface-completion/spec.md` § A7 (extension-pack exemption — pgvector + postgis stay verbose; do NOT touch them).
4. `projects/facade-import-surface-completion/reviews/code-review.md` § D5a R1 orchestrator note + your D5a R1 round entry (for the cycle context and the agreed Tier 2 dispositions).

## Intent

Migrate every user-shaped TypeScript file under `test/integration/`, `test/e2e/framework/`, and `packages/1-framework/3-tooling/cli/recordings/fixtures/` that calls `defineContract({ family: …, target: …, … })` from the verbose form to the wrapped facade form. Mechanically identical to D5a's example-contract migration.

## The migration pattern (established in D5a)

For SQL/Postgres fixtures:

```ts
// BEFORE
import { defineContract } from '@internal/sql-contract-ts/contract-builder';
import sqlFamily from '@internal/family-sql/pack';
import postgresPack from '@internal/target-postgres/pack';

export const contract = defineContract(
  { family: sqlFamily, target: postgresPack, /* extensionPacks: {...} */ },
  ({ field, model, rel }) => ({ models: { ... } }),
);

// AFTER
import { defineContract } from '@internal/postgres/contract-builder';

export const contract = defineContract(
  { /* extensionPacks: {...} */ },  // family + target dropped; extensionPacks retained if present
  ({ field, model, rel }) => ({ models: { ... } }),
);
```

For SQL/SQLite: substitute `@internal/sqlite/contract-builder` + `target-sqlite/pack` accordingly.

For Mongo: substitute `@internal/mongo/contract-builder` + `mongo-contract-ts/contract-builder` + `family-mongo/pack` + `target-mongo/pack`.

**Single-argument form:** if a fixture has an empty `extensionPacks` and the call collapses to `defineContract({}, factory)` after the drop, leave it as `defineContract({}, factory)` (don't drop the empty options object — it's still the API shape).

**No-extensionPacks fixtures:** `defineContract({ family, target }, factory)` → `defineContract({}, factory)`.

## Files in scope

### Tier 1 — definite migration targets (mechanical)

Per orchestrator inventory:

- **CLI-journey + CLI-integration fixtures** (`test/integration/test/fixtures/cli/cli-e2e-test-app/fixtures/**/contract*.ts` + `test/integration/test/fixtures/cli/cli-integration-test-app/fixtures/**/contract*.ts`) — ~38 files.
- **Parity test fixtures** (`test/integration/test/authoring/parity/**/contract.ts`) — ~15 files.
- **Side-by-side test fixtures** (`test/integration/test/authoring/side-by-side/{postgres,mongo}/contract.ts`) — 2 files.
- **Top-level test fixtures** (`test/integration/test/{fixtures,sql-builder/fixtures,mongo/fixtures}/contract.ts` + `test/integration/test/fixtures/prisma-next.config.ts` + `test/integration/test/sql-builder/fixtures/prisma-next.config.ts` + `test/integration/test/fixtures/cli/cli-e2e-test-app/fixtures/mongo-cli-journeys/prisma-next.config.with-db.ts`) — ~6 files.
- **DB-* fixtures** (`test/integration/test/fixtures/cli/cli-e2e-test-app/fixtures/{db-init,db-init-with-contract-space,db-update-preflight-gaps,db-update-scenarios,db-verify,db-sign,db-introspect,emit,migration-apply,migration-plan,vite-plugin}/contract*.ts`) — already counted in CLI-journey above; verify no double-count.
- **E2E framework fixtures** (`test/e2e/framework/test/fixtures/contract.ts`, `test/e2e/framework/test/sqlite/fixtures/contract.ts`, `test/e2e/framework/test/sqlite/migrations/harness.ts`) — 3 files.
- **CLI recordings** (`packages/1-framework/3-tooling/cli/recordings/fixtures/contract-{base,additive}.ts`) — 2 files.
- **`packages/3-extensions/sql-orm-client/test/fixtures/contract.ts`** — D5a R1 deferred this to D5b. Apply the same migration pattern unless intent dictates otherwise.

### Tier 2 — investigate before migrating

- **Mongo runtime test** (`packages/2-mongo-family/7-runtime/test/query-builder.test.ts`) — single test file that constructs a contract inline. Inspect: if it's testing the underlying mongo `defineContract` (the wrap's base), migrate it; if it's deliberately exercising the verbose form to test composition, leave it + add a one-line comment.

- **Inline-contract test files** (these have `defineContract` calls inside test bodies; ~20 files surfaced by orchestrator's grep):

  - `test/integration/test/contract-builder.test.ts`
  - `test/integration/test/contract-builder.types.test-d.ts`
  - `test/integration/test/dsl-type-inference.test-d.ts`
  - `test/integration/test/control-api.test.ts`
  - `test/integration/test/family.{schema-verify.basic,schema-verify.dependencies,schema-verify.mismatches}.integration.test.ts`
  - `test/integration/test/family.{schema-verify.helpers,sign-database,verify-database.basic,verify-database.errors}.{test,helpers}.ts`
  - `test/integration/test/referential-actions.integration.test.ts`
  - `test/integration/test/authoring/{paradedb-bm25-narrowing,mongo-pack-composition,callback-mode-terseness}.test.ts`
  - `test/integration/test/authoring/psl-index-type-options.integration.test.ts`
  - `test/integration/test/authoring/parity/ts-psl-parity.real-packs.test.ts`
  - `test/integration/test/utils/cli-test-helpers.ts`

  **Per-file judgment:** if the test is explicitly verifying the underlying `defineContract` (the lower-level base, not the wrap), it should stay on the verbose form — that's what it's testing. If the test is just constructing a contract for use as test input (and the verbose form is incidental), migrate. Use the test's name + first few assertions as your guide. The `.test-d.ts` files are TYPE tests — many likely test the wrap itself (D1/D3 added these; we don't want to break them).

  **Heuristic:** test files at `test/integration/test/contract-builder.*` are almost certainly testing the contract-builder API itself — review carefully, lean toward leaving verbose. Test files at `test/integration/test/family.*` and `test/integration/test/authoring/*` are likely application-level integration tests — lean toward migrating.

- **Disallow-rule fixtures** (`test/integration/test/fixtures/cli/{disallowed-import,exact-prefix-import,custom-allowlist,valid-contract,valid-contract-default}.ts`):

  - `disallowed-import.ts` / `exact-prefix-import.ts` / `custom-allowlist.ts` — these likely deliberately demonstrate disallowed imports for the linter/allowlist rules. **Leave them as-is + add a one-line comment** explaining why (e.g. `// Deliberately verbose: exercises the import-allowlist disallow rule`). If they're not actually testing import allowlists (i.e. they're just stale templates), migrate.
  - `valid-contract.ts` / `valid-contract-default.ts` — these are positive fixtures (valid contracts the allowlist accepts). Same judgment: if the allowlist deliberately tests the verbose form is acceptable, leave; if these are just generic test inputs, migrate.

### Out of scope

- Extension-pack contracts (`packages/3-extensions/{pgvector,postgis}/src/contract.ts`) — A7 exemption (spec § A7).
- Cipherstash migration files — A7 exemption (pre-existing).
- Facade source files (`packages/3-extensions/{postgres,sqlite,mongo}/src/**/*.ts`).
- Facade test files asserting pack rejection via `@ts-expect-error` (`packages/3-extensions/{postgres,sqlite,mongo}/test/contract-builder/define-contract.test-d.ts`).
- Any test fixture that explicitly tests the wrap's input-type rejection of `family:`/`target:`.

## How to work

1. **Heartbeat to `wip/heartbeats/implementer.txt`** every ~5 min, at commit boundaries, and before/after long shell commands. Format includes: `ts`, `role`, `agent_id`, `round` (= `D5b R1`), `phase`, `last_progress`, `next_step`. **Required keys; don't drop any.** Orchestrator's monitoring depends on consistent format.

2. **Commit shape:** atomic per logical group is fine. Suggested grouping: (a) parity test fixtures, (b) CLI-journey fixtures, (c) CLI-integration fixtures, (d) e2e framework + CLI-recording fixtures, (e) top-level integration fixtures + sql-orm-client, (f) Tier 2 per-file judgments. Or one giant mechanical commit — orchestrator doesn't care, your call.

3. **Pattern verification before scaling:** migrate 2-3 fixtures across different categories (e.g. one CLI-journey, one parity, one top-level), commit, run a narrow test gate (`pnpm test:integration test/integration/test/authoring/parity/ts-psl-parity.real-packs.test.ts` or similar) to verify the pattern holds, THEN scale. Don't sed all 60 files first and discover the pattern is wrong.

4. **Suggested mechanical approach:**

   ```bash
   # Find all callers
   rg -l '@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/pack' \
     test/integration/test/fixtures/ \
     test/integration/test/authoring/parity/ \
     test/integration/test/authoring/side-by-side/ \
     test/integration/test/{fixtures,sql-builder/fixtures,mongo/fixtures}/contract.ts \
     test/e2e/framework/test/ \
     packages/1-framework/3-tooling/cli/recordings/fixtures/ \
     packages/3-extensions/sql-orm-client/test/fixtures/
   ```

   For each: read, classify (mechanical-migrate / leave-with-comment / per-file-judgment), apply. Don't blindly sed — even mechanical fixtures vary (mongo vs postgres vs sqlite, with-extensionPacks vs without).

5. **Verify integration suite goes green:** after Tier 1 lands, run `pnpm test:integration` (~3-5 min). The 17 failures D4's full-suite run surfaced should all be gone if D5b is complete. If failures remain, diagnose: are they fixture-migration gaps you missed, or genuine regressions D5b introduced, or unrelated environmental flakes (e.g. PGlite connection drops)? Categorize each remaining failure in your structured return.

6. **Structured return** at end: verdict, commits + SHAs + one-liners, gate results, per-file judgment list for Tier 2 (mark each MIGRATED / LEFT-VERBOSE-WITH-COMMENT / OUT-OF-SCOPE with one-line rationale), `pnpm test:integration` final state (pass count / fail count + categorization), anything noteworthy.

## Done when

- [ ] D5a landed (✓ confirmed before dispatch).
- [ ] Grep gate: `rg "@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/(pack|control)" -g '!**/node_modules/**' -g '!**/dist/**' -g '!projects/**'` returns only:
  - facade source files (`packages/3-extensions/{postgres,sqlite,mongo}/src/{exports/{family,target}.ts,contract/define-contract.ts}`),
  - facade `@ts-expect-error` test files (`packages/3-extensions/{postgres,sqlite,mongo}/test/contract-builder/define-contract.test-d.ts`),
  - cipherstash migration files (A7),
  - extension-pack `src/contract.ts` files (`pgvector`, `postgis`) — A7,
  - any Tier 2 file you explicitly left verbose-with-comment (each must have a one-line comment explaining the reason).
- [ ] `pnpm test:integration` clean (the 17 failures from D4's full-suite run are gone). If specific failures persist, categorize them in your structured return (genuine regression / unrelated flake / leftover fixture gap).
- [ ] `pnpm test:e2e` clean (or unchanged from D4-state).
- [ ] `pnpm lint:deps` clean.
- [ ] `pnpm fixtures:check` clean (if not pre-existing-env-broken — D4 noted this was env-broken; if same env error, mention in structured return).
- [ ] Intent-validation: diff covers only test-fixture / test-file user-contract migration + Tier 2 leave-with-comment edits; no source change to packages, no facade source change, no extension-pack contract change.
- [ ] FR9 fully satisfied (examples sweep from D5a + test-fixture sweep from D5b together).

## Size / scope reality check

If at any point during migration you realize the fan-out is materially larger than the ~60 files inventoried (e.g. you find another category the orchestrator missed), STOP, heartbeat with phase=`scope-escalation`, and report back rather than blast through. The M-cap is real; we'd rather split D5b into D5b-i + D5b-ii than ship an L.

## Begin

Acknowledge by writing your first heartbeat with phase=`orienting`. Then start.
