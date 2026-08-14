# Code review — `prisma7-config`

> Initial scaffold. The reviewer maintains this document across rounds. The orchestrator and implementer read it but do not edit reviewer-owned sections.

## Summary

- **Current verdict:** SATISFIED
- **Dispatches SATISFIED:** D1, D2, D3
- **AC scoreboard totals:** 12 PASS / 0 FAIL / 0 NOT VERIFIED
- **Open findings:** 0
- **Open escalations:** 0

## Acceptance criteria scoreboard

| AC ID | Description (short)                                                    | Dispatch | Status | Evidence                                                                                                                                                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | Automatically discover only exact root `prisma7.config.ts`             | D1       | PASS   | Focused positive coverage plus rejection of alternate root extensions and `.config/` locations in `packages/config/src/__tests__/loadConfigFromFile.test.ts`, corrective commit `b949a1b9f5`                                                                                                 |
| AC-2  | Exact root `prisma7.config.ts` wins over legacy discovery              | D1       | PASS   | Exact-file precedence and selected-file failure tests in `packages/config/src/__tests__/loadConfigFromFile.test.ts`, corrective commit `b949a1b9f5`                                                                                                                                          |
| AC-3  | Explicit `--config` wins                                               | D1       | PASS   | Explicit valid and invalid custom/versioned paths win beside the exact automatic candidate in `packages/config/src/__tests__/loadConfigFromFile.test.ts`, commits `a330332383`, `b949a1b9f5`                                                                                                 |
| AC-4  | Invalid selected Prisma 7 config hard-fails without legacy fallback    | D1/D3    | PASS   | Unit coverage in `packages/config/src/__tests__/loadConfigFromFile.test.ts`; both installed entrypoints exit non-zero on the exact versioned-file error without selecting legacy in `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts`, commits `b949a1b9f5`, `cbdef5fd11` |
| AC-5  | Legacy c12 discovery remains quiet and compatible                      | D1/D3    | PASS   | Unit coverage plus exact installed stderr for both entrypoints (`Loaded Prisma config from prisma.config.ts.`) in `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts`, commits `b949a1b9f5`, `cbdef5fd11`                                                                   |
| AC-6  | Relative config paths resolve from exact `prisma7.config.ts`           | D1       | PASS   | Schema, migrations, Typed SQL, and views resolve from root `prisma7.config.ts` in `packages/config/src/__tests__/loadConfigFromFile.test.ts`, corrective commit `b949a1b9f5`                                                                                                                 |
| AC-7  | Bootstrap prefers exact root versioned file, then exact root legacy    | D2       | PASS   | Non-executing selector and focused project-state/seed tests prove root `prisma7.config.ts` then root `prisma.config.ts`, while alternate extensions/locations are ignored; corrective commit `b949a1b9f5`                                                                                    |
| AC-8  | Both init identities generate `prisma7.config.ts` with correct imports | D2/D3    | PASS   | Unit and installed coverage verifies both identities write only the versioned file with `prisma/config` or `@prisma/prisma7/config`; Bun E2E reads the canonical filename and snapshots the full generated config, commits `8c0a07a5b6`, `cbdef5fd11`, `1f650903c2`                          |
| AC-9  | Completion/help/concrete default guidance teaches `prisma7.config.ts`  | D2       | PASS   | Focused CLI, completion, internals, and migrate assertions including `packages/migrate/src/__tests__/config-guidance.test.ts`, commit `8c0a07a5b6`                                                                                                                                           |
| AC-10 | Both Prisma 7 entrypoints share one policy                             | D3       | PASS   | Installed `.bin/prisma7` and the packed transitive `prisma/build/index.js` bin target run the same precedence, failure, fallback, and init matrix in `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts`, commit `cbdef5fd11`                                               |
| AC-11 | Production literal audit has no stale concrete default guidance        | D2/D3    | PASS   | Final production scan at `cbdef5fd11` leaves only the accepted Prisma 6 compatibility comment and concrete legacy panic fixture lookup                                                                                                                                                       |
| AC-12 | Installed evidence covers precedence, hard failure, and fallback       | D3       | PASS   | Non-tautological installed-command assertions cover selected-path diagnostics, failure status/error and negative legacy selection, and exact quiet fallback stderr for both entrypoints in `packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts`, commit `cbdef5fd11`         |

Status values: `PASS` / `FAIL` / `NOT VERIFIED — <reason>` / `ACCEPTED DEFERRAL — <link>` / `OUT OF SCOPE`.

## Subagent IDs

- **Implementer:** `general-purpose` (harness did not expose a resumable ID) — first spawned in D1 R1; replacement validation-only agent spawned before review because the original invocation hit its turn limit.
- **Reviewer:** `general-purpose` (harness did not expose a resumable ID) — first spawned after D1 R1; subsequent rounds use replacement reviewers with the on-disk ledger as continuity.

## Orchestrator notes

None.

## Findings log

### F1 — Preserve explicit load-error path attribution

**Severity:** must-fix

**Where:** `packages/config/src/loadConfigFromFile.ts:123-129,270-274`

**What:** Explicit `configFile` load failures pass `null` as the attribution path, so the catch branch returns `configRoot` unless the requested filename happens to match `prisma.config.*`. An explicit invalid `prisma7.config.ts` or custom filename therefore reports the directory rather than the authoritative requested file.

**Why it matters:** CLI diagnostics interpolate `resolvedPath`; users who explicitly select a broken config receive a misleading file location, contrary to the explicit-path and selected-file attribution contract.

**Recommended next action:** Preserve the explicit requested path for catch attribution while retaining legacy automatic error extraction, and add a regression test for an explicitly selected invalid Prisma 7/custom config beside competing automatic candidates.

**Status:** resolved (`a330332383036956f84fbed8277c9ea79305fd87`)

### F2 — Mirror c12 legacy index-directory discovery

**Severity:** must-fix

**Where:** `packages/config/src/loadConfigFromFile.ts:26-50`

**What:** `findPrismaConfigFile` manually enumerates flat legacy filenames, but c12 3.3.4 also resolves `/index` suffixes. Runtime automatic discovery therefore loads `prisma.config/index.{ext}`, `.config/prisma/index.{ext}`, and `.config/prisma.config/index.{ext}`, while bootstrap reports no config or can inspect a lower-precedence flat candidate.

**Why it matters:** Bootstrap project detection and seed inspection can disagree with runtime discovery, violating AC-7 and potentially initializing over an existing project or using seed metadata from the wrong config.

**Recommended next action:** Extend the non-executing selector to cover c12's index-directory forms in c12's exact precedence, and add parity regressions for all three locations plus competition with a lower-precedence flat candidate.

**Status:** superseded by the settled exact-file bootstrap contract and removed in `b949a1b9f52f4780cb1e60990a9830d830026865`; no longer applicable.

### F3 — Remove unrequested alternate Prisma 7 automatic discovery

**Severity:** must-fix

**Where:** `packages/config/src/loadConfigFromFile.ts`, `packages/config/src/index.ts`, and `packages/cli/src/bootstrap/project-state.ts`

**What:** The prior implementation expanded automatic Prisma 7 discovery into an extension/location family and exported candidate-selection machinery that human review explicitly rejected. The settled contract special-cases only root `prisma7.config.ts`, then leaves c12 legacy discovery and pre-PR root `prisma.config.ts` bootstrap behavior unchanged.

**Why it matters:** Unrequested filename support creates a broader compatibility surface and makes bootstrap/runtime behavior more complex than the product contract requires.

**Recommended next action:** Select only root `prisma7.config.ts` before the existing c12 call, remove candidate-family exports/helpers, and reduce bootstrap to root `prisma7.config.ts` followed by root `prisma.config.ts`; retain focused precedence, hard-failure, explicit-path, fallback, and non-execution tests.

**Status:** resolved (`b949a1b9f52f4780cb1e60990a9830d830026865`)

## Round notes

### D1 R1 — ANOTHER ROUND NEEDED

**Scope:** Dispatch 1. Commits `817c176693`..`210112ec4e`.

**Tasks:** D1 partial: automatic discovery, fallback, and path transformation are clean; explicit load-error attribution is not.

**AC delta:** AC-1 through AC-6 NOT VERIFIED → PASS from focused loader tests in commit `817c176693`.

**Findings:** F1 (must-fix).

**For orchestrator:** none.

### D1 R2 — SATISFIED

**Scope:** Dispatch 1. Commit `a330332383036956f84fbed8277c9ea79305fd87`.

**Tasks:** D1 clean: explicit invalid versioned/custom attribution is fixed; automatic hard-failure attribution and legacy fallback remain intact.

**AC delta:** AC-3 evidence widened by explicit invalid-path regressions in `packages/config/src/__tests__/loadConfigFromFile.test.ts`; totals remain 6 PASS / 0 FAIL / 6 NOT VERIFIED.

**Findings:** F1 resolved (must-fix); no open findings.

**For orchestrator:** none.

### D2 R1 — ANOTHER ROUND NEEDED

**Scope:** Dispatch 2. Commit `8c0a07a5b6488ffd94ca3306a885a92fb4b53283`.

**Tasks:** D2 partial: init and guidance are clean; bootstrap omits c12's legacy index-directory candidates.

**AC delta:** AC-7 NOT VERIFIED → FAIL (F2); AC-8, AC-9, and AC-11 NOT VERIFIED → PASS (commit `8c0a07a5b6`, focused tests and production audit).

**Findings:** F2 (must-fix).

**For orchestrator:** none.

### D2 R2 — SATISFIED

**Scope:** Dispatch 2 fix. Commit `14d5c875bbd79f25f12091904aef3be484db54c9`.

**Tasks:** D2 clean: non-executing legacy selection now matches c12's flat/index ordering and bootstrap consumes it without executing config.

**AC delta:** AC-7 FAIL → PASS; totals 10 PASS / 0 FAIL / 2 NOT VERIFIED.

**Findings:** F2 resolved; no open findings.

**For orchestrator:** none.

### D3 R1 — SATISFIED

**Scope:** Dispatch 3 and final slice review. Commit `cbdef5fd11f119204e0685b26b0744488fad766c`.

**Tasks:** D3 clean: isolated installed-command coverage proves both legitimate entrypoints; lockfile changes are local-tarball integrity refreshes only.

**AC delta:** AC-10 and AC-12 NOT VERIFIED → PASS; AC-4, AC-5, AC-8, and AC-11 evidence widened; totals 12 PASS / 0 FAIL / 0 NOT VERIFIED.

**Findings:** none; final slice has no open findings.

**For orchestrator:** slice DoD met; transient-ID scans of D3 and the cumulative slice diff emitted zero hits.

### D3 R2 — SATISFIED

**Scope:** CI correction. Commit `1f650903c2b43be8aea6cefee0481f3f90af3077` against parent `996f10510e4c4e840c7a70f3191d2b77e6b5f343`.

**Tasks:** Bun init E2E clean: test filename and lookup use `prisma7.config.ts`; the full generated-content snapshot remains intact; README matches. Diff is limited to the fixture's two files.

**AC delta:** AC-8 evidence widened by Bun E2E coverage; totals remain 12 PASS / 0 FAIL / 0 NOT VERIFIED.

**Findings:** none; old Bun fixture references and transient-ID scan both emitted zero hits. Focused ESLint, Prettier, and diff checks pass; implementer reports Docker E2E 1/1 PASS.

**For orchestrator:** CI correction is review-satisfied; no scope expansion or follow-up finding.

### D1 R3 — SATISFIED

**Scope:** Human-feedback correction. Commit `b949a1b9f52f4780cb1e60990a9830d830026865` against parent `f4a9afd1bbd3dc54128fba5021a63a2ebead5175`.

**Tasks:** The correction cleanly removes alternate Prisma 7 extension/location discovery, candidate-family exports, manual c12-parity machinery, and their over-broad tests. Runtime now checks only exact root `prisma7.config.ts`, then calls the unchanged c12 legacy path; explicit paths remain authoritative, and selected exact-file load/validation failures remain terminal and correctly attributed. Bootstrap is restored to its pre-PR root `prisma.config.ts` behavior with only root `prisma7.config.ts` inserted ahead of it, reads source without executing it, and preserves package.json seed precedence. The Bun title is exactly `prisma7.config.ts matches snapshot`.

**AC delta:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, and AC-7 wording/evidence now reflect the settled exact-file contract rather than the rejected extension family; totals remain 12 PASS / 0 FAIL / 0 NOT VERIFIED.

**Findings:** F3 resolved; F2 is superseded by the human-settled bootstrap contract. No open findings. Focused config tests pass (78 passed, 2 skipped), bootstrap tests pass (27 passed), `@prisma/config` build and Prisma CLI typecheck pass, focused ESLint and Prettier checks pass, `git diff --check` passes, the six-file corrective diff has no implementation drift, and the mandatory transient-ID scan emits zero hits.

**For orchestrator:** Human-feedback correction is review-satisfied; no implementation follow-up is required.
