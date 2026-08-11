# Code review — `prisma7 compatibility CLI`

## Summary

- **Current verdict:** SATISFIED
- **Dispatches SATISFIED:** side-by-side-wrapper D1, D2, D3, D4, D5, D6, D7; cli-owned-distribution-identity D1, D2, D3, D4
- **AC scoreboard totals:** 33 PASS / 0 FAIL / 0 NOT VERIFIED
- **Open findings:** 0
- **Open escalations:** 0

## D6 R1 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                                             | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6-AC1 | The sole compatibility scenario is auto-discovered by the existing client Docker E2E harness.                                                   | PASS   | `packages/client/tests/e2e/_utils/run.ts` globs every `_steps.ts`; `prisma7-compatibility/_steps.ts` is the only scenario for this fixture. The focused command `pnpm --filter @prisma/client test:e2e --verbose --runInBand prisma7-compatibility` completed with `All 1/1 tests passed`.                                                                                                                     |
| D6-AC2 | Installation uses packed artifacts, not host workspace links.                                                                                   | PASS   | The focused runner packed the workspace and mounted `/tmp/prisma-0.0.0.tgz` and `/tmp/prisma7-0.0.0.tgz` into Docker. The fixture manifest points every workspace dependency at `/tmp/*.tgz`; the Docker log shows installation under `/test/prisma7-compatibility`.                                                                                                                                           |
| D6-AC3 | Unscoped `prisma7` packing and dependency rewriting/mounting preserve the existing runner behavior.                                             | PASS   | `localPackageNames` includes `prisma7`; `packages/prisma7/package.json` declares only `prisma` as its Prisma dependency; the committed fixture lockfile resolves `prisma7` to `prisma: file:../../tmp/prisma-0.0.0.tgz`; and the emitted Docker command contains one mount for each of `/tmp/prisma-0.0.0.tgz` and `/tmp/prisma7-0.0.0.tgz`, with no duplicate `prisma7` volume.                               |
| D6-AC4 | The E2E proves config import/typechecking and selection, `prisma7 --version`, generation, custom output, and a working generated SQLite client. | PASS   | `config-consumer.ts` imports and type-checks `prisma7/config`; the config selects `project-models/non-default.prisma`, with no fallback `prisma/schema.prisma`; logs show that schema path, successful `pnpm exec prisma7 --version`, and generation to `generated/compatibility-client`; `smoke.ts` performs SQLite create/read assertions, catches failures with nonzero exit, and disconnects in `finally`. |
| D6-AC5 | Exactly one compatibility E2E remains; package-local Vitest coverage, test job, and D5-only dependencies are removed.                           | PASS   | `packages/prisma7/src/e2e.test.ts` is deleted, `packages/prisma7/package.json` has no test script or D5-only test dependencies, both standalone workflow entries are gone, and the compatibility fixture contains one `_steps.ts`.                                                                                                                                                                             |
| D6-AC6 | Fixture dependencies are minimal, lockfile-pinned, and do not add test-time network installation beyond the standard harness install.           | PASS   | The fixture manifest contains only the packed client/adapter/wrapper runtime edges plus the required compiler/type packages; its committed `pnpm-lock.yaml` pins the resolved graph. Test code performs no package installation or network fetch; only the standard `pnpm install` runs against the harness's mounted tarballs/store.                                                                          |
| D6-AC7 | Portability and timeout behavior match client E2E conventions.                                                                                  | PASS   | The fixture uses the existing Node 22/pnpm 10 Docker image, global `tsx`, SQLite, `executeSteps` cleanup, and the runner's Linux `:z` mounts. The focused Docker run passed 1/1 without a custom timeout path.                                                                                                                                                                                                 |
| D6-AC8 | The mandatory transient-ID scan is clean.                                                                                                       | PASS   | The repository scan over the changed product, test, planning, runner, workflow, and review-input surfaces found no UUID or agent/subagent identifier.                                                                                                                                                                                                                                                          |

The slice intentionally leaves exhaustive identity branding and update-prompt suppression to `identity-complete-prisma7`, as recorded in the slice spec; D6 verifies invocation and generation, not those later-slice behaviors.

## cli-owned-distribution-identity D1 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                               | Status | Evidence                                                                                                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1-AC1 | Top-level and CLI-owned help/examples render the selected executable, including delegated, unknown-command, and error help paths. | PASS   | `c944253750`; `packages/cli/src/__tests__/distribution-identity-help.test.ts` covers top-level CLI help, delegated `validate --help`, `lift` rename guidance, per-command help/examples, unknown-command paths, and help-error wrappers for both identities.                                   |
| D1-AC2 | Ordinary `prisma` help remains unchanged and focused tests cover both identities non-tautologically.                              | PASS   | `c944253750`; the new suite runs the same assertions under both `'prisma'` and `'prisma7'` via `describe.each(...)` and uses `not.toContain(...)` checks against the opposite identity, while constructors/defaults still fall back to `'prisma'` in `CLI.ts` and the touched command classes. |
| D1-AC3 | Identity stays the minimal `'prisma' \| 'prisma7'` seam with no object/map/global/env framework or lower-package spillover.       | PASS   | `c944253750`; `packages/cli/src/bin.ts` resolves one primitive via `getCliDistributionIdentity()` and threads it into CLI-owned constructors, while the diff stays inside `packages/cli/src/**` plus the focused test file.                                                                    |
| D1-AC4 | Remaining actionable CLI literals are surfaced/classified; no D1 help literal silently remains in the changed CLI-owned surfaces. | PASS   | `c944253750`; targeted literal checks over the touched files leave the remaining executable-specific runtime strings in `packages/cli/src/Init.ts` and `packages/cli/src/bootstrap/Bootstrap.ts` project-creation flows, while the D1 help renderers are parameterized.                        |
| D1-AC5 | Reported gates are defensible and the mandatory transient-ID scan is clean.                                                       | PASS   | No on-disk evidence contradicts the reported focused `prisma` CLI tests / `pnpm --filter prisma tsc` / Prettier / diff-check gates for `c944253750`; the mandatory transient-ID scan over `c944253750^..c944253750` produced zero token or `projects/prisma7-compatibility-cli/` hits.         |

## cli-owned-distribution-identity D2 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                                    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2-AC1 | `prisma7 init` generates `prisma7/config`, while ordinary init remains `prisma/config` without unrelated ordinary-init snapshot churn. | PASS   | `f18a6738d5`; `packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts` asserts exact generated `prisma.config.ts` content for both identities, and `packages/cli/src/__tests__/Init.vitest.ts` still pins ordinary Prisma inline snapshots to `import { defineConfig } from "prisma/config"`.                                                                             |
| D2-AC2 | Project-creation guidance uses the selected identity while stable domain paths/packages remain unchanged.                              | PASS   | `c526edd56d`; `packages/cli/src/Init.ts` now threads identity into `defaultEnv()` and the appended `.env` banner, so compatibility init emits `${identity} dev` / `${identity} init` while domain-stable paths and packages remain unchanged. Focused dual-identity coverage for both comment surfaces lives in `packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts`. |
| D2-AC3 | Tests are focused, non-tautological, and cover both identities without broad snapshot duplication.                                     | PASS   | `f18a6738d5`; the new suite adds ten focused dual-identity assertions across Init/Bootstrap/Link outputs in `packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts`, reuses shared mocks, and avoids broad snapshot cloning of the existing ordinary-identity suites.                                                                                                    |
| D2-AC4 | Identity remains the minimal primitive seam with no object/map/global/env framework or out-of-scope package change.                    | PASS   | `f18a6738d5`; the implementation continues to thread the existing `'prisma' \| 'prisma7'` primitive through CLI-owned renderers only. The product diff stays in `packages/cli/src/**` plus the focused test file, with no new lower-package identity framework or package-surface churn.                                                                                                       |
| D2-AC5 | Reported gates are defensible and the mandatory transient-ID scan is clean.                                                            | PASS   | No on-disk evidence contradicts the reported `pnpm --filter prisma tsc`, focused project-creation Vitest suite, changed-file Prettier, diff-check, and transient-ID scan gates for `c526edd56d`. The mandatory reviewer rerun over `f18a6738d5..c526edd56d` produced zero plan-ID and `projects/prisma7-compatibility-cli/` hits in the round's added source/test diff.                        |

## cli-owned-distribution-identity D3 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                             | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3-AC1 | Text and JSON version output use the selected distribution label while ordinary `prisma` output remains unchanged.              | PASS   | `648c07ff6a`; `packages/cli/src/Version.ts` now renders `[this.identity, packageJson.version]` while leaving the rest of the table untouched. `packages/cli/src/__tests__/distribution-identity-version-mismatch.vitest.ts` exercises both identities and asserts the text table plus JSON key switch between `prisma` and `prisma7` without disturbing `@prisma/client`.                                                                                                                                                                                                                                                                                                                                   |
| D3-AC2 | Mismatch lookup, labels, and the recommended command use the selected distribution while preserving `@prisma/client` semantics. | PASS   | `648c07ff6a`; `packages/cli/src/utils/global-local-version-mismatch.ts` now compares local `[identity, '@prisma/client']`, formats `${identity}@${globalVersion}`, and recommends `npx ${identity} generate`; `packages/cli/src/Generate.ts` forwards the selected identity into that helper. The packed compatibility fixture lockfile at `packages/client/tests/e2e/prisma7-compatibility/pnpm-lock.yaml` still records `prisma7` resolving its nested exact `prisma` tarball, so intentionally ignoring the project's direct `prisma` package is correct for side-by-side wrapper topology.                                                                                                              |
| D3-AC3 | Tests are focused, non-tautological, and behavior is not weakened.                                                              | PASS   | `648c07ff6a`; the new Vitest file adds six dual-identity assertions across version text, version JSON, mismatch lookup, negative opposite-identity checks, and Generate plumbing without cloning broad snapshots. Reviewer reran `src/__tests__/distribution-identity-version-mismatch.vitest.ts` (6/6 passed) and `src/__tests__/globalLocalVersionMismatch.test.ts` (9/9 passed).                                                                                                                                                                                                                                                                                                                         |
| D3-AC4 | The change preserves the minimal seam, layering, and dispatch scope.                                                            | PASS   | `648c07ff6a`; the product diff stays inside `packages/cli/src/Version.ts`, `packages/cli/src/Generate.ts`, and `packages/cli/src/utils/global-local-version-mismatch.ts`, plus one focused test file. The only new seam is an optional existing-helper `identity?: CliDistributionIdentity` parameter; no lower-package changes, identity framework, or wider refactor was introduced.                                                                                                                                                                                                                                                                                                                      |
| D3-AC5 | Formal gates are defensible, exploratory failures are honestly classified, and the mandatory transient-ID scan is clean.        | PASS   | Reviewer reran `pnpm --filter prisma tsc`, `pnpm exec vitest run src/__tests__/distribution-identity-version-mismatch.vitest.ts`, `pnpm exec jest --silent --runInBand src/__tests__/globalLocalVersionMismatch.test.ts`, and `git diff --check`; all passed. The mandatory transient scan over the D3 product/test diff was clean. A targeted rerun of the older Jest `src/__tests__/commands/Version.test.ts` failed before assertions on this NixOS shell because engine resolution fell into existing libssl/checksum download warnings and a `linux-nixos/schema-engine.sha256` 404, which matches the implementer's exploratory-only classification rather than a regression introduced by this diff. |

## cli-owned-distribution-identity D4 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                 | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D4-AC1 | Fish, Bash, Zsh, and PowerShell setup scripts register and reinvoke the selected executable.                        | PASS   | `5ad733ced7`; `packages/cli/src/completions/Completions.ts` now calls `t.setup(identity, identity, firstArg)`, so both the registered command target and reinvocation path follow the selected primitive. `packages/cli/src/completions/completion-command.test.ts` asserts `${identity} complete` plus shell-specific registration patterns for fish, bash, zsh, and powershell under both `prisma` and `prisma7`.                                                                                                   |
| D4-AC2 | CLI parsing/setup threads the primitive identity into completions while ordinary Prisma keeps the default behavior. | PASS   | `5ad733ced7`; `packages/cli/src/bin.ts` now constructs `Completions.new(identity)`, and `packages/cli/src/completions/Completions.ts` stores that primitive and forwards it into `parseCompletionCommand(argv, this.identity)`. The constructor and parser both default to `'prisma'`, so ordinary invocation keeps the prior default path while compatibility invocation now receives the selected identity explicitly.                                                                                              |
| D4-AC3 | The separately bundled completion entry resolves identity independently with no mutable cross-bundle transport.     | PASS   | `5ad733ced7`; `packages/cli/src/completions/completion-entry.ts` now passes `getCliDistributionIdentity()` directly into `parseCompletionCommand(...)`, and `parseCompletionCommand` also defaults from the same executable-derived helper. No environment marker, global, or other mutable transport was introduced. The focused test mutates only `process.argv[1]` and verifies the completion bundle emits `prisma7` independently.                                                                               |
| D4-AC4 | Ordinary output stays unchanged and the added coverage is focused and proportionate.                                | PASS   | `5ad733ced7`; the pre-existing completion descriptor catalog in `packages/cli/src/completions/completion-definitions.ts` is untouched, and `completion-command.test.ts` still preserves the existing ordinary fish script assertion (`prisma complete -- ...`, `complete -c prisma`) alongside the unchanged top-level, nested-command, and option-value completion checks. The new coverage stays narrowly on shell setup, constructor forwarding, and separate-bundle inference without broad snapshot duplication. |
| D4-AC5 | Reported gates are defensible and the mandatory transient-ID scan is clean.                                         | PASS   | The product diff is confined to `packages/cli/src/bin.ts` and `packages/cli/src/completions/**`. Reviewer reran `git diff --check 5ad733ced7^ 5ad733ced7`, which passed, and the mandatory transient-ID scan over the four touched files found no UUID, agent, subagent, session, or `projects/prisma7-compatibility-cli/` hits. No on-disk evidence contradicts the reported `pnpm --filter prisma tsc`, focused package runner with cached engine, Prettier, diff-check, and transient scan gates for `5ad733ced7`. |

## Subagent IDs

- **Implementer:** `becc7679-cf83-4ce` — persistent Pi implementer established at `cli-owned-distribution-identity` D2 R1 after prior Cursor and foreground Pi sessions became inaccessible.
- **Reviewer:** `dfe5af26-1b23-4fe` — replacement Pi reviewer established at `cli-owned-distribution-identity` D4 R1 after D3 reviewer `16ecb380-aabb-471` became inaccessible to resume.

## Orchestrator notes

- Linear synchronization was explicitly waived by the operator for this project.
- Drive trace emission is unavailable because the canonical emitter cannot resolve its `arktype` dependency; no hand-authored trace events will substitute for validated events.
- Before implementation resumed, the planned `identity-complete-prisma7` slice failed slice-Small during grounded planning and was split into `cli-owned-distribution-identity` followed by `downstream-actionable-guidance`; release work remains last.
- D1 required two replacement implementer sessions because foreground Pi agent handles were unavailable for resume. Validation was initially blocked by missing build tools; the operator authorized using the full Nix shell, and Nix-provided GNU Make plus GCC restored the formal gates without changing Node.
- After D2, the operator authorized replacing marker/global-symbol identity transport with normalized `process.argv[1]` stem inference. The supporting package-manager probe and scope are recorded in `design-decisions.md`; D3 was reviewer-SATISFIED.
- After D3, the operator rejected the production-only `delegateToPrismaCli` test seam as unnecessary indirection. D4 inlined the dependency load and was independently SATISFIED.
- After D4, the operator rejected the remaining package/identity/dispatcher unit and contract coverage as overtesting. D5 consolidated them to one scenario covering `prisma7/config` import/typechecking/config selection, `prisma7 --version`, `prisma7 generate`, and successful generated-client execution.
- After D5, the operator correctly rejected the package-local Vitest subprocess scenario as not using Prisma's E2E harness. D6 moved the scenario under `packages/client/tests/e2e`, installed packed tarballs in the standard Docker fixture, and removed the prisma7 package-level test job and test-only dependencies.
- D7 addresses current PR feedback only: simplify identity to `'prisma' | 'prisma7'`, use `prisma7 db push` instead of raw DDL in E2E, and guard chmod after esbuild errors. The `prepack` suggestion was rejected by the operator because root build precedes E2E packing; comments on deleted tests are obsolete.

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

### F5 — Generated `.env` guidance still hardcodes `prisma` under `prisma7 init`

**Severity:** must-fix

**Where:** `packages/cli/src/Init.ts:151,625`

**What:** `defaultEnv()` still emits the local Prisma Postgres comment with `prisma dev` and the append-to-existing-`.env` marker `# This was inserted by \`prisma init\`:`regardless of the selected distribution. A`prisma7 init`invocation therefore leaves generated`.env`guidance with ordinary-Prisma command names even though the same round updated the surrounding config and next-step output to`prisma7`.

**Why it matters:** This slice's contract is that actionable CLI-owned distribution references follow the selected identity while stable domain paths remain unchanged. Leaving `prisma7 init` to generate `.env` comments that tell the user to run `prisma dev` or attribute edits to `prisma init` breaks that identity consistency in a project-creation surface the user is expected to read.

**Recommended next action:** Thread the primitive identity into `.env` comment generation so compatibility init emits `prisma7 dev` and `prisma7 init` while ordinary Prisma output stays byte-for-byte stable, and add focused coverage for the default local-Postgres init path plus the existing-`.env` append path.

**Status:** resolved (`c526edd56d`) — `defaultEnv()` now accepts the primitive identity, local Prisma Postgres `.env` comments render `${identity} dev`, the appended banner renders `${identity} init`, and `packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts` covers both identities for both comment surfaces.

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

### side-by-side-wrapper D6 R1 — SATISFIED

**Scope:** move the sole compatibility scenario into the client E2E harness. Commit `ce505fa9ad`.

**Tasks:** The scenario is auto-discovered from `packages/client/tests/e2e`, runs in the standard Docker image, and installs packed tarballs mounted by the existing runner. The runner now rewrites unscoped `prisma7` dependencies and mounts its unscoped tarball separately from the hardcoded `prisma` tarball. The fixture proves `prisma7/config` typechecking and config selection, version execution, generation into a non-default output, and SQLite create/read execution with deterministic failure propagation and disconnect cleanup. The package-local Vitest test, its test-only dependencies/script, and both standalone workflow entries are removed.

**AC delta:** D6-AC1 through D6-AC8 all PASS. The focused standard harness command passed exactly 1/1; logs confirm the non-default schema, `pnpm exec prisma7 --version`, generation to `generated/compatibility-client`, generated-client typechecking, and SQLite smoke execution. The fixture lockfile records the nested declared edge from packed `prisma7` to `/tmp/prisma-0.0.0.tgz`.

**Findings:** none.

**Verification:** `pnpm --filter @prisma/client test:e2e --verbose --runInBand prisma7-compatibility` passed. `git diff --check` passed. The mandatory transient-ID scan over the changed product, test, planning, runner, workflow, and review-input surfaces found no UUID or agent/subagent identifiers. No product, test, planning, or workflow files were edited during review; only this review artifact and the reviewer heartbeat were written.

### side-by-side-wrapper D7 R1 — SATISFIED

**Scope:** address current PR #29949 feedback in `f2933682d7 fix(prisma7): address compatibility CLI review feedback`.

| AC ID  | Description                                                                                                                         | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7-AC1 | Identity is a minimal stable `'prisma' \| 'prisma7'` seam with exact POSIX/Windows stem normalization and ordinary-Prisma fallback. | PASS   | `packages/cli/src/utils/cli-distribution-identity.ts` exports only the literal union and returns `prisma7` only for the normalized executable stem `prisma7`; backslashes are normalized before `path.posix.parse`, and undefined/other stems return `prisma`. Direct source assertions covered POSIX shim/target paths, Windows target paths, ordinary Prisma, and undefined fallback. No identity object, map, marker, global, or cast remains.                                                                                                                                                                                                                    |
| D7-AC2 | The client E2E prepares and exercises the configured database through the compatibility CLI without raw DDL.                        | PASS   | `_steps.ts` runs `pnpm exec prisma7 --version`, `pnpm exec prisma7 generate`, then `pnpm exec prisma7 db push --force-reset` against the same `prisma.config.ts`. `smoke.ts` creates a record, reads it back by `createdNote.id`, catches failures into a nonzero exit, and disconnects in `finally`. The exact Docker log confirms config selection, non-default schema, generation, db push, and smoke completion.                                                                                                                                                                                                                                                 |
| D7-AC3 | Failed wrapper builds do not mask esbuild errors, while successful builds retain executable permissions.                            | PASS   | `packages/prisma7/helpers/build.ts` returns before `statSync`/`chmodSync` when `result.errors.length > 0`; the successful `prisma7` build completed and `build/prisma7.js` was mode `755`/executable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D7-AC4 | Reported verification gates are reproducible and defensible.                                                                        | PASS   | `pnpm --filter prisma tsc`, `pnpm --filter prisma7 tsc`, sequential Prisma/Prisma7 builds, and the exact `pnpm --filter @prisma/client test:e2e --verbose --runInBand prisma7-compatibility` command passed; Docker reported `All 1/1 tests passed`. Root `pnpm lint` passed with repository warnings and no errors, `pnpm prettier-check` passed, targeted Prettier passed, and `git diff --check` passed.                                                                                                                                                                                                                                                          |
| D7-AC5 | All current PR feedback is accounted for and the mandatory transient-ID scan is clean.                                              | PASS   | Identity-map and E2E comments are addressed. The cast/global comment is obsolete after the identity rewrite; forwarding-surface, package-contract, and package-local E2E-timeout comments target files deleted by D6; `prepack` is explicitly rejected because the private package is built before standard E2E packing, and CodeRabbit withdrew that finding. `gh api repos/prisma/prisma/pulls/29949/comments --paginate` showed no newer actionable thread after the withdrawn prepack reply (latest comment: 2026-08-10T14:17:59Z). The scan over changed product/test/planning/runner/workflow surfaces found no UUID, agent, subagent, or session identifiers. |

**Findings:** none. All current human and CodeRabbit feedback is addressed, obsolete, withdrawn, or explicitly rejected; no further action is required for D7 R1.

**Verification notes:** Product/tests/planning remain unedited during review. Only this ledger and `wip/heartbeats/reviewer.txt` were written. The E2E generated ignored logs/artifacts and a lockfile refresh during execution; generated artifacts were cleaned and the tracked lockfile was restored before this verdict.

### cli-owned-distribution-identity D1 R1 — SATISFIED

**Scope:** Dispatch 1 identity-aware CLI help. Commit `c944253750`; planning-only context `284f3496d7`, `e8e778161b`.

**Tasks:** Top-level/delegated/error help identity flow, constructor/default plumbing, and focused dual-identity coverage are clean. Remaining executable-specific literals observed in the touched files stay confined to Init/Bootstrap project-creation output for later dispatches.

**AC delta:** D1-AC1 through D1-AC5 PASS (commit `c944253750`, test `packages/cli/src/__tests__/distribution-identity-help.test.ts`; transient-ID scan clean).

**Findings:** none.

**For orchestrator:** none.

### cli-owned-distribution-identity D2 R1 — ANOTHER ROUND NEEDED

**Scope:** Dispatch 2 identity-correct project creation. Commit `f18a6738d5`.

**Tasks:** Config import generation, bootstrap/link/postgres next-step guidance, and selected-package dependency detection are clean; generated `.env` command comments still hardcode ordinary Prisma under `prisma7 init`.

**AC delta:** D2-AC1, D2-AC3, D2-AC4, and D2-AC5 PASS (commit `f18a6738d5`, test `packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts`). D2-AC2 FAIL on `packages/cli/src/Init.ts:151,625` (see F5).

**Findings:** F5 (must-fix).

**For orchestrator:** The new 331-line focused suite is proportionate: it reuses shared mocks, covers distinct Init/Bootstrap/Link identity surfaces, and avoids cloning the broad ordinary-identity snapshots. `node_modules/<identity>` is the correct bootstrap dependency invariant because generated `prisma.config.ts` imports and re-run guidance depend on the selected distribution package, not the nested implementation package.

### cli-owned-distribution-identity D2 R2 — SATISFIED

**Scope:** F5 follow-up. Commit `c526edd56d`.

**Tasks:** Generated `.env` local-dev comments and inserted banner now follow the selected identity; focused dual-identity coverage widened cleanly.

**AC delta:** D2-AC2 FAIL → PASS (commit `c526edd56d`, test `packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts`). F5 resolved (`c526edd56d`).

**Findings:** none.

**For orchestrator:** Root Prettier remains blocked only by this review ledger's uncommitted edits; format/commit the ledger after verdict.

### cli-owned-distribution-identity D3 R1 — SATISFIED

**Scope:** version output and global/local mismatch identity. Commit `648c07ff6a`.

**Tasks:** `Version` now labels the first row with the selected distribution, mismatch lookup/labels/recommendation use the selected identity, and `Generate` forwards that identity into the mismatch helper. The focused dual-identity Vitest is proportionate and exercises positive plus negative cases for both `prisma` and `prisma7`.

**AC delta:** D3-AC1 through D3-AC5 PASS (commit `648c07ff6a`, tests `packages/cli/src/__tests__/distribution-identity-version-mismatch.vitest.ts` and `packages/cli/src/__tests__/globalLocalVersionMismatch.test.ts`; transient scan clean).

**Findings:** none.

**For orchestrator:** Reviewer reran the old Jest `packages/cli/src/__tests__/commands/Version.test.ts` only as exploratory evidence; it failed before assertions on this NixOS shell with existing libssl/checksum download warnings and a `linux-nixos/schema-engine.sha256` 404, so that failure remains environment-only noise rather than an in-PR regression.

### cli-owned-distribution-identity D4 R1 — SATISFIED

**Scope:** completion identity. Commit `5ad733ced7`.

**Tasks:** Completion setup now uses the selected executable for fish/bash/zsh/powershell registration and reinvocation, CLI construction forwards the primitive identity into `Completions`, and the separately bundled completion entry resolves executable identity independently without reintroducing mutable transport.

**AC delta:** D4-AC1 through D4-AC5 PASS (commit `5ad733ced7`, test `packages/cli/src/completions/completion-command.test.ts`; transient scan clean).

**Findings:** none.

**For orchestrator:** No addressable review findings remain for D4 R1.
