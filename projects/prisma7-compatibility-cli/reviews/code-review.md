# Code review — `prisma7 compatibility CLI`

## Summary

- **Current verdict:** SATISFIED
- **Dispatches SATISFIED:** side-by-side-wrapper D1, D2, D3, D4, D5
- **AC scoreboard totals:** 1 PASS / 0 FAIL / 0 NOT VERIFIED
- **Open findings:** 0
- **Open escalations:** 0

## Acceptance criteria scoreboard

| AC ID | Description (short)                                                                               | Slice                  | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------- | ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | Packed `prisma7` exactly depends on and resolves matching Prisma while preserving ordinary Prisma | `side-by-side-wrapper` | PASS   | D1 commit `e86b01a84c`; D2 commit `f5531d98da`; D4 commit `0e44c96e11`; D5 R2 commit `11c3681f70` leaves one real-project E2E, and `PRISMA_SCHEMA_ENGINE_BINARY=$PWD/packages/engines/schema-engine-linux-arm64-openssl-3.0.x pnpm --filter prisma7 test` passed exactly 1 file / 1 test in 3.51s. The test typechecks `prisma7/config`, runs the built wrapper `--version` and `generate`, and executes the generated client against SQLite with all subprocess statuses asserted as zero. |

## Subagent IDs

- **Implementer:** `3bf8243c-3083-41c` — active from `side-by-side-wrapper` D5 R2. Replaced `3fb16907-052b-47b` after D5 R1; earlier replacements and model-tier corrections are recorded in prior round context.
- **Reviewer:** `b73fe522-ce47-4ac` — active from `side-by-side-wrapper` D5 R2. Replaced `c2a4ed9c-1afe-41a` after D5 R1; earlier replacements are recorded in prior round context.

## Orchestrator notes

- Linear synchronization was explicitly waived by the operator for this project.
- Drive trace emission is unavailable because the canonical emitter cannot resolve its `arktype` dependency; no hand-authored trace events will substitute for validated events.
- After D2, the operator authorized replacing marker/global-symbol identity transport with normalized `process.argv[1]` stem inference. The supporting package-manager probe and scope are recorded in `design-decisions.md`; D3 was reviewer-SATISFIED.
- After D3, the operator rejected the production-only `delegateToPrismaCli` test seam as unnecessary indirection. D4 inlined the dependency load and was independently SATISFIED.
- After D4, the operator rejected the remaining package/identity/dispatcher unit and contract coverage as overtesting. D5 must replace every test introduced by this slice with one real-project E2E covering `prisma7/config` import/typechecking/config selection, `prisma7 --version`, `prisma7 generate`, and successful generated-client execution.

## Findings log

### F1 — Identity initializer is tree-shaken from the built dispatcher

**Severity:** must-fix

**Where:** `packages/cli/src/bin-dispatcher.ts:3` and `packages/cli/package.json:206`

**What:** The dispatcher imports the identity module only to evaluate `void cliDistributionIdentity`, but the CLI package declares `sideEffects: false`. Rebuilding with `pnpm --filter prisma build` emits `packages/cli/build/index.js` without `__PRISMA_CLI_DISTRIBUTION` or any identity-module code, so the wrapper's marker is never consumed by either normal or completion dispatch.

**Why it matters:** The runnable wrapper currently delegates to an ordinary-identity CLI bundle; later identity propagation cannot distinguish `prisma7`, violating D1's private identity selection at the actual built entrypoint.

**Recommended next action:** Make the identity module a preserved side effect (or otherwise force its initialization in the dispatcher), rebuild the CLI, and add/adjust a build-level assertion or executable-focused test proving the emitted dispatcher initializes the marker before both branches.

**Status:** resolved (`e86b01a84c`)

### F2 — Real-project E2E has no verified no-network engine path

**Severity:** must-fix

**Where:** `packages/prisma7/src/e2e.test.ts:104-109,133`; `.github/actions/setup/action.yml:47-66`

**What:** The E2E invokes `prisma7 --version` and `generate`, both of which ensure the native schema engine. The checkout has no Linux schema-engine artifact or `PRISMA_SCHEMA_ENGINE_BINARY`; the only discovered cached binaries are macOS-only. CI restores a custom engine only when `engineHash` is nonempty, while the normal test workflow passes the optional input through without guaranteeing one. The reported local run therefore attempted an unavailable download, and there is no evidence supporting the assumption that ordinary CI will provide the engine.

**Why it matters:** The required single test is not a verified network-free gate, and AC-1 cannot be promoted from a prior unit/contract result after those tests were deleted. A green result that depends on an unprovisioned or network-fetched engine would not be defensible release evidence.

**Recommended next action:** Provide a compatible schema-engine artifact through the test environment before this package test runs (with an explicit, portable path for each supported runner), or otherwise make the existing CI setup guarantee that artifact without downloading from the test. Re-run the full `prisma7` test and record the successful version, generate, and SQLite execution output.

**Status:** resolved — the test contains no provisioning/download path; the operator provisioned the ignored supported `linux-arm64-openssl-3.0.x` artifact outside the test, and the full test passed with `PRISMA_SCHEMA_ENGINE_BINARY` set. Clean CI installs invoke `@prisma/engines` postinstall for the runner's standard artifact.

### F3 — Generated smoke program does not guarantee async failure propagation or disconnect

**Severity:** must-fix

**Where:** `packages/prisma7/src/e2e.test.ts:118-131`

**What:** The generated program calls `void main()`, and `$disconnect()` is reached only after all operations succeed. A rejected operation is neither explicitly awaited by the top-level program nor caught into an explicit nonzero exit, and a failure before disconnect skips cleanup.

**Why it matters:** The E2E can leave a live client/database handle and can report asynchronous failures through runtime-dependent unhandled-rejection behavior instead of a deterministic subprocess failure. That weakens the required proof of a working generated client and can make the matrix flaky.

**Recommended next action:** Run the smoke body inside `try/finally` with `await client.$disconnect()` in the finally block, and await/catch the top-level promise so every failure is propagated as a nonzero subprocess exit.

**Status:** resolved (`11c3681f70`) — the generated smoke program uses `try/finally` for `$disconnect()`, and catches the top-level promise while setting `process.exitCode = 1` and reporting the error.

### F4 — Package test hides build/dependency assumptions behind redundant workspace rebuilds

**Severity:** should-fix

**Where:** `packages/prisma7/package.json:57`; `packages/prisma7/src/e2e.test.ts:46,95,133`

**What:** The package `test` script rebuilds `prisma`, `@prisma/client`, the adapter, and `prisma7` immediately before Vitest, although the setup action's root `pnpm run build` already precedes both `prisma7` test-template entries. The new E2E also relies on the client and better-sqlite3 adapter as test-only workspace artifacts without declaring them in this package's manifest; the script's filter builds mask that dependency/setup requirement.

**Why it matters:** CI spends time rebuilding a large part of the monorepo and a package test run can appear self-contained while actually relying on undeclared sibling artifacts and root-hoisted tooling. This makes dependency/order failures harder to detect and weakens the stated portability of the E2E.

**Recommended next action:** Remove the redundant monorepo rebuilds from the package `test` script, and declare the test-only workspace packages (and any newly required direct tooling) explicitly or move their build/provisioning into the documented CI setup order. Verify the package test from the same clean built state used by CI.

**Status:** resolved (`11c3681f70`) — `test` is back to `vitest run`; required workspace fixture packages and `tsx` are declared, the lockfile is updated, and the fixture only creates/junction-links temporary project files without rebuilding or installing.

## Round notes

### side-by-side-wrapper D1 R1 — ANOTHER ROUND NEEDED

**Scope:** runnable identity-aware wrapper. Commit `5ae58ae55`.

**Tasks:** Wrapper delegation and focused unit coverage are clean; built identity initialization is regressed by tree-shaking.

**AC delta:** AC-1 remains NOT VERIFIED — D2 pending.

**Findings:** F1 (must-fix).

**For orchestrator:** The reported normal `--version` smoke limitation is not the blocker; the rebuilt dispatcher omission is concrete and addressable in this PR.

### side-by-side-wrapper D1 R2 — SATISFIED

**Scope:** runnable identity-aware wrapper. Commit `e86b01a84c`.

**Tasks:** Identity initialization, wrapper delegation, and focused coverage are clean.

**AC delta:** AC-1 remains NOT VERIFIED — D2 pending.

**Findings:** F1 resolved (`e86b01a84c`).

**For orchestrator:** Emitted build coverage passes for normal and completion branches; generated build directories remain ignored and uncommitted.

### side-by-side-wrapper D2 R1 — SATISFIED

**Scope:** forwarded package surfaces and packed resolution proof. Commit `f5531d98da`.

**Tasks:** Forwarded exports, exact packed dependency, package metadata/file list, side-by-side fixture, and D1 regression coverage are clean.

**AC delta:** AC-1 NOT VERIFIED → PASS (commits `e86b01a84c`, `f5531d98da`; tests in `packages/prisma7/src/package-contract.test.ts` and `packages/prisma7/src/delegate-to-prisma-cli.test.ts`).

**Findings:** none.

**For orchestrator:** none.

### side-by-side-wrapper D3 R1 — SATISFIED

**Scope:** executable-stem identity inference and distinctive wrapper target. Commit `43ad8a7891`.

**Tasks:** Exact POSIX/Windows stem selection, immutable identity, target/bin/export contract, argv delegation, and stale-transport cleanup are clean.

**AC delta:** AC-1 remains PASS; amended packed-wrapper condition is confirmed by `43ad8a7891` and `packages/prisma7/src/package-contract.test.ts` (7/7), with CLI identity/dispatcher coverage in `packages/cli/src/utils/cli-distribution-identity.vitest.ts` and `packages/cli/src/bin-dispatcher.vitest.ts` (12/12).

**Findings:** none.

**For orchestrator:** none.

### side-by-side-wrapper D4 R1 — SATISFIED

**Scope:** inline wrapper delegation. Commit `0e44c96e11`.

**Tasks:** Minimal direct delegation and packed executable evidence are clean.

**AC delta:** AC-1 remains PASS; built/packed wrapper execution, argv preservation, and exit propagation are confirmed by `0e44c96e11` and `packages/prisma7/src/package-contract.test.ts` (6/6).

**Findings:** none.

**For orchestrator:** none.

### side-by-side-wrapper D5 R1 — ANOTHER ROUND NEEDED

**Scope:** Consolidation on one real-project E2E. Commit `6d07265187`.

**Tasks:** Exactly one test declaration and the requested non-mock/non-contract shape are clean; executable engine setup, async client cleanup/propagation, and package test isolation are partial.

**AC delta:** AC-1 PASS → NOT VERIFIED — the replacement E2E did not pass locally and no ordinary CI engine provisioning evidence was found.

**Findings:** F2 (must-fix), F3 (must-fix), F4 (should-fix).

**For orchestrator:** Require the implementer to address F2-F4 and rerun the full package test with a recorded no-network engine path before reconsidering AC-1.

### side-by-side-wrapper D5 R2 — SATISFIED

**Scope:** D5 reliability follow-up over commits `6d07265187` and `11c3681f70`.

**Tasks:** The branch now leaves exactly one added test file, `packages/prisma7/src/e2e.test.ts`; removed unit/contract/identity/mocks/network/install/tar/source checks are absent. The single test has three substantive outcomes: `tsc --noEmit` validates a `prisma7/config` consumer, the built wrapper executes `--version`, and the built wrapper runs `generate` followed by generated-client SQLite create/read execution. The operator ran the supported engine postinstall/download outside the test, then ran the full package command with `PRISMA_SCHEMA_ENGINE_BINARY`; Vitest reported exactly 1 file / 1 test passed in 3.51s. `try/finally` plus caught rejection/nonzero exit makes smoke cleanup and failure propagation deterministic. R2 restores the minimal `vitest run` script, declares the direct workspace/tooling dependencies and lockfile entries, and links only the packages needed by the temporary project. Junction links, `process.execPath` spawning, config-relative SQLite, and temporary-directory cleanup are portable across the Windows/macOS job shape; the synchronous test body has no hidden async timeout path, and the observed test execution remains below Vitest's default timeout.

**AC delta:** AC-1 NOT VERIFIED → PASS — real built local artifacts executed successfully with the supported engine artifact supplied before the test; prior exact dependency/packed-wrapper evidence remains from D1/D2/D4.

**Findings:** F2, F3, and F4 resolved. No new findings.

**Verification:** `pnpm --filter prisma7 tsc`, Prettier check, ESLint, `git diff --check`, and the full `PRISMA_SCHEMA_ENGINE_BINARY=... pnpm --filter prisma7 test` command passed. The mandatory transient-ID scan over the product, test, and planning surfaces found no UUID/agent/subagent identifiers.
