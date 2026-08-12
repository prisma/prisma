# Implementer resume — D4 R1

## Resume — `facade-import-surface-completion`, D4 R1

> You are being resumed. Trust your prior transcript from D1 R1/R2 + D2 R1 + D3 R1/R2.

D3 is SATISFIED. 10/11 FRs PASS. D4 = the renderer switch + IR-constant flip + test-pin sweep. After D4, only FR9 (examples sweep, D5) and the docs sweep (D6) remain.

## Calibration items (third reminder — must take effect this round)

D2 R1, D3 R1, D3 R2 all shipped one-shot end-of-round heartbeats and no structured return. Per persona doc:

1. **Heartbeats** — `wip/heartbeats/implementer.txt` is overwritten on a ~5-min cadence + at every commit boundary + before/after every long-running shell call. Each ping is structured `key: value` lines per `agents/implementer.md § Heartbeats`. For D4 (~20 files, ~30-60 min wall, multiple test reruns expected): minimum 10 pings. The orchestrator reads this file between turns to detect a stuck round — without it, ambiguity wastes wall-time.
2. **Structured return** — the final tool call of the round is the structured return per `agents/implementer.md § Return shape`. Not a heartbeat write. Not the absence of a response. If you commit and stop, the orchestrator has to verify on-disk + re-run gates manually, which is what's happened all three prior rounds. Break the pattern in D4.

Both items are procedural; the orchestrator can't file them as findings (F-numbers are reserved for in-PR code addressable items), but persistent non-compliance now risks an escalation that's outside the loop's control.

## Context

D4 is the atomic renderer flip. Two source constants control which module specifier the migration renderer emits in user-facing rendered `migration.ts` files: `BASE_IMPORTS` in `render-typescript.ts` and `TARGET_MIGRATION_MODULE` in `op-factory-call.ts`. Both exist for Postgres and SQLite (Mongo doesn't render TypeScript migrations the same way). They must flip together — each op-factory call's `importRequirements()` overrides the renderer's `BASE_IMPORTS` for the same symbols; flipping only one yields mixed specifiers in rendered output, which would silently break user-facing migration files.

After the flip:

- `BASE_IMPORTS` for the Postgres renderer points at `@internal/postgres/migration` (instead of `@internal/target-postgres/migration`).
- `BASE_IMPORTS` for the SQLite renderer points at `@internal/sqlite/migration`.
- `TARGET_MIGRATION_MODULE` for both Postgres and SQLite op-factory-call modules points at the matching facade specifier.
- ~15 string-pinned test files that assert on the rendered specifier need their pins updated to match.
- A handful of internal-source comments / docstrings referencing the specifier as rendered-output context get touched up.

## Intent

Atomically flip the migration renderer's emitted specifier from `@internal/target-{postgres,sqlite}/migration` to `@internal/{postgres,sqlite}/migration` so user-facing rendered migration files import from the public façade subpath. No behaviour change in the renderer itself, no schema change, no migration-hash impact (`migrationHash` is content-addressed over `ops.json`, not over `migration.ts` — verified in pre-dispatch research; the renderer flip is hash-invisible).

Anti-corruption: this dispatch does **not** migrate `examples/` user-authored TS (D5), does **not** touch docs/skills/READMEs outside the renderer files themselves (D6), does **not** touch hand-authored extension-pack migration files (those stay on the target specifier deliberately per A7).

## Files in play (from slice plan D4 section, verified via pre-dispatch research)

### Renderer sources (4 files)

- `packages/3-targets/3-targets/postgres/src/core/migrations/render-typescript.ts` — `BASE_IMPORTS` swap (`@internal/target-postgres/migration` → `@internal/postgres/migration`).
- `packages/3-targets/3-targets/sqlite/src/core/migrations/render-typescript.ts` — `BASE_IMPORTS` swap (`@internal/target-sqlite/migration` → `@internal/sqlite/migration`).
- `packages/3-targets/3-targets/postgres/src/core/migrations/op-factory-call.ts` — `TARGET_MIGRATION_MODULE` swap.
- `packages/3-targets/3-targets/sqlite/src/core/migrations/op-factory-call.ts` — `TARGET_MIGRATION_MODULE` swap.

### String-pinned tests (target + adapter)

- `packages/3-targets/3-targets/postgres/test/migrations/issue-planner.test.ts`.
- `packages/3-targets/3-targets/sqlite/test/migrations/op-factory-call.test.ts`.
- `packages/3-targets/3-targets/sqlite/test/migrations/planner.authoring-surface.test.ts`.
- `packages/3-targets/6-adapters/postgres/test/migrations/op-factory-call.rendering.test.ts`.
- `packages/3-targets/6-adapters/postgres/test/migrations/op-factory-call.lowering.test.ts`.
- `packages/3-targets/6-adapters/postgres/test/migrations/planner.authoring-surface.test.ts`.
- `packages/3-targets/6-adapters/postgres/test/migrations/render-typescript.roundtrip.test.ts`.
- `packages/3-targets/6-adapters/sqlite/test/migrations/render-typescript.roundtrip.test.ts` — verify shape; update if string-pinned.

### String-pinned e2e tests

- `test/integration/test/cli-journeys/invariant-routing.e2e.test.ts` (2 occurrences).
- `test/integration/test/cli-journeys/migration-round-trip.e2e.test.ts` (1 occurrence).
- `test/integration/test/cli-journeys/init-journey/harness.ts` (1 occurrence — comment + harness; update both consistently).

### Internal-source comments / docstrings

- `packages/3-targets/3-targets/postgres/src/core/migrations/postgres-migration.ts` — docstring at L22.
- `packages/3-targets/3-targets/{postgres,sqlite}/src/exports/migration.ts` — file-header comments.
- `packages/3-targets/3-targets/{postgres,sqlite}/src/core/migrations/render-typescript.ts` — file-header comments.

### Approach

Edit-then-verify per file group:

1. Flip the 4 renderer sources first (constants only).
2. Update the docstrings/headers in the renderer files in the same commit.
3. Run `pnpm test --filter @internal/target-postgres --filter @internal/target-sqlite` — expect failures in the string-pinned tests, fix them inline.
4. Repeat for the adapters: `pnpm test --filter @internal/adapter-postgres --filter @internal/adapter-sqlite`.
5. Run `pnpm test:integration` for the cli-journey e2e tests; fix the string pins.
6. Run `pnpm fixtures:check` — should be clean since `migrationHash` is over `ops.json` not over rendered `.ts`.

Commit shape options (your call): single atomic commit (matches the brief's "must flip together" framing); or two commits (`refactor(target-{postgres,sqlite}): emit facade migration specifier` + `test: update test pins for facade migration specifier`). If you split, both commits must land in this PR — splitting only matters for review legibility.

## "Done when" gates

- [ ] `pnpm build --filter @internal/target-postgres --filter @internal/target-sqlite` clean.
- [ ] `pnpm test:packages` clean across both target packages and both adapters.
- [ ] `pnpm test:integration` clean (cli-journey e2e tests pass with the flipped specifier).
- [ ] `pnpm test:e2e` clean.
- [ ] `pnpm fixtures:check` clean (hash invariance verified by passing fixtures).
- [ ] `pnpm lint:deps` clean.
- [ ] Intent-validation: diff covers exactly the 4 source files + the test-pin sweep + the docstring touch-ups. No façade source change. No example migration.
- [ ] Grep gate: `rg "@internal/target-(postgres|sqlite)/migration" -g '!**/node_modules/**' -g '!**/migrations/**'` returns only:
  - the internal target packages' own `src/exports/migration.ts` (the source of `/migration`),
  - the cipherstash extension's `src/exports/migration.ts` docstring (deliberate; documents the extension authoring contract — leave),
  - the parity tests added in D1 + D3 (which explicitly assert the façade re-exports byte-match the target — leave; they cite both specifiers by design),
  - `skills/` / `docs/` / `README.md` references that get flipped in D6 (leave).

## Edge cases / failure modes

- **Mixed-specifier renderer output.** If you flip only `BASE_IMPORTS` and forget `TARGET_MIGRATION_MODULE` (or vice versa), tests will likely catch a render mismatch — but the failure mode is subtle (mixed imports in the same file). Verify both sides flipped in both targets before running tests.
- **Forgotten test pin.** Tests that assert exact-string against rendered output need every occurrence updated. The slice plan inventory is authoritative; rg-verify after editing: `rg '@internal/target-postgres/migration' packages/ test/ -g '!**/node_modules/**'` should return only the leave-alone list above after your changes.
- **Don't touch examples/migrations/app/.** Pre-existing rendered migration files under `examples/<app>/migrations/` use the old specifier deliberately — they're frozen rendered output. Per the slice spec A7 they stay valid. Don't sweep them.
- **Cipherstash extension's `src/exports/migration.ts` docstring** is *deliberately* on the target specifier — it documents the extension-authoring contract (extension migrations bypass the facade by design). Don't touch.

## Out of scope (this dispatch)

- `examples/*/prisma-next.config.ts` (D5).
- `examples/*/prisma/contract.ts` (D5).
- `packages/3-extensions/{pgvector,postgis}/src/contract.ts` (D5).
- `skills/prisma-next-migrations/SKILL.md`, `skills/DEVELOPING.md`, `packages/1-framework/1-core/ts-render/README.md`, `packages/1-framework/3-tooling/cli/README.md`, `docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md` — all D6.

## Constraints (terse)

- Explicit-staging commits; no amend; no push.
- Heartbeats every ~5 min + commit boundary + before/after each long-running test command (≥ 10 pings expected for this round).
- Structured return per `agents/implementer.md § Return shape` as your final tool call.
- Read-only on spec.md, plan.md, code-review.md.

Begin.
