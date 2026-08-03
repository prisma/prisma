# Summary

Add a user-journey end-to-end test that exercises the prisma-next inner loop from `prisma-next init` through to a working query against a real DB, across all four `target × authoring` cells. The test is a **seam verifier**: it asserts that the contract one subsystem hands to the next holds end-to-end, catching a class of bugs the existing per-subsystem test net is structurally blind to. Lands "red-by-design" — assertions encode the four currently-known seam bugs (TML-2486, TML-2487, TML-2314, TML-2461) so each subsequent bug-fix commit flips one assertion from "asserts bug" to "asserts fix".

# Context

## At a glance

Today the test suite is shaped like the system: per-subsystem unit, integration, and e2e tests, each verifying behaviour *inside* a subsystem. [PR #485](https://github.com/prisma/prisma-next/pull/485) (TML-2485) revealed a class of bugs that lives *between* subsystems — the cli scaffolder emitted imports that resolved fine in the workspace but broke under a fresh `pnpm install` with `node-linker=isolated`. Neither the cli's own tests nor the resolver's tests could see the broken contract between them. We learned about it from a user.

This project adds the missing test layer: a single journey test, per cell, that walks the user inner loop end-to-end and asserts the *handoff* between subsystems at each step. The journey runs a real `pnpm install` and a real in-process DB so the seams it traverses are the same seams a real user traverses.

```text
[ prisma-next init ]
        ▼   ◄── seam: scaffold → first runnable contract
[ pnpm install --node-linker=isolated ]
        ▼   ◄── seam: scaffold → installable on user machine (TML-2485 surface)
[ author: add a model ]
        ▼
[ prisma-next contract emit ]
        ▼   ◄── seam: authored contract → emitted artefacts
[ default-path layout check ]
        ▼   ◄── TML-2461 seam: emit writes where the user expects
[ prisma-next db init ]
        ▼   ◄── TML-2486 seam: runtime accepts emitted contract, materialises real DB schema
[ user code: insert + query (ObjectId / control) ]
        ▼   ◄── TML-2487 / TML-2314 seams: runtime API surface matches user expectations
[ assert: query returns expected row ]
        ▼
[ reset DB ]
        ▼
[ author: schema delta ]
        ▼
[ prisma-next migration plan ]
        ▼   ◄── seam: planner reads two contract states
[ prisma-next migration apply ]
        ▼   ◄── seam: apply reaches the predicted state
[ user code: query again ]
        ▼
[ assert: query still works ]
```

Four bug fixes (TML-2486, TML-2487, TML-2314, TML-2461) close in the same PR as this work. The PR contains five commits — one for the journey-test infrastructure, then one per bug. Each bug-fix commit flips one journey assertion from "asserts current broken behaviour" to "asserts correct behaviour". Reverting any one fix commit causes the journey to break at exactly that seam, which is the proof artefact that the journey test catches the bug class.

## Problem

The existing test net for the init flow has three layers:

- **Unit / integration**: each subsystem (cli templates, contract emitter, runtime, adapter, driver) has its own tests against assumed inputs.
- **CLI integration e2e**: `test/integration/test/cli.*.e2e.test.ts` covers individual commands (`cli.init-templates`, `cli.init-facade-imports`, `cli.db-init.e2e`, `cli.emit-command.e2e`, etc.) in isolation, mostly with mocked drivers or shape-only assertions.
- **Framework e2e**: `test/e2e/framework/*.e2e.test.ts` covers workflow-level scenarios (greenfield setup, brownfield adoption, drift detection, migration round-trip) but starts from a pre-built fixture contract, not from `prisma-next init`.

None of these test layers walk the full path from `prisma-next init` through to "user queries a real DB". The seams between them — what `init` produces vs what `emit` accepts; what `emit` writes vs what `db init` reads; what `db init` materialises vs what user code expects — are not covered by any single layer.

TML-2485 was caught by a user. The pattern from TML-2485 to the four open tickets is the same: **a contract between two subsystems silently broke, and no test could see it**. PR #485's regression guard (`cli.init-facade-imports.e2e.test.ts`) catches the specific TML-2485 failure mode (a static-import-shape check) but is shaped to that one seam; the four open bugs all sit at different seams and are invisible to that test.

The four open tickets in this class:

- [TML-2486](https://linear.app/prisma-company/issue/TML-2486) — `db init` sends `undefined` for optional `createCollection` fields; Mongo rejects the command. Seam: emit → `db init`.
- [TML-2487](https://linear.app/prisma-company/issue/TML-2487) — `@internal/mongo` doesn't re-export `ObjectId`; users have to `pnpm add mongodb`. Seam: `db init` → typed user code.
- [TML-2314](https://linear.app/prisma-company/issue/TML-2314) — `@internal/postgres/control` missing; users assemble `ControlClient` from five packages. Seam: `db init` → typed user code (control-plane).
- [TML-2461](https://linear.app/prisma-company/issue/TML-2461) — `DEFAULT_CONTRACT_OUTPUT` not colocated with the PSL source; emitted artefacts land somewhere the user does not expect. Seam: authored contract → emitted artefacts.

## Approach

Add one user-journey test per cell that walks the full inner loop against a real in-process DB and a real `pnpm install`, asserting every seam contract along the way.

**Test identity: seam verifier, not smoke test.** Per-subsystem coverage already provides diagnostic localisation; when the journey fails, "which subsystem broke" comes from the existing per-subsystem tests. The journey's job is to surface the *existence* of a broken seam, not to localise it.

**Cell matrix: 2 × 2 = 4 cells.** `(postgres + mongo) × (psl + ts)`, mirroring the existing `cli.init-templates` and `cli.init-facade-imports` cells. The five motivating bugs are split across both targets and both authoring styles — narrowing the matrix would reproduce the gap.

**Real DBs, in-process.** PGlite for Postgres, `mongodb-memory-server` for Mongo. Both are already used by `test:integration` and `test:e2e`; no external infrastructure.

**Real `pnpm install` per cell with isolated linker.** The test creates a fresh temporary project directory and runs `pnpm install` with `node-linker=isolated` (the user default) against the workspace's pre-built tarballs (or workspace `link:` references that simulate isolated layout — see Open Questions). This keeps TML-2485-class bugs in the journey's failure surface; a shortcut that uses the workspace's hoisted `node_modules` would silently mask them.

**Test mode: bolt user code on top.** The journey owns a small fixture per cell — a model with a few fields, an insert, a select, a schema delta — including code that uses `ObjectId` (Mongo) and `control` (Postgres). The fixture is part of the spec: it defines "what a fresh user is expected to write in the first minute" and becomes a canonical user-perspective contract the team protects against regression.

**Sequencing: "red-by-design".** The journey-test infrastructure commit asserts the *current broken behaviour* at each of the four bug seams (e.g. "expects `db init` to throw at `createCollection` because TML-2486"). CI stays green because the assertions match reality. Each subsequent bug-fix commit in the same PR flips one assertion from "asserts bug" to "asserts fix". Revert any one fix → the journey breaks at exactly that seam.

**Diagnostic detail.** When the journey fails, the existing per-subsystem tests are the diagnostic layer. The journey produces a "the journey broke at step N" signal; engineers then drop into the per-subsystem tests to localise. This is an intentional layering, not a missing feature of the journey test.

# Requirements

## Functional Requirements

### Test harness

- **FR1.** A per-cell test runner that, given `(target, authoring)`, materialises an isolated project directory in `os.tmpdir()`, runs `prisma-next init --{target} --{authoring}`, runs `pnpm install` with `node-linker=isolated`, and yields a project handle that can run subsequent steps.
- **FR2.** The project handle exposes operations corresponding to the journey steps: `addModel(fragment)`, `emit()`, `dbInit()`, `runUserCode(source, args)`, `resetDb()`, `planMigration()`, `applyMigration()`. Each operation invokes the real CLI / runtime in the materialised project, not stubs.
- **FR3.** The test handle exposes a typed `seam(name)` helper that returns a "current behaviour" assertion subject (e.g. `expect(handle.seam('db-init')).toEither(succeed, throwWithMessage(...))`). The harness must support assertions that pass *while a bug exists* and *after the bug is fixed* without test rewriting being a flag-flip exercise — see FR4.
- **FR4.** The harness provides a `seamExpectation(name, status)` helper where `status` is `'currently-broken-by:TML-NNNN'` or `'fixed'`. When `'currently-broken-by'`, the journey step asserts the documented current failure (specific error message, specific failure step, specific symbol absence); when `'fixed'`, it asserts correct behaviour. Bug-fix commits flip a single argument per seam; they do not delete and re-add assertions.

### Journey shape (per cell)

- **FR5.** Step 1 — `prisma-next init`. The harness runs `init --{target} --{authoring}` in the empty project directory and asserts the scaffolded file set matches expectations (set of files created, key contents present).
- **FR6.** Step 2 — author. The harness applies a per-cell fixture model fragment to the scaffolded contract source (`prisma/contract.{ts,prisma}`). Fixture content is defined in **§ Per-cell fixtures**.
- **FR7.** Step 3 — emit. The harness runs `prisma-next contract emit` and asserts the emitted artefacts (`contract.json`, `contract.d.ts`) exist at the **default** output path. The default-path assertion is the **TML-2461 seam**: until TML-2461 lands, the default path is `src/prisma/contract.json` regardless of where the source lives; after TML-2461, it is colocated with the source. The fixture deliberately authors the source outside `src/prisma/` so the default-path question is non-trivial.
- **FR8.** Step 4 — `db init`. The harness runs `prisma-next db init` against the real in-process DB. For Mongo, this is the **TML-2486 seam**: until fixed, the step throws with the documented `createCollection` validator rejection; after fixed, it returns 0 and creates the expected collections.
- **FR9.** Step 5 — user query code. The harness writes a small per-cell user-code file (see § Per-cell fixtures) that performs `import` + insert + select. The imports include `ObjectId` from `@internal/mongo` (TML-2487 seam) or `control` from `@internal/postgres` (TML-2314 seam). The harness compiles and runs the file under Node with `--experimental-strip-types`. Until TML-2487 / TML-2314 land, the file fails at module-resolution; after, it runs and inserts/selects against the live DB.
- **FR10.** Step 6 — query assertion. The harness asserts the inserted row round-trips correctly (specific field values, types preserved per the contract). Round-trip is what proves the runtime API → driver → DB → driver → runtime path is end-to-end correct.
- **FR11.** Step 7 — reset. The harness invokes a programmatic DB reset (semantics in **Open Questions**: `db.reset()` if the project exposes one, otherwise drop+recreate the in-process DB instance) and asserts the DB is empty afterwards.
- **FR12.** Step 8 — schema delta. The harness applies a second per-cell fixture fragment that adds a non-nullable field with a default. This forces a real migration plan (DDL on Postgres; collection / index changes on Mongo).
- **FR13.** Step 9 — migration plan. The harness runs `prisma-next migration plan` and asserts that a non-empty plan is produced and references the new field.
- **FR14.** Step 10 — migration apply. The harness runs `prisma-next migration apply` and asserts exit 0.
- **FR15.** Step 11 — post-migration query. The harness writes a third user-code file that inserts a row using the new field and selects it back; asserts the round-trip is correct.

### Per-cell fixtures

- **FR16.** Each of the four cells has its own fixture directory under `test/integration/test/cli-journeys/fixtures/<target>-<authoring>/`. The fixture defines:
  - The initial contract source fragment (the model to add in step 2).
  - The user-code file for step 5.
  - The schema-delta fragment for step 8.
  - The post-migration user-code file for step 11.
- **FR17.** The Mongo fixtures' step-5 user-code imports `ObjectId` from `@internal/mongo` and uses it to pre-construct an `_id`. This is the canonical TML-2487 surface.
- **FR18.** The Postgres fixtures' step-5 user-code (or a sibling test in the same cell) imports `createPostgresControlClient` (or equivalent name) from `@internal/postgres/control` and uses it to invoke a control-plane operation. This is the canonical TML-2314 surface.

### CI placement

- **FR19.** The journey test lives at `test/integration/test/cli-journeys/init-journey.e2e.test.ts` (the empty `cli-journeys/` directory already exists; see Open Questions for whether to keep it here vs `test/e2e/framework/`).
- **FR20.** The test runs as part of `pnpm test:integration` and `pnpm test:e2e` (whichever owns the directory it lands in). It runs on regular PR CI; no separate scheduled job.

## Non-Functional Requirements

- **NFR1.** **Per-cell runtime budget**: 60 seconds. Aggregate across 4 cells: ≤ 4 minutes wall-clock on PR CI. Wall-clock cost is dominated by `pnpm install`; install caching via the existing pnpm store on CI is expected to keep this in range.
- **NFR2.** **No external infrastructure**: PGlite + `mongodb-memory-server` only. No docker, no networked DB.
- **NFR3.** **Deterministic**: identical results across runs. Random IDs are seeded; clock-dependent values are pinned; cell ordering does not affect outcome (each cell runs in an isolated tmpdir).
- **NFR4.** **Diagnostic output on failure**: when a step fails, the test output names the step (`step 4 — db init`), the seam (`emit → db init`), and the ticket the step is currently tracking (`currently-broken-by:TML-2486`). A reviewer scanning failed CI should locate the broken seam without reading the test source.
- **NFR5.** **Type-safe harness API**: harness helpers are fully typed; no `any`; assertion expectations carry compile-time provenance (e.g. `seamExpectation<'TML-2486'>('db-init', 'currently-broken-by:TML-2486')`).

## Non-goals

- **Test gating per individual bug fix**: each per-subsystem regression remains under its own narrow per-subsystem test where it already lives. The journey test is *additive*, not a replacement.
- **Cross-version compatibility matrix**: the journey runs against the workspace's current packages, not multiple released versions.
- **External DB drivers**: no real network postgres, no real mongo cluster. The in-process DBs are sufficient for seam verification.
- **GUI / Studio surfaces**: the journey covers the CLI + library surface only.
- **Failure-localisation diagnostics inside the journey**: when the journey fails, the existing per-subsystem tests are the diagnostic layer. The journey signals "broken seam at step N"; it does not isolate which subsystem owns the regression.

# Acceptance Criteria

- [ ] **AC1.** Running `pnpm test:integration` (or the suite that owns the file's directory) executes the new journey test, which runs all four cells and passes on `main` after this PR lands. *(Covers FR1, FR5–FR15, NFR2.)*
- [ ] **AC2.** Reverting the TML-2486 fix commit in isolation causes the journey to fail at step 4 in the two Mongo cells with a clear diagnostic naming the seam and the ticket. The Postgres cells continue to pass. *(Covers FR3, FR4, FR8, NFR4.)*
- [ ] **AC3.** Reverting the TML-2487 fix commit in isolation causes the journey to fail at step 5 in the two Mongo cells with a clear diagnostic. The Postgres cells continue to pass. *(Covers FR4, FR9, NFR4.)*
- [ ] **AC4.** Reverting the TML-2314 fix commit in isolation causes the journey to fail at step 5 in the two Postgres cells with a clear diagnostic. The Mongo cells continue to pass. *(Covers FR4, FR9, NFR4.)*
- [ ] **AC5.** Reverting the TML-2461 fix commit in isolation causes the journey to fail at step 3 in all four cells with a diagnostic about the emitted-artefact default path. *(Covers FR4, FR7, NFR4.)*
- [ ] **AC6.** Adding a *new* known-broken seam (e.g. a hypothetical TML-NNNN) to the harness as `seamExpectation('<seam>', 'currently-broken-by:TML-NNNN')` requires modifying only the cell's journey definition and (if needed) a per-cell fixture — not the harness internals. *(Covers FR3, FR4, FR16.)*
- [ ] **AC7.** Per-cell wall-clock time on CI is ≤ 60s when the pnpm store is warm; aggregate runtime ≤ 4 minutes. *(Covers NFR1.)*
- [ ] **AC8.** The journey runs against PGlite and `mongodb-memory-server` only, with no docker / external network. Confirmed by running the test in a network-isolated sandbox. *(Covers NFR2.)*
- [ ] **AC9.** A single failed step produces output of the form: *step N — <step name> · seam: <seam name> · tracked-by: TML-NNNN (or "fixed") · error: <message>*. *(Covers NFR4.)*

# Other Considerations

## Security

The journey runs only inside `os.tmpdir()` and against in-process DBs; no secrets, no network, no privileged operations. The fixture user-code files are committed test fixtures, not user-supplied. No additional security surface.

## Cost

CI cost is approximately one extra job's worth: ≤ 4 minutes per PR on the existing `test:integration` / `test:e2e` runners. No new CI machines, no external service charges. Order: a few cents per PR.

## Observability

Diagnostic output on test failure is the primary observability surface (see NFR4 / AC9). Vitest's existing reporter is sufficient; no new telemetry needed.

## Data Protection

No personal data handled. Fixture data is synthetic (`ada@example.com`-style placeholders) and lives in the test fixture directory.

## Analytics

N/A — this is internal test infrastructure.

# References

- [TML-2485](https://linear.app/prisma-company/issue/TML-2485) — the bug that motivated this work (`prisma-next init` broken under default pnpm install).
- [PR #485](https://github.com/prisma/prisma-next/pull/485) — the TML-2485 fix and the predecessor regression test (`cli.init-facade-imports.e2e.test.ts`).
- [TML-2486](https://linear.app/prisma-company/issue/TML-2486) — Mongo `createCollection` `undefined` rejection.
- [TML-2487](https://linear.app/prisma-company/issue/TML-2487) — `ObjectId` missing from `@internal/mongo`.
- [TML-2314](https://linear.app/prisma-company/issue/TML-2314) — `@internal/postgres/control` missing.
- [TML-2461](https://linear.app/prisma-company/issue/TML-2461) — `DEFAULT_CONTRACT_OUTPUT` not colocated.
- [TML-2490](https://linear.app/prisma-company/issue/TML-2490) — this ticket.
- Existing journey-ish tests: `test/e2e/framework/greenfield-setup.e2e.test.ts`, `test/e2e/framework/brownfield-adoption.e2e.test.ts`.
- Existing init tests: `test/integration/test/cli.init-templates.e2e.test.ts`, `test/integration/test/cli.init-facade-imports.e2e.test.ts`.

# Open Questions

1. **Test location: `test/integration/test/cli-journeys/` vs `test/e2e/framework/`.** The empty `cli-journeys/` directory already exists, which suggests prior intent to land journey tests there. `test/e2e/framework/` is the home of similarly-shaped workflow tests (`greenfield-setup`, etc.) but its existing fixtures use pre-built contracts rather than running `prisma-next init`. **Default assumption: `test/integration/test/cli-journeys/init-journey.e2e.test.ts`.** Implementer may move it if the test infrastructure already in `test/e2e/framework/` is a closer fit; the spec does not pin this.
2. **Real `pnpm install` mechanics.** Options: (a) run `pnpm install` against the workspace's pre-built tarballs (`pnpm pack` each touched workspace package first, then `pnpm install ./pack-*.tgz` in the tmp project), or (b) use a `link:` protocol that emulates `node-linker=isolated`. (a) is closer to a real user but slower and more setup; (b) is faster but may not faithfully reproduce TML-2485-class hoisting bugs. **Default assumption: (a)**, but the implementer should validate that the chosen mechanism actually fails on a deliberately-broken transitive import (e.g. by reverting PR #485 locally and confirming the journey breaks). If (b) suffices, prefer it for speed.
3. **`reset DB` semantics.** Does `@internal/postgres` / `@internal/mongo` expose a programmatic `db.reset()`, or does the journey teardown the in-process DB instance and re-init? **Default assumption: prefer the programmatic API if it exists; fall back to instance teardown.** Implementer to confirm against the current control-plane surface.
4. **Mongo migration parity.** The discussion assumed migration operations are symmetrical at the user POV between Postgres and Mongo. If implementation reveals that Mongo lacks `migration plan` / `migration apply` in the same shape (e.g. it's all `db init`-based for schemaless changes), the Mongo cells' steps 8–9 substitute "re-author + re-emit + re-run `db init`" for "plan + apply". Spec accepts either resolution; flag in plan if the substitution is needed.
5. **Per-cell fixture content.** The spec pins *what the fixture must exercise* (a model, an insert, a select, `ObjectId` on Mongo, `control` on Postgres, a non-nullable-default delta) but not the exact field names or model name. Implementer chooses concrete fixture content consistent with the existing `test/fixtures/contract.ts` style.
