# Init Journey Tests — Project Plan

## Summary

Deliver the `prisma-next init` user-journey test ([TML-2490](https://linear.app/prisma-company/issue/TML-2490)) and the four bug fixes whose seams it covers ([TML-2486](https://linear.app/prisma-company/issue/TML-2486), [TML-2487](https://linear.app/prisma-company/issue/TML-2487), [TML-2314](https://linear.app/prisma-company/issue/TML-2314), [TML-2461](https://linear.app/prisma-company/issue/TML-2461)) in **one PR with five commits**. The journey test lands "red-by-design": its assertions encode the four currently-broken seam behaviours, so CI is green at commit 1. Each subsequent commit fixes one bug and flips one assertion from "asserts bug" to "asserts fix". Reverting any one fix commit breaks the journey at exactly that seam — that commit-level rhythm is the proof artefact that the journey test catches the bug class.

**Spec:** [`projects/init-journey-tests/spec.md`](spec.md)

## Milestones

### Milestone 1 — Project shaping artifacts ✓

PR scope: spec + plan only (this milestone may merge as a separate small shaping PR, or fold into the main implementation PR — see § PR strategy below).

**Tasks:**

- [x] Spec and plan written; committed as `docs(project): scaffold init-journey-tests spec and plan (TML-2490)`.
- [x] Test location resolved: `test/integration/test/cli-journeys/init-journey.e2e.test.ts` — glob-included by both the focused `vitest.journeys.config.ts` and the broader `vitest.config.ts` runners.
- [x] `pnpm install` mechanics resolved: per-cell `pnpm install --no-frozen-lockfile` against a session-cached set of workspace tarballs (`~/.cache/pn-journey/tarballs/`) with `node-linker=isolated`. The tarball cache + pnpm store live outside the worktree to keep encoded relative paths short (avoids `ENAMETOOLONG` under deep worktree paths).

**Exit criteria:** spec + plan committed; open questions resolved.

### Milestone 2 — Journey test harness + red-by-design baseline ✓

Three commits delivered the harness + journey:

- `test(integration): scaffold init-journey harness and step-1 assertions (TML-2490)` — harness skeleton with `createJourneyProject`, `prisma-next init` subprocess invocation, and step-1 (scaffold layout) assertions for all four cells.
- `test(integration): real pnpm install with isolated linker in journey harness (TML-2490)` — session-cached tarballs, `.npmrc` writing, `pnpm install` against the cache, snapshot/restore of workspace `package.json` files around `pnpm pack`.
- `test(integration): full init journey with red-by-design seam expectations (TML-2490)` — journey steps 3 (emit) / 4 (db init) / 5 (ObjectId import) / 6 (control import) wired up with `seamExpectation` helpers encoding the four current broken behaviours.

**Scope variation from the original task list:**

- TML-2461's seam is masked by the facade's `defineConfig` (which derives an explicit `output` path), so the journey verifies the colocation invariant by direct assertion rather than via a red-by-design check. The TML-2461 fix is verified by the package-level provider tests added alongside the fix.
- The "step 7+ resetDb / planMigration / applyMigration / post-migration query" surface (plan § FR12–FR15) was deferred. The four seam bugs and the install-time seam (TML-2485 class) all materialise by step 6, so the journey scope landed is sufficient to surface them.

**Exit criteria:** 24/24 tests pass under both `vitest.journeys.config.ts` (focused) and the broader `vitest.config.ts` (full integration suite). The four seam expectations toggle correctly when their corresponding fix commits land.

### Milestone 3 — Bug fixes (one commit per ticket) ✓

Four further commits in the same PR. Each fixes one bug and flips one assertion (where applicable).

- [x] **`fix(sql-contract-psl,sql-contract-ts): derive default emit output from input path (TML-2461)`.** Moved the default-output computation into the PSL / TS providers, so when callers omit `output` the emitter writes `contract.json` next to the input rather than into `src/prisma/contract.json`. Explicit `output` continues to take precedence. Provider-level tests added alongside the fix.
- [x] **`fix(mongo): re-export ObjectId and BSON value constructors from facade (TML-2487)`.** Added top-level `index` entry-point on `@internal/mongo` that re-exports `ObjectId`, `Binary`, `Decimal128`, `Long`, `MongoClient`, `Timestamp`. Journey step 5 (ObjectId import) flips to fixed.
- [x] **`feat(postgres): expose @internal/postgres/control facade (TML-2314)`.** New `@internal/postgres/control` subpath exporting `createPostgresControlClient(options)` — collapses the five-component control-client construction into a single call. Journey step 6 (control import) flips to fixed.
- [x] **`fix(mongo): emit createCollection for new contract collections (TML-2486)`.** Two-seam fix: (1) `MongoMigrationPlanner` now emits explicit `createCollection` ops for contract collections that have no indexes to ride along on (otherwise `db init` leaves the database empty and verify reports `missing_table`); (2) `mongo-ops-serializer.validate` strips `undefined`-valued keys before handing input to arktype, so the planner → runner in-process boundary no longer trips the deserialiser when an op IR carries undefined optional fields (the original TML-2486 surface). Journey step 4 (db init) flips to fixed.

A trailing commit (`test(integration): bump user-code timeout so journey passes in main runner (TML-2490)`) lifts the two user-code `it()` timeouts to 30s so the journey passes under both runner configs.

**Exit criteria per commit:** CI green; the relevant journey assertion is `fixed`; reverting only that commit reverts the seam to its original failure surface.

### Milestone 4 — PR landing & close-out

**Tasks:**

- [ ] Open one PR with all five commits. PR title references TML-2490 (Linear's GitHub integration will auto-link the others via the issue IDs in commit messages / PR body).
- [ ] PR body: reference all five tickets, describe the red-then-green commit rhythm, link to the spec.
- [ ] Validate one more time that reverting each individual fix commit breaks the journey at the intended seam. This is the proof step.
- [ ] Land the PR. Linear auto-transitions each of the five tickets to "Done" via the GitHub integration.
- [ ] Final commit (close-out): if any long-lived documentation should live beyond the project (e.g. a brief note in `docs/` about the seam-verifier test pattern), migrate it. Strip repo-wide references to `projects/init-journey-tests/**`. Delete `projects/init-journey-tests/`.

**Exit criteria:** all five tickets in "Done"; project directory deleted; CI green on `main`.

## PR strategy

Per the discussion that produced this plan, the canonical answer is **one PR with five commits** (the red-then-green rhythm is the proof artefact and requires a single connected change).

Variation worth considering during execution:

- **Optional pre-PR for shaping artifacts.** If the team wants early review on the spec + plan before implementation begins, Milestone 1 can land in a small separate PR. This is the workflow-rule default for projects of this shape. If the spec is well-understood by reviewers at this point, skip the shaping PR and fold Milestone 1 into the main PR.

Decision: **start with the spec + plan in a small shaping PR**, validate quickly with the team, then proceed to the implementation PR. Cancel the shaping PR and inline the artifacts into the implementation PR only if the shaping review pass adds no useful feedback in the first review cycle.

## Risks

- **`pnpm install` cost on CI.** If the chosen install mechanism (Open Question 2) takes longer than the NFR1 budget on cold CI, the per-cell budget needs revisiting. Mitigation: validate cost on local + CI during Milestone 2 before going further.
- **Mongo migration parity assumption (spec § Open Questions Q4).** If Mongo doesn't have `migration plan` / `migration apply` in the same shape as Postgres, steps 8–9 of the Mongo cells substitute "re-author + re-emit + re-run `db init`". The substitution is acceptable per the spec, but flag it in the plan if it materialises.
- **TML-2461 blast radius (assumption: small).** If TML-2461's fix turns out to require coordinated changes across examples / docs / demos that hard-code the legacy path, commit 5 grows. Mitigation: scope-check TML-2461's reach early in Milestone 2 (before all four fixes are queued up).

The red-then-green proof is validated **on the branch** before merge — reverting any one fix commit in the branch's history must break the journey at exactly that seam. Post-merge revertibility is not a goal; the per-subsystem regression tests added alongside each fix carry the long-term backstop.

## Close-out (required)

- [ ] Verify all acceptance criteria in [`spec.md`](spec.md).
- [ ] Migrate any long-lived docs into `docs/` (likely none — this is internal test infrastructure that lives with the test file).
- [ ] Strip repo-wide references to `projects/init-journey-tests/**` (replace with canonical `docs/` links or remove).
- [ ] Delete `projects/init-journey-tests/`.
