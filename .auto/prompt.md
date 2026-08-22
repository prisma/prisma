# Autoresearch: speed up the Test CI job

## Objective

Reduce the wall-clock duration of the `Test` job in `.github/workflows/ci.yml` on GitHub-hosted CI. The job must continue to execute all existing package tests with coverage and enforce per-package coverage, execute all example tests, use the required Postgres services, and check that the working tree stays clean. Optimize real CI behavior rather than local timings.

## Metrics

- **Primary**: `ci_test_seconds` (seconds, lower is better) — GitHub's elapsed time from the `Test` job's `startedAt` through `completedAt`.
- **Secondary**: `packages_coverage_seconds`, `examples_seconds`, `startup_seconds`, and `ci_run_id` — phase timing and traceability. The package-coverage phase is the dominant cost, but the primary metric remains the complete job.

## How to Run

`./.auto/measure.sh` commits and pushes the current experiment to the temporary draft PR, waits for that exact SHA's `CI (PR)` run and `Test` job, and emits `METRIC name=value` lines from GitHub timestamps. This intentionally measures hosted CI, not the local machine.

## Files in Scope

- `vitest.config.ts` — root Vitest project orchestration, worker count, pool behavior, and coverage settings.
- `.github/workflows/ci.yml` — `Test` job structure and safe parallelization of independent phases.
- `package.json` — package test/coverage commands.
- `scripts/coverage-config.ts`, `scripts/coverage-report.mjs`, and their tests — coverage collection/reporting if profiling proves they matter.
- Package Vitest configs and test-support code only when a general, behavior-preserving infrastructure optimization requires them.
- `.auto/*` — temporary experiment harness and findings; never part of the final product change.

## Off Limits

- Do not remove, skip, narrow, or weaken tests, source coverage collection, coverage thresholds, coverage reporting, database-backed behavior, or clean-tree verification.
- Do not classify executable/test-affecting changes as inert.
- Do not optimize only for the temporary PR or GitHub cache state.
- Do not modify production behavior merely to make tests faster.
- Do not use local elapsed time as the primary metric.

## Constraints

- Preserve the semantics and pass/fail guarantees of the current `Test` job.
- Every experiment runs on a real GitHub-hosted runner through a temporary draft PR.
- Treat CI timing as noisy. Historical successful runs on the predecessor PR ranged from 723 to 854 seconds, with package coverage taking 549 to 650 seconds. Prefer substantial, repeatable improvements and confirm promising results.
- The runner must remain stable: no dropped Postgres sockets, PGlite timeouts, flaky tests, or resource exhaustion.
- Follow repository rules: use pnpm, do not weaken lint/type safety, and keep tests current when changing behavior.
- Do not overfit or cheat the benchmark.

## What's Been Tried

- Before this session, package unit tests and package coverage were combined into one coverage-enabled Vitest pass, eliminating duplicate execution. That landed in PR #30082 and is the current baseline.
- The root config currently caps CI workers at 50% to avoid oversubscribing PGlite-heavy suites and the Postgres service. Worker-count experiments are promising but must prove stability.
- Historical predecessor-PR `Test` job durations were 723s, 799s, 828s, and 854s. Package coverage dominated at 549s, 608s, 612s, and 650s; example tests took 110–143s.
- Increasing serial package coverage from 50% to 75% workers produced successful 773s and 787s jobs, but a repeat ended with a language-server teardown rejection after every test passed. This was not a database failure, but the configuration needs caution.
- Running package coverage and examples concurrently looked fast but was rejected after a real `ECONNRESET`/non-queryable Postgres failure. Do not retry workload overlap.
- Full worker reuse (`isolate: false`) passed at 50% and 75%, but it is too broad: Supabase's config explicitly requires per-file isolation to prevent pg mocks leaking into integration files. Consider only targeted reuse in proven stateless projects.
- Hosted-runner timing has large outliers. Compare repeated medians and stability rather than trusting minima; a 548s overlap run was followed by 739s and 735s unchanged runs.
- Selected candidate: CI uses `pool: 'vmThreads'` with `maxWorkers: '100%'`. VM contexts preserve file-level isolation while reusable threads avoid fork churn; Supabase retains its explicit `pool: 'forks'` and one-worker override. Three initial all-core VM runs passed at 741s, 761s, and 752s (median 752s), versus a 767s median at 75% and 814s at 50%. Later exact-final runs passed at 704s, 770s, 782s, and 749s across varying runner load.
- The language-server test harness had an existing intermittent teardown rejection across multiple pools. Normal teardown now awaits the standard LSP ShutdownRequest before disposal, while immediate disposal tests keep their old path. Three post-fix all-core jobs passed, followed by a 704s favorable-runner result.
- JSON-only coverage output showed no measurable phase-tail saving, so the text reporter was restored. Deferring Cloudflare Postgres startup did not improve coverage, so the original workflow order was restored. Five workers produced fast points but failed a legitimate 200ms test on the third sample, so do not oversubscribe. Plain threads had a 764s three-sample median versus 752s for VM threads. The intended product diff is limited to `vitest.config.ts` and language-server harness tests.
