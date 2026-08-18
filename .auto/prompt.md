# Autoresearch: integration test suite speed

## Objective
Reduce the wall-clock runtime of Prisma Next's complete integration test suite while preserving its behavior, coverage, reliability, and isolation. Optimize the test harness and fixtures rather than weakening or skipping tests. The measured workload starts from an already-built workspace because integration tests consume package `dist` output and repeated local/CI test runs should isolate suite execution from compilation.

## Metrics
- **Primary**: `integration_seconds` (seconds, lower is better) — wall-clock time for `pnpm --filter integration-tests test`
- **Secondary**: `test_files`, `tests` — passed Vitest file/test counts, monitored to prevent accidental test exclusion

## How to Run
`./.auto/measure.sh` — runs the full integration suite with the CI timeout multiplier and outputs `METRIC name=number` lines.

Before the first measurement or after changing production package source, run `pnpm build` so integration tests exercise current `dist` artifacts.

## Files in Scope
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
