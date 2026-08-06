# Slice spec — Composer: programmatic deploy API over @internal/assemble

Linear: [TML-3174](https://linear.app/prisma-company/issue/TML-3174). Parent: [consolidate-clis plan](../../plan.md), Phase 1c slice 1 — the project's long pole. Repo: prisma/composer (implementation); this spec lives with the project artifacts in prisma/prisma.

## At a glance

Composer's only programmatic entry today is argv-shaped: `run(argv, deps)` in `packages/0-framework/3-tooling/cli/src/main.ts`, mixing parsing, orchestration, console output, and exit codes; deploy executes by `spawnSync`ing the `alchemy` bin (`run-alchemy.ts`). `@internal/assemble` was extracted specifically so "the future programmatic deploy API" could be its second consumer (`docs/design/10-domains/deploy-cli.md`), but that API does not exist. This slice builds it: typed `deploy`/`destroy`/`dev`/`log` operations returning structured results, so the unified `prisma` CLI can pilot Composer in-process.

## Chosen design

- New package-internal module (e.g. `@internal/control` or an `exports/control` entrypoint on the existing CLI package — implementer's call within composer's layering rules) exposing typed operations:
  - `deploy({ entry|config, name?, stage?, production? }) → DeploymentResult`-shaped structured result (the `DeploymentResult` + `render-deployment.ts` split from ADR-0033 already separates result from rendering — reuse it).
  - `destroy`, `dev` (start/stop handle for the watch/emulator loop), `log` with equivalent typed inputs and structured results/streams.
- The operations wrap what `main.ts` does today *minus* argv and console: config load via the existing loader, assembly via `@internal/assemble`, execution via the existing alchemy spawn (`run-alchemy.ts`) kept as the internal mechanism. No attempt to replace alchemy — invisible implementation detail per the agreed reading of invariant 5.
- The effect-resolution preflight (`check-effect-resolution.ts`) runs inside the operations and reports as a structured failure, not a process crash.
- `prisma-composer`'s clipanion commands become consumers of the new operations (thin parse → call → render), proving the API by using it — same dual-interface shape the Compute CLI documented in terminal ADR-0006 but never shipped.
- Publish the surface from `@prisma/composer` (exact entrypoint name per composer's `exports/` conventions).

## Coherence rationale

One PR, one reviewer sitting: the API is an extraction of existing orchestration into typed functions plus the CLI re-pointed at them. Composer's integration/e2e suites (which drive the spawned binary) pin behavior end-to-end; if they stay green with the CLI consuming the API, the extraction is faithful. Rollback is one revert.

## Scope

**In:** the typed operations + structured result/error types; CLI commands re-pointed; publish entrypoint; unit coverage with injected deps (the existing `RunDeps` injection pattern); e2e suites unchanged and green.

**Deliberately out:** validator-to-diagnostics conversion (next slice); `@prisma/dev` emulator carve-out (next slice); any config-file changes; the unified CLI's `project` command wiring (host repo, Phase 2); test-double export (follows the API's shape once settled).

## Contract impact

None on prisma/prisma surfaces. Composer-side: new published entrypoint on `@prisma/composer` — additive.

## Pre-investigated edge cases

| Edge case | Disposition |
| --- | --- |
| `bin.ts` runs `checkEffectResolution` before importing command modules because alchemy's provider tree can crash at import (TML-3158) | The operations module must preserve that ordering internally: preflight before any dynamic import of the alchemy-touching tree; failure = structured result |
| Deploy semantics: bare deploy targets production; `destroy` requires explicit `--stage` or `--production`, never both | Encode in the typed inputs (e.g. discriminated target), don't re-derive from string flags |
| `dev` is long-running with detached-child emulator handling (`~/.prisma-composer/emulators`) | `dev` returns a handle (start/stop/await), not a completed result; the CLI keeps ownership of signal handling |
| Stage names validated via `git check-ref-format` (`validate-stage.ts`) | Validation lives in the operation, reported as a structured invalid-input failure |

## Slice-specific done conditions

- `test/integration` and the e2e deploy workflow pass with the clipanion commands consuming the new API.
- A consumer outside the CLI (a test) can run `deploy` end-to-end against the integration fixture without touching argv, console capture, or exit codes.

## Open questions

- Entrypoint naming (`@prisma/composer/control` vs other) — decide inside composer's export conventions, not blocking.
- `@prisma/dev`: confirm whether the emulator ships as a new package from composer's `@internal/dev-emulators` or wires to an existing package (external dependency noted in the project plan; does not block this slice).

## References

- `wip/repos/composer/packages/0-framework/3-tooling/cli/src/{main.ts,run-alchemy.ts,load-config.ts}`
- `wip/repos/composer/docs/design/10-domains/deploy-cli.md` (§ programmatic deploy API), ADR-0027 (published packages), ADR-0033 (result/render split)
- [current-state.md § Seam quality — Composer](../../current-state.md)
