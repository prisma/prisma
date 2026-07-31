# Reviewer resume — D4 R1

## Resume — `facade-import-surface-completion`, D4 R1

> You retain your prior transcript through D3 R2. New orchestrator notes block: `### D4 R1 — orchestrator verified test-pin sweep narrowly` — read it first; it captures the validation-gate work the orchestrator did to disambiguate flake-vs-regression.

## What changed since the last review

**New commits this round (2 commits, +43/-46 across 18 files):**

- `01c3b1153` — `refactor(target-{postgres,sqlite}): emit facade migration specifier` — flips `BASE_IMPORTS` in both renderers + `TARGET_MIGRATION_MODULE` in both op-factory-call modules + docstrings in 3 internal source files
- `b643c5a12` — `test: update string pins for facade migration specifier` — sweeps 11 string-pinned test files (8 target+adapter, 3 cli-journey)

Pull diff: `git diff 40839ecae..b643c5a12` (skips orchestrator brief commit).

**Implementer's structured return arrived this round** (recovered from earlier notification lag — both the D2 R1 and D3 R1 reports also caught up in the same notification flood). Treat it as supplementary context; the orchestrator already cross-verified gates.

## Items to triage

- **Renderer-flip atomicity.** Verify that both `BASE_IMPORTS` and `TARGET_MIGRATION_MODULE` flipped together in the same commit (`01c3b1153`) for both Postgres and SQLite. If either constant was flipped in isolation, rendered output would carry mixed specifiers — `must-fix`. Orchestrator's grep gate (`rg "@internal/target-(postgres|sqlite)/migration"`) returned only the expected leave-alone list (facade re-export sources, cipherstash docstring, D1/D3 parity tests). Spot-check this independently.

- **Test-pin completeness.** D4's brief inventory listed 11 string-pinned test files (and noted `render-typescript.roundtrip.test.ts` for sqlite as a "verify shape; update if string-pinned" entry — implementer's diff shows it touched). **Your task:** rg the workspace for any remaining `@internal/target-(postgres|sqlite)/migration` references in `**/test/**` that aren't in the leave-alone list — confirm zero hits outside expected positions.

- **Test pins point at the correct façade subpath.** Test pins should now assert `@internal/{postgres,sqlite}/migration`, NOT the old target specifier. Sample a few of the updated test files and verify the string literal matches the new spec.

- **Internal docstrings updated.** Three additional internal files got docstring touch-ups (`postgres-migration.ts` L22, both `src/exports/migration.ts` file headers, both `render-typescript.ts` file headers per the implementer's report). Verify the prose references match the new specifier.

- **Cipherstash + extension-pack migration files NOT touched.** D4's brief explicitly preserves these on the target specifier per A7 (extension-authoring contract). `packages/3-extensions/cipherstash/**` should have zero diff in this dispatch. Same for `examples/<app>/migrations/app/**`.

## Acceptance bar for SATISFIED (D4)

- **FR8 PASS:** Postgres + SQLite renderers + `TARGET_MIGRATION_MODULE` emit `@internal/{postgres,sqlite}/migration`. Evidence = `01c3b1153` constant changes + `b643c5a12` test-pin updates.
- All "Done when" gates per the D4 brief — with these adjusted assertions:
  - **Package-scoped tests** (`pnpm test --filter @internal/target-postgres --filter @internal/target-sqlite --filter @internal/adapter-sqlite`): clean.
  - **`adapter-postgres` package tests**: orchestrator note records 2-4 `SqlConnectionError` flakes in different test files across two runs. None of the failing files were D4-touched. **Treat as flake, not D4 regression.** If you want independent verification, re-run `pnpm test --filter @internal/adapter-postgres` (~3 min) and confirm failures are still concentrated on `*.integration.test.ts` with connection-level errors, not on D4-touched files.
  - **`pnpm test:integration` full suite**: 17 failures across 15 files when run end-to-end (orchestrator ran), most likely a combination of connection flakes + D1 `defineContract` input-type-drop fallout in test setups that call `defineContract({ family: ..., target: ... })`. **D4-narrow integration tests** (the 2 cli-journey files D4 touched) pass cleanly (orchestrator ran: 7 tests pass). The broader failures are D5-blocking issues that escaped into integration tests; not D4 regressions.
  - **`pnpm test:e2e`**: implementer did not run; orchestrator did not run. If you want it, run `pnpm test:e2e` — but the prior in-scope coverage (target tests + adapter string-pinned tests + the 2 D4-touched cli-journey e2e tests) already covers the renderer-flip behaviour. e2e may surface the same `defineContract` D1 fallout.
- Transient-ID scan: zero hits on `+` diff.
- Grep gate per the D4 brief — orchestrator verified once; you cross-verify.

## Anything that has changed in your operating context

- **D5 scope is broader than the slice plan originally captured.** Integration tests + e2e tests that construct contracts via `defineContract({ family: ..., target: ... })` will also break under the D1 input-type drop — not just example apps. The orchestrator will add this to D5's brief at dispatch time; you don't need to act on it for D4.
- **Implementer's heartbeat + structured-return discipline improved partially.** D3 R1 returned a clean structured report (8 pings, full return shape); D4 R1 also returned a structured report. D2 R1 was the only fully-broken round; D3 R2 was a 1-line fix that didn't need cadence. Calibration is partially landing.

## Reminders (terse)

- Findings must be addressable in this PR.
- F-numbers durable.
- Three-line-plus-heading round entry.
- Heartbeats per usual cadence.

Begin.
