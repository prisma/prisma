# Code review — `prisma7 compatibility CLI`

## Summary

- **Current verdict:** SATISFIED
- **Dispatches SATISFIED:** side-by-side-wrapper D1, D2, D3, D4, D5, D6, D7; cli-owned-distribution-identity D1, D2, D3, D4, D5, D6, D7, D8, D9
- **AC scoreboard totals:** 60 PASS / 0 FAIL / 0 NOT VERIFIED
- **Open findings:** 0
- **Open escalations:** 0

## cli-owned-distribution-identity D9 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                         | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D9-AC1 | Exact CI `prisma7` import-resolution failure is fixed with source root/subpath aliases and no typecheck weakening.          | PASS   | `8ca24fe182`; `tsconfig.build.bundle.json` now maps `prisma` to `packages/cli/src/types`, `prisma/*` to `packages/cli/src/*`, `prisma7` to `packages/prisma7/src/index`, and `prisma7/*` to `packages/prisma7/src/*`. That matches the package export shapes used by `packages/prisma7/src/index.ts` (`from 'prisma'`) and `packages/prisma7/src/config.ts` (`from 'prisma/config'`) instead of the prior package-root-to-directory alias that broke exact workspace typecheck resolution. The change is scoped to path targets only; no compiler strictness or include/exclude surface is relaxed.             |
| D9-AC2 | Generated package forwarding artifacts are ignored consistently while root lint/Prettier stay green with artifacts present. | PASS   | `.prettierignore` and `eslint.config.cjs` now ignore `packages/prisma7/{index,config}.{js,d.ts}`, mirroring the existing `packages/cli/config.{js,d.ts}` treatment for generated forwarding artifacts. The ignore additions are limited to those generated Prisma7 root/config files; they do not widen to `packages/prisma7/build/**` or source files.                                                                                                                                                                                                                                                         |
| D9-AC3 | Bootstrap resolves the selected local CLI binary and preserves existing behavior.                                           | PASS   | `packages/cli/src/bootstrap/Bootstrap.ts` changes only the local-bin lookup from hardcoded `.bin/prisma` to `.bin/${identity}` and threads `this.identity` into that lookup; migrate/generate shell-out conditions, subprocess env, cwd, stdio, and in-process fallback logic are otherwise unchanged. This directly addresses the `prisma7 bootstrap` bug where existing-project migrate/generate would have invoked the wrong local binary.                                                                                                                                                                   |
| D9-AC4 | Platform comments are removed and current review-comment classifications are defensible.                                    | PASS   | `packages/cli/src/platform/$.ts` and `packages/cli/src/platform/_lib/help.ts` drop the two redundant comments without behavior change. The remaining review classifications described in the implementation report are consistent with the diff: the Bootstrap/local-bin issue is fixed, the platform comments are removed, the deleted-test suggestion targets code already removed in D7 and is obsolete, and the `pnpm`/`npx` review suggestions conflict with the slice's user-facing CLI-output scope rather than contributor-tooling rules.                                                               |
| D9-AC5 | Gates are credible and the remaining local benchmark typecheck issue is shown unrelated to this PR/CI failure.              | PASS   | `git diff --check 8ca24fe182^ 8ca24fe182` passed. The commit scope is confined to ignore config, one path-mapping file, one Bootstrap fix, one focused Bootstrap test, and comment removals; nothing touches the generated type-benchmark fixtures mentioned in the implementation report. The alias correction explains the reported exact CI failure mode (`prisma7` root/config imports in workspace typecheck), while the unrelated unused `@ts-expect-error` noise lives outside the touched surfaces and does not undermine the PR's CI-root-cause claim.                                                 |
| D9-AC6 | The round honors the operator's anti-mock direction; the new Bootstrap test is proportionate rather than slice drift.       | PASS   | The new 45-line case lives in the pre-existing `packages/cli/src/bootstrap/__tests__/Bootstrap.vitest.ts` suite and asserts one regression the packed `prisma7` E2E does not observe: that an existing project shells out through the selected local `.bin/prisma7` for `migrate dev` and `generate` instead of hardcoded `.bin/prisma`. This is a narrow command-selection assertion on a new D9 fix, not a revival of the removed identity mock suites from D7. Given the current executable-boundary coverage never exercises `bootstrap`, removing this test would leave the fix backed only by code audit. |

**Overall slice verdict:** SATISFIED. D1-D9 are satisfied, and D9 closes the remaining CI/review follow-up without reopening the slice.

## cli-owned-distribution-identity D8 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                        | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D8-AC1 | All identity-sensitive CLI command constructors, factories, and helpers require explicit identity with no fallback.        | PASS   | `46c4cdc1c7`; the commit removes default/optional identity plumbing from every touched CLI-owned boundary: `CLI.new`, `DebugInfo.new`/constructor, `Format.new`/constructor, `GenerateOptions.identity` plus `Generate.new`, `defaultEnv`, `defaultConfig`, `Init.new`/constructor, `Status.new`/constructor, `Studio.new`/constructor, `SubCommand` constructor, `Validate.new`/constructor, `Version.new`/constructor, `Bootstrap.new`/constructor, `formatBootstrapOutput`, `Completions.new`, `parseCompletionCommand`, `printPpgInitOutput`, `Mcp.new`, `Platform.$.new`, `PostgresCommand.new`, `Link.new`/constructor, `formatCompletionOutput`, and `getGlobalLocalVersionMismatchWarning`. The reviewer audit over the touched surfaces found zero remaining `identity?:`, `identity ?? 'prisma'`, or `= 'prisma'` fallbacks at those boundaries.                                |
| D8-AC2 | Production roots and nested composition pass the selected identity explicitly, while ordinary scripts/tests pass `prisma`. | PASS   | `packages/cli/src/bin.ts` resolves `const identity = getCliDistributionIdentity()` once and passes it into every identity-sensitive CLI-owned constructor, including `CLI.new(...)`, `PostgresCommand.new(...)`, `Completions.new(identity)`, and `Platform.$.new(..., identity)`. The separate completion entrypoint independently passes `getCliDistributionIdentity()` into `parseCompletionCommand(...)` in `packages/cli/src/completions/completion-entry.ts`. Nested composition remains explicit in `packages/cli/src/bootstrap/Bootstrap.ts` (`Link.new(this.identity)`, `Generate.new(this.identity)`, `Init.new(this.identity)`), while ordinary call sites intentionally pass `'prisma'` in `scripts/run-studio.ts` and the updated existing CLI test suites (`CLI.test.ts`, `Generate.test.ts`, `Init.vitest.ts`, `PostgresCommand.vitest.ts`, `completion-command.test.ts`). |
| D8-AC3 | Executable inference defaults only at the true executable boundary.                                                        | PASS   | After `46c4cdc1c7`, the only remaining defaulted inference is `getCliDistributionIdentity(executedScript = process.argv[1])` in `packages/cli/src/utils/cli-distribution-identity.ts`. `bin.ts` and `completions/completion-entry.ts` are the only product call sites using that getter directly, and `parseCompletionCommand(...)` no longer falls back to it internally. No other touched constructor/helper defaults identity from `process.argv`, nullish coalescing, or an optional parameter.                                                                                                                                                                                                                                                                                                                                                                                       |
| D8-AC4 | No lower-package/backcompat scope was added, and no new identity mock suite or reexport/overload was introduced.           | PASS   | `git diff --name-status 46c4cdc1c7^ 46c4cdc1c7` shows only modifications under `packages/cli/src/**` plus `scripts/run-studio.ts`; no lower-package files, reexports, or compatibility overload shims were added. The commit adds no new files at all, so there is no replacement identity mock suite; instead it updates existing ordinary-Prisma tests and helper call sites to pass `'prisma'` explicitly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D8-AC5 | The reported gates, audit, and transient scan are defensible, and the Generate-failure classification is honest.           | PASS   | `git diff --check 46c4cdc1c7^ 46c4cdc1c7` passed. The mandatory transient scan over the touched files found no UUID, `agent_id`, `subagent`, `trace_id`, or `projects/prisma7-compatibility-cli/` strings; the only `session` match is the pre-existing semantic `Session expired...` wording in Postgres link code/tests, not a transient identifier. No on-disk evidence contradicts the reported `pnpm --filter prisma tsc`, Prisma/Prisma7 builds, affected ordinary tests, packed compatibility E2E, Prettier, lint, or diff-check gates. The broader Generate-suite failure remains honestly classified as unrelated Nix/OpenSSL noise: this commit only hardens explicit identity plumbing, updates the affected Generate coverage to pass `'prisma'`, and does not touch the known engine/download surfaces behind the previously documented NixOS failure mode.                  |

**Overall slice verdict:** SATISFIED. D1-D8 are satisfied, and D8 closes the slice with explicit identity requirements at CLI command boundaries while keeping executable inference confined to the real entrypoints.

## cli-owned-distribution-identity D7 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                  | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7-AC1 | Slice-added mock-heavy identity suites/assertions are removed while pre-existing ordinary tests stay coherent.       | PASS   | `09de26b02d`; the four slice-added `distribution-identity-*` suites are deleted, and the slice-added identity assertions are removed from `packages/cli/src/completions/completion-command.test.ts` and `packages/cli/src/__tests__/commands/SubCommand.vitest.ts`. Those two files still retain their pre-existing ordinary-Prisma coverage (`parseCompletionCommand(['fish'])`, unsupported-shell rejection, and Deno abort-without-install), and no production files are touched.                              |
| D7-AC2 | Exactly one packed compatibility scenario snapshots representative real-command identity behavior deterministically. | PASS   | `37d7f251f9`; `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts` still uses the single packed scenario and real installed commands, but now projects version output into stable identity-bearing evidence via `projectVersion(...)`: `prisma7`/`@prisma/client` labels and versions, absence of an ordinary `prisma` key/label, metadata key/label sets, and stderr. The snapshot no longer hardcodes architecture, engine hashes/paths, runtime/toolchain versions, or peer-layout paths.      |
| D7-AC3 | Normalization hides only dynamic noise and the snapshot stays reviewable rather than an opaque churn-prone dump.     | PASS   | `37d7f251f9`; the raw help/completion/init snapshots remain intact, while version evidence is reduced to a concise projection that still proves identity semantics: `distributionKey`/`distributionLabel` are `prisma7`, `hasPrismaKey`/`hasPrismaLabel` are false, both distribution and client versions are captured, metadata is represented as key/label sets only, and stderr preserves the config/schema-load proof. The result is reviewable without churn from host-specific values.                      |
| D7-AC4 | Existing generate/db push/client smoke remains and no second scenario or test-only production seam was added.        | PASS   | `tests/main.test.ts` still runs `pnpm exec tsc --noEmit`, `pnpm exec prisma7 generate`, `pnpm exec prisma7 db push --force-reset`, TypeScript-compiles `smoke.ts`, and executes `tsx smoke.ts` after the snapshot assertion. `_steps.ts` still keeps a single packed scenario (`pnpm install` then `pnpm exec vitest run`), and the diff adds no production code or new seam.                                                                                                                                     |
| D7-AC5 | Update/mismatch evidence boundaries are honest and no fake mock replacement remains.                                 | PASS   | The removed suites include the old mock-only update-check and mismatch tests; the new packed scenario does not pretend to observe checkpoint suppression or mismatch internals from one executable-boundary run. The remaining evidence is honestly limited to command-visible help/version/completion/init behavior plus the existing packed generate/db push/client smoke, which matches the dispatch plan's stated boundary for unobservable internals.                                                        |
| D7-AC6 | Reported gates/transient scan are defensible and no production behavior changed.                                     | PASS   | The commit changes only tests plus the e2e fixture lockfile/package manifest; there is no product-code diff. No on-disk evidence contradicts the reported builds, affected tests, packed E2E, Prettier, lint, diff-check, or transient-scan gates. Reviewer reran the mandatory transient-ID scan over the changed test/lockfile surfaces: no UUID, `subagent`, `session`, or `projects/prisma7-compatibility-cli/` hits were found; the only bare `agent` string is the lockfile dependency name `tunnel-agent`. |

**Overall slice verdict:** SATISFIED. D1-D6 remain satisfied, and D7 now closes with a deterministic packed snapshot projection that preserves the CLI-identity proof without host-specific churn.

## cli-owned-distribution-identity D6 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                                                                                     | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6-AC1 | Exactly one packed scenario proves CLI-owned help/version/completion/init and retains the prior generate/db push/client smoke.                          | PASS   | `8c41d0a6e6`; `packages/client/tests/e2e/prisma7-compatibility/_steps.ts` remains the fixture's sole `_steps.ts` scenario and now adds packed assertions for `prisma7 --help`, text/JSON `--version`, `complete zsh`, and `init --datasource-provider sqlite --no-skills` generating `prisma7/config`. The same file still keeps the pre-existing `pnpm exec tsc --noEmit`, `prisma7 generate`, `prisma7 db push --force-reset`, and `smoke.ts` generated-client proof, so the new identity checks extend rather than replace the established packed behavior.                                                                                                                                                                                                                                                                                                                                                                                        |
| D6-AC2 | The packed E2E assertions are deterministic and non-tautological, and lock/tar handling remains sound.                                                  | PASS   | `8c41d0a6e6`; the new assertions read real packed-command output and generated files, and they pair positive checks with opposite-identity negatives (`prisma7` present, ordinary `prisma` absent) instead of snapshotting a value derived from the same input. The init proof executes the installed `node_modules/.bin/prisma7` inside a throwaway project, then reads `prisma.config.ts` from disk. The refreshed `packages/client/tests/e2e/prisma7-compatibility/pnpm-lock.yaml` still pins `/tmp/prisma7-0.0.0.tgz` at the importer and its nested `prisma: file:../../tmp/prisma-0.0.0.tgz` dependency in snapshots.                                                                                                                                                                                                                                                                                                                           |
| D6-AC3 | The CLI-owned literal audit is sufficient: escapees are fixed/tested and no unclassified actionable distribution literal remains in `packages/cli/src`. | PASS   | `8c41d0a6e6`; `packages/cli/src/Generate.ts` now labels the mismatch hint with `${this.identity}@${cliVersion}`, covered by the added `generate mismatch hint labels the selected CLI package` case in `packages/cli/src/__tests__/distribution-identity-version-mismatch.vitest.ts`. `packages/cli/src/SubCommand.ts` now renders `npx ${this.identity} <cmd>` in Deno guidance, covered by the new dual-identity Deno cases in `packages/cli/src/__tests__/commands/SubCommand.vitest.ts`. The reviewer audit scan over `packages/cli/src` leaves only domain-stable surfaces (`@prisma/client`, `prisma-client`, `schema.prisma`, `prisma/schema.prisma`, `prisma.config.ts`, docs/protocol strings), internal runtime/storage invariants (`paths('prisma')`, checkpoint `product: 'prisma'`, local `node_modules/.bin/prisma` resolution), or comments/tests; no actionable CLI-owned distribution guidance remains unclassified in product code. |
| D6-AC4 | D5's control-flow proof remains the authoritative update-suppression evidence, so the packed E2E need not fake request-creation assertions.             | PASS   | The on-disk D5 proof remains `packages/cli/src/CLI.ts` gating `runCheckpointClientCheck(...)` behind `this.identity === 'prisma'`, with `packages/cli/src/__tests__/distribution-identity-update-check.test.ts` asserting zero checkpoint calls and zero update-print calls for `prisma7`. Commit `8c41d0a6e6` does not touch `CLI.ts`, checkpoint helpers, or update rendering. Because request creation has no stronger packed observable than the already-reviewed zero-call control-flow test, omitting a synthetic packed update assertion is justified and keeps the E2E on user-visible packed behavior only.                                                                                                                                                                                                                                                                                                                                  |
| D6-AC5 | Reported full gates and the mandatory transient scan are defensible, and the slice closes without downstream/release spillover.                         | PASS   | No on-disk evidence contradicts the reported `pnpm --filter prisma build`, `pnpm --filter prisma7 build`, focused identity suites, `pnpm --filter @prisma/client test:e2e --verbose --runInBand prisma7-compatibility`, root `pnpm prettier-check`, `pnpm lint`, `git diff --check`, and transient-scan gates for `8c41d0a6e6`. Reviewer reran `git diff --check 8c41d0a6e6^ 8c41d0a6e6`, which passed, and the mandatory transient-ID scan over the seven touched product/test files found no UUID, agent, subagent, or session identifiers. The commit scope stays inside `packages/cli/src/**` and the packed E2E fixture/lockfile, so downstream actionable guidance and release automation remain future-slice scope only.                                                                                                                                                                                                                       |

### Durable audit classification

- **Fixed in D6:** the remaining CLI-owned escapees were the Generate mismatch hint label and the SubCommand Deno rerun guidance; both now use the selected identity and both are regression-pinned.
- **Remaining `prisma` literals under `packages/cli/src` are intentionally non-actionable in this slice:**
  - **Domain-stable surfaces:** `@prisma/client`, `prisma-client`, `schema.prisma`, `prisma/schema.prisma`, `prisma.config.ts`, Prisma docs URLs, and Studio's `prisma`/`prisma+postgres` protocol names.
  - **Internal runtime/storage invariants:** `paths('prisma')`, checkpoint payload `product: 'prisma'`, and local `node_modules/.bin/prisma`/`node_modules/prisma` resolution helpers.
  - **Non-product occurrences:** comments and tests.
- **Net result:** no unclassified actionable CLI-owned distribution literal remains in `packages/cli/src`; the remaining actionable identity propagation called out by the slice spec lives in later slices outside this package boundary.

**Overall slice verdict at D6 close:** SATISFIED. `cli-owned-distribution-identity` had reviewer-passed D1-D6 dispatches, zero open findings/escalations, and a met slice-specific done condition before the follow-up D7 feedback landed.

**Current status after D9 R1:** CLOSED. D1-D9 are satisfied, and the slice stays closed after the CI/review follow-up: path mappings are typecheck-correct, generated Prisma7 forwarding artifacts are ignored like their CLI counterparts, Bootstrap now shells through the selected local binary, and the remaining review comments are either fixed or defensibly classified.

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

## cli-owned-distribution-identity D5 acceptance criteria scoreboard

| AC ID  | Description (short)                                                                        | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D5-AC1 | Compatibility identity gates the update path before checkpoint promise/request creation.   | PASS   | `59d3ee7a63`; `packages/cli/src/CLI.ts` now creates `checkResultPromise` only when `this.identity === 'prisma'`, so `prisma7` skips `runCheckpointClientCheck(...)` entirely instead of creating a promise and hiding only the later output. The untouched `packages/cli/src/utils/checkpoint.ts` still owns the checkpoint payload, so this round changes control flow only.                                                                                                                                                                      |
| D5-AC2 | `prisma7` starts zero checkpoint work and prints zero update guidance.                     | PASS   | `packages/cli/src/__tests__/distribution-identity-update-check.test.ts` drives `CLI.parse(['validate'], ...)` under `prisma7` and asserts the delegated command still runs while both `runCheckpointClientCheck` and `printUpdateMessage` are never called. That proves compatibility invocation neither starts the request nor reaches the printing path.                                                                                                                                                                                         |
| D5-AC3 | Ordinary `prisma` behavior stays unchanged, including the hidden-message environment path. | PASS   | The ordinary-identity tests in `distribution-identity-update-check.test.ts` assert one checkpoint call with the existing `{ schemaPathFromConfig, baseDir }` inputs and one `printUpdateMessage` call with the resolved result. A separate case sets `PRISMA_HIDE_UPDATE_MESSAGE=true` and still observes the same ordinary CLI call path. `packages/cli/src/utils/printUpdateMessage.ts` and `packages/cli/src/utils/checkpoint.ts` are untouched, so payload/telemetry and env-specific rendering behavior remain where they already lived.      |
| D5-AC4 | Coverage is focused and non-tautological, and the seam/scope stay minimal.                 | PASS   | `59d3ee7a63` changes only `packages/cli/src/CLI.ts` plus one focused test file. The new tests exercise real `CLI.parse` control flow across both identities and the env toggle while mocking only the checkpoint/print boundaries; they do not snapshot broad help output or duplicate lower-level checkpoint implementation tests. No new identity abstraction, checkpoint product, or telemetry surface was introduced.                                                                                                                          |
| D5-AC5 | Reported gates are defensible and the mandatory transient-ID scan is clean.                | PASS   | The product diff is confined to `packages/cli/src/CLI.ts` and `packages/cli/src/__tests__/distribution-identity-update-check.test.ts`. Reviewer reran `git diff --check 59d3ee7a63^ 59d3ee7a63`, which passed, and the mandatory transient-ID scan over those touched files found no UUID, agent, subagent, session, or `projects/prisma7-compatibility-cli/` hits. No on-disk evidence contradicts the reported `pnpm --filter prisma tsc`, focused CLI/update/checkpoint tests, Prettier, diff-check, and transient-scan gates for `59d3ee7a63`. |

## Subagent IDs

- **Implementer:** `c00ab7bd-a02f-41f` — replacement Pi implementer established at `cli-owned-distribution-identity` D9 R1 after D7/D8 implementer `d50332d5-aa1d-47a` became inaccessible to resume.
- **Reviewer:** `02edbde7-ca33-43a` — replacement Pi reviewer established at `cli-owned-distribution-identity` D9 R1 after D8 reviewer `8e5fbba6-5840-44a` became inaccessible to resume.

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
- After D9 review, regenerating the ignored type-benchmark clients with `pnpm --filter @prisma/type-benchmark-tests dev` cleared the local stale `@ts-expect-error` noise. The exact CI commands `pnpm tsc -p tsconfig.utils.typecheck.json` and `pnpm lint` then passed with no tracked changes.

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

### F6 — Packed snapshot hardcodes environment-specific version metadata

**Severity:** must-fix

**Where:** `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts:66-113`; `packages/client/tests/e2e/prisma7-compatibility/tests/__snapshots__/main.test.ts.snap:387-413`

**What:** The new single-scenario snapshot normalizes cwd/temp-path/ANSI/CRLF noise, but it keeps host-specific version fields and paths verbatim. The committed snapshot hardcodes `architecture: "arm64"`, the `schema-engine-linux-arm64-openssl-3.0.x` binary path, `default-engines-hash`, the PSL hash, `Node.js v22.23.2`, `TypeScript 5.7.3`, and a peer-suffixed `prisma-cli-path`. Those values are not part of the CLI-owned identity contract this dispatch is trying to prove.

**Why it matters:** D7's contract is one readable deterministic packed proof. With the current snapshot, unrelated engine rolls, toolchain bumps, peer-layout changes, or a different runner architecture will churn or fail the snapshot even when `prisma7` identity behavior is unchanged. That makes the review surface noisy and undermines the operator's explicit request to replace mocks with honest executable-boundary evidence rather than with a brittle dump.

**Recommended next action:** Keep the single packed scenario, but narrow or normalize the version snapshot to the identity-bearing fields only (for example package label plus selected command/help/config output), and strip environment-specific engine/platform/toolchain/path details that are not semantically required for this slice.

**Status:** resolved (`37d7f251f9`) — `tests/main.test.ts` now projects version text/JSON into stable identity-bearing fields only, and the snapshot drops raw architecture, engine hash/path, runtime, toolchain, and peer-layout values while preserving package labels/versions, absence of ordinary `prisma`, metadata key/label sets, and stderr.

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

### cli-owned-distribution-identity D5 R1 — SATISFIED

**Scope:** suppress Prisma 8 update consultation. Commit `59d3ee7a63`.

**Tasks:** `CLI.parse` now creates the checkpoint promise only for ordinary `prisma`, compatibility invocations skip both checkpoint startup and update printing, and the ordinary path still flows through the unchanged checkpoint/print helpers including the hidden-message env case.

**AC delta:** D5-AC1 through D5-AC5 PASS (commit `59d3ee7a63`, test `packages/cli/src/__tests__/distribution-identity-update-check.test.ts`; transient scan clean).

**Findings:** none.

**For orchestrator:** No addressable review findings remain for D5 R1.

### cli-owned-distribution-identity D6 R1 — SATISFIED

**Scope:** packed CLI identity proof and final `packages/cli/src` audit. Commit `8c41d0a6e6`.

**Tasks:** The sole packed compatibility E2E now proves CLI-owned help/version/completion/init while retaining the existing generate/db push/generated-client smoke. The fixture lockfile refresh still pins packed tarballs correctly. The last two CLI-owned escapees in Generate and SubCommand are fixed with focused regression tests, and the audit leaves only domain-stable or internal non-guidance `prisma` literals under `packages/cli/src`.

**AC delta:** D6-AC1 through D6-AC5 PASS (commit `8c41d0a6e6`, tests `packages/client/tests/e2e/prisma7-compatibility/_steps.ts`, `packages/cli/src/__tests__/distribution-identity-version-mismatch.vitest.ts`, and `packages/cli/src/__tests__/commands/SubCommand.vitest.ts`; transient scan clean). The slice-specific done condition is met.

**Findings:** none.

**For orchestrator:** `cli-owned-distribution-identity` is review-complete; the next remaining work is the planned `downstream-actionable-guidance` slice.

### cli-owned-distribution-identity D7 R1 — ANOTHER ROUND NEEDED

**Scope:** replace mocked identity coverage with one packed executable-boundary snapshot. Commit `09de26b02d`.

**Tasks:** The branch correctly deletes the slice-added mock-heavy suites, keeps the single packed compatibility scenario, uses the installed `node_modules/.bin/prisma7` binary for `init`, and preserves the pre-existing generate/db push/client smoke. The remaining issue is that the committed snapshot still hardcodes environment-specific version metadata and peer-layout paths instead of isolating durable identity behavior.

**AC delta:** D7-AC1, D7-AC4, D7-AC5, and D7-AC6 PASS. D7-AC2 and D7-AC3 FAIL on `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts` and `tests/__snapshots__/main.test.ts.snap` (see F6).

**Findings:** F6 (must-fix).

**For orchestrator:** Ask the implementer to keep the single packed scenario but trim/normalize the version snapshot so it stops encoding architecture, engine hashes/paths, toolchain versions, and peer-suffixed CLI paths. No product-code follow-up is required; this is a test-evidence correction only.

### cli-owned-distribution-identity D7 R2 — SATISFIED

**Scope:** stabilize the packed version snapshot without widening the scenario. Commit `37d7f251f9`.

**Tasks:** The single packed scenario remains intact, and the version evidence is now projected from the real `--version` text/JSON into stable identity-bearing fields only. The snapshot still proves `prisma7` distribution labeling, `@prisma/client` labeling, absence of ordinary `prisma`, semantic metadata key/label sets, and config/schema-load stderr, while the raw architecture/hash/path/runtime/toolchain values are removed.

**AC delta:** D7-AC2 and D7-AC3 FAIL → PASS on `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts` and `tests/__snapshots__/main.test.ts.snap`; F6 resolved (`37d7f251f9`). D7-AC1, D7-AC4, D7-AC5, and D7-AC6 remain PASS.

**Findings:** none.

**For orchestrator:** Root Prettier remains blocked only by this review ledger edit. No further implementer action is required for D7.

### cli-owned-distribution-identity D8 R1 — SATISFIED

**Scope:** require explicit distribution identity at CLI command boundaries. Commit `46c4cdc1c7`.

**Tasks:** Identity defaults and optional identity plumbing are removed from CLI-owned constructors/helpers, the production entry and separate completion entrypoint pass identity explicitly, nested CLI-owned composition stays explicit, and ordinary scripts/tests intentionally pass `'prisma'` without introducing any replacement mock suite.

**AC delta:** D8-AC1 through D8-AC5 PASS (commit `46c4cdc1c7`; audit over touched product/test/script surfaces; transient scan clean).

**Findings:** none.

**Verification:** `git diff --check 46c4cdc1c7^ 46c4cdc1c7` passed. The reviewer audit found the only remaining defaulted identity inference in `getCliDistributionIdentity(executedScript = process.argv[1])`, consumed by `bin.ts` and `completions/completion-entry.ts`; all other touched CLI-owned boundaries now require explicit identity. No product, test, planning, or workflow files were edited during review; only this review ledger and `wip/heartbeats/reviewer.txt` were written.

**For orchestrator:** `cli-owned-distribution-identity` remains closed. The next planned work is `downstream-actionable-guidance` unless the operator reprioritizes.

### cli-owned-distribution-identity D9 R1 — SATISFIED

**Scope:** close the exact CI/typecheck and current review follow-up. Commit `8ca24fe182`.

**Tasks:** Root/subpath typecheck aliases now match the actual `prisma` and `prisma7` source export shapes, generated Prisma7 forwarding artifacts are ignored by root lint/Prettier like the existing CLI forwarding artifacts, Bootstrap shells through the selected local binary, and the two redundant platform comments are removed. The remaining current review comments are either fixed, obsolete because their target test was deleted in D7, or rejected because they misapply contributor tooling rules to user-facing CLI guidance.

**AC delta:** D9-AC1 through D9-AC6 PASS (commit `8ca24fe182`; diff audit; transient scan clean).

**Findings:** none.

**Verification:** `git diff --check 8ca24fe182^ 8ca24fe182` passed. The mandatory transient-ID scan over `.prettierignore`, `eslint.config.cjs`, `packages/cli/src/bootstrap/Bootstrap.ts`, `packages/cli/src/bootstrap/__tests__/Bootstrap.vitest.ts`, `packages/cli/src/platform/$.ts`, `packages/cli/src/platform/_lib/help.ts`, and `tsconfig.build.bundle.json` found no UUID, `agent_id`, `subagent`, `trace_id`, `session`, or `projects/prisma7-compatibility-cli/` hits. No product, test, planning, or workflow files were edited during review; only this review ledger and `wip/heartbeats/reviewer.txt` were written.

**For orchestrator:** `cli-owned-distribution-identity` stays closed. The next planned work remains `downstream-actionable-guidance` unless the operator reprioritizes.
