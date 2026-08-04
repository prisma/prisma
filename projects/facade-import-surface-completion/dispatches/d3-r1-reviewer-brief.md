# Reviewer resume — D3 R1

## Resume — `facade-import-surface-completion`, D3 R1

> You are being resumed. You retain your prior transcript including D1 R1/R2 + D2 R1 verdicts, F1 (resolved), and your AC scoreboard. Trust your prior transcript; reconcile from on-disk `code-review.md` § Orchestrator notes — there's a new block (`### D3 R1 — same pattern as D2; orchestrator ran gates locally again`) you should read first.

## What changed since the last review

**New commits this round (6 commits, +649/-49 across 16 files):**

- `5d39a134c` — `feat(@internal/sqlite): add dependencies for facade subpaths`
- `7ae032dc6` — `feat(@internal/sqlite): add /config subpath`
- `823e27ade` — `feat(@internal/sqlite): add /contract-builder subpath with wrapped defineContract`
- `de998a1dc` — `feat(@internal/sqlite): add /control subpath`
- `bff9ad09b` — `feat(@internal/sqlite): add /migration re-export with parity tests`
- `fbf1a25b4` — `docs(@internal/sqlite): rewrite README to mirror Postgres structure`

Pull the diff via `git diff c0cbd4d05..fbf1a25b4` (skips the orchestrator's interceding brief commit; HEAD = `fbf1a25b4`).

**Implementer's structured report is MISSING again** (second round in a row). Orchestrator note in `code-review.md` carries the validation-gate results the orchestrator ran directly. Treat on-disk source as primary evidence.

## Items to triage

The orchestrator does not have an implementer flag list this round. Items the orchestrator wants you to evaluate independently:

- **Wrap signature consistency with D1 R2's Postgres wrap.** The SQLite wrap (`packages/3-extensions/sqlite/src/contract/define-contract.ts`) should be mechanically `s/postgres/sqlite/g; s/PostgresPack/SqlitePack/g` of D1 R2's Postgres wrap. **Your task:** verify it's a faithful mirror — same overload count, same `Types`/`Models`/`ExtensionPacks`/`Capabilities` const-param threading, same `ModelLike` constraint on `Models`, same `Omit<ReturnType<...>> & { target/targetFamily }` literal-pinning intersection. Any structural deviation that wasn't explicitly justified by SQLite-specific behaviour is a `should-fix` (consistency matters more than novelty here).

- **Type test parity with D1 R2 + D2 R1.** `test/contract-builder/define-contract.test-d.ts` should carry all three lessons: `@ts-expect-error` for `family:`/`target:`, positive `'sqlite'`/`'sql'` literal-type assertions, positive `not.toBeNever()` for both definition and factory forms. Orchestrator read confirms all three are present; sanity-check the non-tautology of the `not.toBeNever()` assertions (would they fail under a degraded return type?).

- **`createSqliteControlClient` SPI shape parity.** Mirror of `createMongoControlClient` (which mirrored `createPostgresControlClient`). Same `MongoControlClientOptions`-equivalent shape (`connection?`, `extensionPacks?`), same `ifDefined` conditional spreading, same `ControlClient` re-export. Any deviation surfaces as a `should-fix`.

- **`/migration` re-export parity.** One-liner `export * from '@internal/target-sqlite/migration'`. Test mirrors D1's postgres parity test (key-equality + per-symbol identity). 13 tests pass.

- **`/config` mirror of Postgres.** `SqliteConfigOptions` shape should match `PostgresConfigOptions`. Notable: SQLite is file-based, so `connection` may semantically mean a file path rather than a URL — but the field name should still be `connection` for cross-target consistency unless the implementer explicitly justified renaming. Verify against `packages/3-extensions/postgres/src/config/define-config.ts`.

- **Dep additions: 5 new workspace deps** (`@internal/cli`, `@internal/config`, `@internal/sql-contract-psl`, `@internal/sql-contract-ts`, `pathe`). Same dep pattern Postgres and Mongo facades already use. Orchestrator confirms `pnpm lint:deps` clean (no cycle introduced).

- **`architecture.config.json` planes:** 4 new entries (config = shared, contract-builder = shared, control = migration, migration = migration). Should mirror Postgres + Mongo planes for the same surfaces.

- **README rewrite.** New file mirrors Postgres's README structure. Subpath-per-section. Verify the contract-builder example uses the no-`family`/`target` form (consistent with D1 + D2 README updates).

## Acceptance bar for SATISFIED (D3)

- **FR4 PASS:** `@internal/sqlite/config` exports `defineConfig` + `SqliteConfigOptions`. Evidence = `define-config.test.ts` (8 tests).
- **FR5 PASS:** `@internal/sqlite/contract-builder` exports the SQL surface with the wrapped `defineContract`. Evidence = `re-export`-style test (in `define-contract.test.ts`/`define-contract.test-d.ts`).
- **FR6 PASS:** `@internal/sqlite/control` exports `createSqliteControlClient`. Evidence = `create-sqlite-control-client.test.ts` (3 tests).
- **FR7 PASS:** `@internal/sqlite/migration` re-exports the target's migration surface with parity. Evidence = `re-export.test.ts` (13 tests).
- **FR11 (SQLite facet) PASS:** wrapped `defineContract` pre-binds family + target, drops them from input type, preserves model-shape inference. Evidence = `define-contract.test-d.ts` positive assertions.
- All "Done when" gates pass — orchestrator ran build, typecheck, test, lint:deps locally; results in the new orchestrator note.
- Transient-ID scan zero hits on `+` diff.

After D3 SATISFIED: 10/11 FRs PASS, only FR8 (D4 renderer flip) and FR9 (D5 example sweep) remaining. FR6 ("D6" docs sweep) feeds into D6.

## Anything that has changed in your operating context

- **Implementer structured-return discipline is a persistent gap** (D2 + D3 both missed it). Orchestrator is no longer relying on it; on-disk verification + locally-run gates are canonical. Document this in your round entry's `## For orchestrator` only if it bears on a specific finding; otherwise the orchestrator's note in `## Orchestrator notes` already records it.
- **Branch-level `pnpm typecheck` still red** from D1's `family:`/`target:` input-type drop. D5 fixes. Continue treating workspace-wide typecheck as out-of-scope for D3 SATISFIED.

## Reminders (terse)

- Findings must be addressable in this PR; in-code action items only.
- F-numbers durable; don't reuse F1.
- Three-line-plus-heading round entry is the target.
- Heartbeats to `wip/heartbeats/reviewer.txt` on the usual cadence.

Begin.
