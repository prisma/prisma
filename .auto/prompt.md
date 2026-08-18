# Autoresearch: integration test suite speed

## Objective
Reduce the wall-clock runtime of Prisma Next's complete integration test suite while preserving its behavior, coverage, reliability, and isolation. Optimize the test harness and fixtures rather than weakening or skipping tests. The measured workload starts from an already-built workspace because integration tests consume package `dist` output and repeated local/CI test runs should isolate suite execution from compilation.

## Metrics
- **Primary**: `integration_seconds` (seconds, lower is better) — wall-clock time for `pnpm --filter integration-tests test`
- **Secondary**: `test_files`, `tests` — passed Vitest file/test counts, monitored to prevent accidental test exclusion

## How to Run
`./.auto/measure.sh` — runs the full integration suite and outputs `METRIC name=number` lines.

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
- Initial hypothesis: repeated per-file PGlite/Mongo startup and conservative Vitest worker scheduling dominate runtime. Establish a full-suite baseline and inspect Vitest per-file durations before changing code.
