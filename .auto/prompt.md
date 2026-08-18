# Autoresearch: integration test CI speed

## Objective
Reduce the wall-clock runtime of Prisma Next's GitHub Actions `Integration Tests` job while preserving its behavior, coverage, reliability, and isolation. Optimize the CI path, test harness, and fixtures rather than weakening or skipping tests. Use GitHub-hosted runner measurements as the source of truth; local already-built suite measurements remain useful diagnostics.

## Metrics
- **Primary**: `ci_integration_critical_path_seconds` (seconds, lower is better) — maximum elapsed time among the GitHub Actions integration jobs. For an unsharded run this is the single `Integration Tests` job; for a sharded run it is the slowest shard and therefore the integration gate's critical path.
- **Secondary**: `ci_integration_step_seconds`, `test_files`, `tests` — maximum elapsed `Run Integration tests` step and aggregate passed Vitest file/test counts, monitored to prevent accidental test exclusion.

## How to Run
Push the experiment to its draft PR and measure the resulting `Integration Tests` job or shard jobs with `gh run view <run-id> --json jobs`. Compare multiple successful runs where practical because hosted-runner performance varies. `./.auto/measure.sh` remains the local diagnostic and emits Vitest metrics with the CI timeout multiplier.

Before a local measurement or after changing production package source, run `pnpm build` so integration tests exercise current `dist` artifacts.

## Files in Scope
- `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, and `.github/actions/detect-inert-diff/action.yml` — integration job orchestration, prerequisites, setup, cache, and build path.
- `test/integration/vitest.config.ts` — main integration runner scheduling and worker configuration.
- `test/integration/vitest.journeys.config.ts` — journey runner scheduling and worker configuration.
- `test/integration/test/**` — integration fixtures, lifecycle helpers, and tests when setup can be safely shared or reduced without weakening assertions.
- `test/integration/package.json` — integration scripts when command orchestration is the bottleneck.
- `packages/5-runtime-utils/test-utils/**` and the actual `@repo/test-utils` package location — shared database test infrastructure, only when an integration-focused change is safe for all consumers.
- `.auto/measure.sh`, `.auto/prompt.md`, `.auto/ideas.md` — experiment instrumentation and retained learnings.

## Off Limits
- Removing, skipping, narrowing, or weakening integration tests and assertions.
- Reducing database fidelity (for example replacing real PGlite/Mongo integration paths with mocks).
- Product behavior changes unrelated to test infrastructure performance.
- New runtime or development dependencies solely for benchmarking.
- V8/PGlite stability flags unless repeated measurements and reliability checks justify the change.

## Constraints
- All measured integration tests must pass with the same file and test counts as baseline.
- Preserve test independence and deterministic cleanup.
- Use the repository's Node and pnpm commands; do not use a version switcher, npm, or npx.
- Do not trade meaningful reliability for a small speedup; CI-specific retry and PGlite crash mitigations remain unless evidence proves a safe replacement.
- Prefer simple structural wins over fragile timing-dependent changes.
- Update this file's “What's Been Tried” section with retained wins, dead ends, and key profiling insights.

## What's Been Tried
- Ten historical successful GitHub Actions runs before this branch put the `Integration Tests` job at 1,100–1,451 seconds (median 1,392s) and its test step at 1,052–1,387 seconds (median 1,331.5s). Two draft-PR runs passed in 1,134s job / 1,085s step and 892s job / 811s step. Their means (1,013s job / 948s step) improve on the historical medians by 27.2% / 28.8%, despite substantial hosted-runner variance.
- Two-way Vitest file sharding passed on GitHub Actions with unchanged aggregate coverage: shard 1 ran 190 files / 1,099 tests in 592s job / 534s step; shard 2 ran 189 files / 1,030 tests in 591s job / 529s step. The 592s critical path is 57.5% below the historical unsharded median and 41.6% below the optimized unsharded mean. Summed runner time increased only 16.8% versus the optimized unsharded mean; `fail-fast: false` ensures a failing shard cannot conceal the other shard.
- During the sharded repeat, new commits landed on `main` that changed generated configs to `definePrismaConfig` and upgraded `@prisma/cli-engine` to 0.2.0, exposing a stale engine pin in the init-journey scratch-project harness. The unaffected shard passed in 638s; the other failed solely on the version mismatch. The upstream harness now installs 0.2.0, all 32 targeted journey assertions pass, and the subsequent full CI run passed.
- The second successful sharded run completed in 587s critical-path job time / 533s maximum test-step time, with the same 190+189 files and 1,099+1,030 tests. Across the two successful runs, the critical-path mean is 589.5s, 57.7% below the 1,392s historical median; maximum test-step mean is 533.5s, 59.9% below the 1,331.5s historical median.
- The initial full-suite run took 1,515.29s of Vitest time (379 files, 2,129 tests) but failed 14 tests and one teardown hook because local default timeouts collapsed under load. Measurements now use `TEST_TIMEOUT_MULTIPLIER=2`, matching CI.
- The ported Postgres harness started a fresh PGlite server for every test: 450 startups across 123 files. Reusing one server per contract within a file, truncating user tables between tests, and replacing the server only when the contract changes cut a representative 28-test file from 44s to 31s before row reuse and then to roughly 12–15s with row reuse.
- PGlite transaction stress retains per-test server replacement: reused servers consistently broke the high-concurrency transaction case with `Connection terminated unexpectedly` after preceding transaction tests.
- Reusing one MongoMemoryReplSet per file produced no measurable gain on an 11-test Mongo port (7s both ways), so that added complexity was discarded.
- All 123 Postgres port files pass after the reuse change: 713 tests in 218s wall time. A prior run before the transaction exception took 254s and had one deterministic transaction failure.
- Fair full-suite comparison with `TEST_TIMEOUT_MULTIPLIER=2`: original harness 973.21s versus optimized harness 663.20s, a 310.01s (31.9%) reduction. Both runs retain the same unrelated deterministic `migration-graph-dot` assertion failure; the original additionally timed out in `cli.init-skill-distribution`, while the faster run did not.
- Integration pretest previously selected the whole 109-package workspace. Filtering to integration dependencies plus the Postgres, Mongo, and pgvector public packages selects 77 package tasks and excludes unrelated examples, e2e apps, and public packages.
- Capping Vitest at four workers looked promising on the 123-file Postgres port subset (188s versus 218s at the six-core default; three workers took 246s), but regressed the complete suite from 663.20s to 855.27s and reintroduced the skill-distribution setup timeout. The global cap was discarded; subset-only worker tuning does not generalize.
- The skill-distribution test cloned all 7,220 tracked repository files to inspect 122 tracked skill files. A sparse local clone preserves the tracked-only consumer view while cutting the targeted test from 23s to 11s.
- A later full run after the sparse-clone change took 882.53s but was invalid for comparison: another worktree launched a full Vitest integration run concurrently, driving six-core host load to ~18. It still covered all 2,129 tests with only the same baseline `migration-graph-dot` failure; use the uncontended 663.20s run as the retained full-suite result.
