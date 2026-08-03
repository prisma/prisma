# D5a — Example apps + extension-pack contracts migrate to façade form

You are implementing **D5a** in `projects/facade-import-surface-completion/slices/facade-completion/`. D5 was originally one dispatch but the orchestrator split it into D5a (this dispatch, ~19 files) + D5b (test-fixture sweep, follow-on). You handle D5a only. Your changes establish the migration pattern that D5b will scale.

## Context (orient yourself before starting)

Read in this order:

1. `projects/facade-import-surface-completion/spec.md` — project spec.
2. `projects/facade-import-surface-completion/slices/facade-completion/spec.md` — slice spec.
3. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` — full dispatch plan, especially:
   - The pre-dispatch context-gathering block (lists Assumptions A1-A7 the orchestrator established).
   - The "Mid-flight split" note in the preamble.
   - **§ Dispatch 5a** (this dispatch's scope).
   - **§ Dispatch 5b** (so you understand what you're *not* doing — test fixtures, broader CLI-journey contracts).
4. `projects/facade-import-surface-completion/reviews/code-review.md` — Subagent IDs, AC scoreboard, all prior round entries (D1-D4) so you can see the rhythm.

D1, D2, D3, D4 are SATISFIED. The facades now expose:

- `@internal/postgres/contract-builder` (wrapped `defineContract` pre-binding `sqlFamily` + `postgresPack`; no longer accepts `family:`/`target:` keys)
- `@internal/postgres/config`, `/control`, `/migration`
- `@internal/sqlite/contract-builder`, `/config`, `/control`, `/migration` (same wrap pattern)
- `@internal/mongo/contract-builder`, `/config`, `/control`, `/bson` (no `.` barrel — BSON value constructors moved to `/bson`)

The renderer (D4) now emits `@internal/{postgres,sqlite}/migration` in newly-rendered migration files. **Existing rendered migration files in `examples/<app>/migrations/app/**`** stay on the old specifier — A7 protects them; do NOT touch them.

## Intent

Migrate every user-authored TS file under `examples/` (and the two extension-pack `src/contract.ts` files) from verbose-internal-imports to façade form. After this dispatch lands, `examples/` becomes the canonical demonstration of how external users author Prisma Next apps.

## Files in scope

### Tier 1 — definite (per slice plan)

- **13 `examples/*/prisma-next.config.ts` files** (re-grep to confirm before starting):
  - `examples/multi-extension-monorepo/app/prisma-next.config.ts`
  - `examples/multi-extension-monorepo/packages/feature-flags/prisma-next.config.ts`
  - `examples/multi-extension-monorepo/packages/audit/prisma-next.config.ts`
  - `examples/retail-store/prisma-next.config.ts`
  - `examples/mongo-demo/prisma-next.config.ts`
  - `examples/prisma-8-demo-sqlite/prisma-next.config.ts`
  - `examples/prisma-8-cloudflare-worker/prisma-next.config.ts`
  - `examples/cipherstash-integration/prisma-next.config.ts`
  - `examples/paradedb-demo/prisma-next.config.ts`
  - `examples/react-router-demo/prisma-next.config.ts`
  - `examples/mongo-blog-leaderboard/prisma-next.config.ts`
  - `examples/prisma-8-demo/prisma-next.config.ts`
  - `examples/prisma-8-postgis-demo/prisma-next.config.ts`

  Migration pattern: replace verbose `defineConfig` imports (`@internal/cli`, `@internal/family-{sql,mongo}/control`, `@internal/target-{postgres,sqlite,mongo}/control`, etc.) with the facade form (`@internal/{postgres,sqlite,mongo}/config`'s `defineConfig`). Mirror the pattern from any example already migrated (e.g. `prisma-8-demo` was D0-migrated; verify shape).

- **4 `examples/*/prisma/contract.ts` files**:
  - `examples/prisma-8-demo-sqlite/prisma/contract.ts`
  - `examples/paradedb-demo/prisma/contract.ts`
  - `examples/react-router-demo/prisma/contract.ts`
  - `examples/prisma-8-demo/prisma/contract.ts`

  Migration pattern:
  - Replace `import { defineContract } from '@internal/sql-contract-ts/contract-builder'` (or similar) with `import { defineContract } from '@internal/{postgres,sqlite}/contract-builder'`.
  - Drop `import sqlFamily from '@internal/family-sql/pack'` and `import postgresPack from '@internal/target-postgres/pack'` (or sqlite equivalents).
  - Drop `family: sqlFamily` and `target: postgresPack` from the `defineContract` arguments.
  - Keep `extensionPacks: { ... }` as-is. Keep all `field`, `model`, `rel` usage as-is — those are still imported from the same place via the facade's `/contract-builder` re-exports.

- **2 extension-pack contracts**:
  - `packages/3-extensions/pgvector/src/contract.ts`
  - `packages/3-extensions/postgis/src/contract.ts`

  Same migration pattern as the example contracts. One of these has `extensionPacks` wiring — verify the wrapped `defineContract` accepts it (D1/D3 added type tests for this; trust those + the typecheck).

### Tier 2 — investigate-then-migrate (orig D5 brief item, judgement required)

- `packages/3-extensions/sql-orm-client/test/fixtures/contract.ts` — test fixture. Read the surrounding test to verify migration doesn't break test intent. If the test deliberately exercises the verbose form, leave it + add a one-line comment explaining why; if not, migrate.

- `examples/multi-extension-monorepo/test/multi-space.e2e.integration.test.ts` — imports `postgresAdapterDescriptor` from `@internal/adapter-postgres/control`, `executeDbInit` from `@internal/cli/control-api`, `postgresDriverDescriptor` from `@internal/driver-postgres/control`, `sqlFamilyDescriptor` from `@internal/family-sql/control`, `postgresTargetDescriptor` from `@internal/target-postgres/control`. The slice plan's original D5 scope note covers this: "in scope if the façade now exposes the equivalent surface (`createSqliteControlClient`, `createMongoControlClient`, `createPostgresControlClient`)". Verify what the facade `/control` exports and migrate if equivalent; otherwise leave + note in your structured return for D5b consideration.

- `examples/prisma-8-postgis-demo/test/utils/test-database.ts` — same investigate-then-migrate treatment.

### Out of scope for D5a (D5b will handle)

- All `test/integration/test/**/contract*.ts` and `test/integration/test/**/prisma-next.config*.ts` fixtures.
- All `test/e2e/framework/test/**/contract.ts` fixtures.
- `packages/1-framework/3-tooling/cli/recordings/fixtures/contract-*.ts`.
- `packages/2-mongo-family/7-runtime/test/query-builder.test.ts`.
- Test helpers (`test/integration/test/utils/cli-test-helpers.ts` etc.).
- Test files that inline-construct contracts (`test/integration/test/contract-builder.test.ts` etc.).

### Out of scope entirely (per A7 / OQ6)

- `examples/<app>/migrations/app/**/*.ts` — pre-rendered migration files stay on the old specifier (A7).
- `examples/*/packages/*/src/contract.d.ts` — emitter-generated `.d.ts` files; users don't author or read these.
- `packages/3-extensions/cipherstash/**` — A7 extension exemption.

## How to work

You are a `generalPurpose` subagent of `claude-4.6-sonnet-low-thinking`. Follow the standard drive implementer protocol:

1. **Heartbeat to `wip/heartbeats/implementer.txt`** every ~5 min, at commit boundaries, and before/after long shell commands. Format: ts / role / agent_id / round (= "D5a R1") / phase / last_progress / next_step / expected_duration. **The orchestrator monitors this file; missing heartbeats break our cadence loop.**
2. **Commit shape:** the orchestrator doesn't care about granularity. Atomic commits per logical change is fine; one big commit is fine. Use intent-driven messages.
3. **Structured return** at end: verdict (DONE/BLOCKED), commits landed (SHAs + one-line each), gate results (per "Done when" checklist), anything noteworthy (failed gates with diagnosis, leftover scope, surprises), recommended next step.

## Done when

Per the slice plan's D5 (now D5a) Done-when checklist, adjusted:

- [ ] D2 + D3 landed (✓ confirmed before dispatch).
- [ ] Grep gate (config): `rg "@internal/(cli|family-(sql|mongo)|sql-(contract|contract-psl|contract-ts)|mongo-(contract|contract-psl|contract-ts)|target-(postgres|sqlite|mongo)|adapter-(postgres|sqlite|mongo)|driver-(postgres|sqlite|mongo))/" examples/*/prisma-next.config.ts examples/multi-extension-monorepo/**/prisma-next.config.ts` returns zero hits.
- [ ] Grep gate (contract): `rg "@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/(pack|control)" examples/*/prisma/contract.ts packages/3-extensions/{pgvector,postgis}/src/contract.ts` returns zero hits.
- [ ] `pnpm typecheck` clean for every example (use `pnpm -r --filter './examples/*' typecheck` or whatever the repo's all-examples task is — check `package.json` scripts first).
- [ ] `pnpm build` clean across the workspace (`pnpm build` at repo root).
- [ ] `pnpm lint:deps` clean.
- [ ] Intent-validation: diff covers only `examples/**/{prisma-next.config.ts,prisma/contract.ts}` + `packages/3-extensions/{pgvector,postgis}/src/contract.ts` + (if you migrated) the sql-orm-client fixture + the example test files; no façade or framework source change.
- [ ] FR9 *partially* satisfied (examples + extension-pack contracts only; report progress against FR9 in your structured return so the reviewer can mark it correctly).

## Notes / gotchas

- **D5b depends on the pattern you establish here.** The CLI-journey fixtures are ~40 templated copies of essentially the same contract shape. The migration pattern you settle on here (especially around the wrapped-`defineContract` import path + how to handle the dropped `family`/`target` arguments) determines what D5b's implementer mechanically applies. Aim for the simplest, most consistent pattern.
- **`extensions:` (note plural in some places, `extensionPacks:` in others) — verify the wrap's input shape.** D1/D3 type tests should be authoritative; if you see drift, check `packages/3-extensions/postgres/src/contract/define-contract.ts` and mirror exactly.
- **Mongo `extensions` + `migrations.dir` were added to config in D2.** If any mongo example's `prisma-next.config.ts` was previously using the verbose form *with* extensions, the migration becomes simpler now.
- **Don't touch `examples/<app>/migrations/app/**`.** A7 protects them.
- **Don't sweep test fixtures.** That's D5b.

## Begin

Acknowledge by writing your first heartbeat with phase = `orienting`. Then start.
