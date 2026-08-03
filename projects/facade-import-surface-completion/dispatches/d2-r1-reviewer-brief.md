# Reviewer resume — D2 R1

## Resume — `facade-import-surface-completion`, D2 R1

> You are being resumed. You retain your full prior transcript including the AC scoreboard you maintain, F1 (resolved in D1 R2), and your two prior verdicts. Trust your prior transcript; reconcile from on-disk `code-review.md` only where the orchestrator made between-round edits visible under `## Orchestrator notes` — this round there's a new orchestrator note (`### D2 R1 — implementer structured report missing; orchestrator ran gates locally`); read it before you start.

## What changed since the last review

**New commits this round (4 commits, +410/-24 across 16 files):**

- `91eeabb90` — `feat(@internal/mongo): extend MongoConfigOptions for extensions + migrations.dir`
- `23e3f5228` — `feat(@internal/mongo): add /control subpath`
- `7e4e30001` — `feat(@internal/mongo): add /bson subpath and drop "." barrel`
- `89820093e` — `feat(@internal/mongo): wrap defineContract to pre-bind family and target`

Pull the diff via `git diff 588e31092..89820093e` (base = D1's tip; HEAD = `89820093e`).

**Implementer's structured report is MISSING.** The subagent reported `DONE` to its heartbeat at 09:56:06 CEST but never returned a structured response; a 15-min resume window produced no further output. The orchestrator note in `code-review.md` records the situation and the validation-gate results the orchestrator ran directly. Treat on-disk source + the orchestrator's gate output as your primary evidence; no implementer-side rationale exists for this round.

## Items to triage

The orchestrator does not have an implementer flag list this round (no structured report). The items the orchestrator wants you to look at independently:

- **Wrap signature shape** (`packages/3-extensions/mongo/src/contract/define-contract.ts`). The brief told the implementer mongo's `defineContract` is structurally simpler than SQL's (single `const Definition` param, no `attributesFactory` contravariance, no `ModelLike` lift needed). The implementer's wrap uses `const Definition extends MongoDefinitionInput` on overload 1, `Definition & Built` on overload 2, with literal pinning via `& { family: MongoFamilyPack; target: MongoTargetPack }` intersection. **Your task:** verify this approach preserves model-shape inference (the test asserts both `withModel.models['User'].not.toBeNever()` and `withFactory.models['Post'].not.toBeNever()` — are those non-tautological under this signature?), and verify the `family?: never; target?: never;` "forbidden field" pattern at L33-34 and L41-42 actually drives the `@ts-expect-error` assertions to fire (vs the simpler `Omit` that D1 used for SQL). If the `?: never` is structurally redundant given the `Omit`, that's a `low / process` finding to simplify it; if it's necessary because of how `const Definition` resolves through `Omit`, accept and move on.

- **`createMongoControlClient` SPI shape** (`packages/3-extensions/mongo/src/exports/control.ts`). Mirror of Postgres precedent. `MongoControlClientOptions` exposes `connection?: string` and `extensionPacks?: ControlClientOptions['extensionPacks']`. Verify against the Postgres equivalent (`packages/3-extensions/postgres/src/exports/control.ts`) — the user-facing surface should match Postgres so apps switching targets don't hit gratuitous shape differences. The `ifDefined`-based conditional spreading idiom matches Postgres; accept if so.

- **BSON inventory** (`packages/3-extensions/mongo/src/exports/bson.ts` and `test/bson/re-export.test.ts`). The new `/bson` exports `{ Binary, Decimal128, Long, MongoClient, ObjectId, Timestamp }`. The deleted `src/exports/index.ts` previously re-exported the same 6 symbols (verified by orchestrator via `git show 588e31092:packages/3-extensions/mongo/src/exports/index.ts`). **Your task:** confirm the parity test asserts the *exact* set (no missing constructors, no extras that shouldn't be public). If the parity test is structural-equality based, that's strongest.

- **`@internal/cli` workspace-dep addition** (`packages/3-extensions/mongo/package.json` + `pnpm-lock.yaml`). The new `/control` subpath imports `createControlClient` from `@internal/cli/control-api`, requiring the dep. Same dep pattern D3's plan section already calls for in SQLite. The brief didn't explicitly call out the dep addition; verify (a) `pnpm lint:deps` stays clean (the orchestrator confirmed: 955 modules cruised, no violations); (b) the dep direction is acceptable per the architecture rules (facade → CLI is allowed by `architecture.config.json`'s layer ordering).

- **Architecture config additions** (`architecture.config.json`). New entries for `mongo/src/exports/control.ts`, `mongo/src/exports/bson.ts`, `mongo/src/contract/define-contract.ts`. Confirm planes match Postgres's mirror entries (control = migration; bson = shared; contract = shared).

- **Barrel removal completeness.** The barrel file (`src/exports/index.ts`) deleted; `"."` entry removed from `package.json` exports. Grep gate from brief: `rg "from '@internal/mongo'(?!/)" packages/ examples/ test/` returns zero hits. Orchestrator verified: zero hits across `examples/` (no examples used barrel-form imports, so the conditional 5th commit was vacuously satisfied — that's why only 4 commits landed, not 5).

- **README user-migration note.** The brief required calling out the breaking import-path change (`import { ObjectId } from '@internal/mongo'` → `from '@internal/mongo/bson'`). Verify it's present and clear enough for an outside user to apply.

## Acceptance bar for SATISFIED (D2)

Use the checklist in `.claude/skills/drive-build-workflow/agents/reviewer.md § The acceptance bar for SATISFIED`. For D2 specifically:

- **FR2 PASS:** `MongoConfigOptions` accepts `extensions` and `migrations.dir`; both threaded to the underlying config. Evidence = `define-config.test.ts` cases.
- **FR3 PASS:** `@internal/mongo/control` exports `createMongoControlClient`. Evidence = the new test + the import-flowthrough check.
- **FR10 PASS:** `@internal/mongo` `package.json` has no `"."` entry; BSON moved to `/bson` with parity to the deleted barrel's surface. Evidence = the new `/bson` parity test + grep gate.
- **FR11 (mongo facet) PASS:** wrapped `defineContract` pre-binds family + target, drops them from input type, preserves model-shape inference (positive `not.toBeNever()` assertions cover both forms). Evidence = `define-contract.test-d.ts` + your inspection.
- All "Done when" gates pass — the orchestrator ran build, typecheck, test, lint:deps locally; results in the new orchestrator note. Re-run any you want to verify independently.
- Transient-ID scan emits zero hits against the `+` diff.
- The brief's `pnpm-lock.yaml` change is intentional (`@internal/cli` dep for `/control`).

D3 (SQLite), D4 (renderer flip), D5 (examples), D6 (docs) stay out of scope.

## Anything that has changed in your operating context

- **The branch-level `pnpm typecheck` is still red from D1's `family:`/`target:` drop.** Unchanged from the post-D1 note. D2 added no new examples-side regression. Continue to treat workspace-wide typecheck as out-of-scope for D2 SATISFIED.
- **The implementer's heartbeat discipline is still broken** (2 pings across the round). This is procedural calibration, not a finding. The orchestrator is tracking it for D3.
- **The orchestrator ran gates directly this round** — you can re-run any of them if you want independent verification, but you're not obliged to. The implementer's report being missing means there's no first-person rationale to either trust or distrust; the on-disk source is your authoritative evidence.

## Reminders (terse)

- Findings must be addressable in this PR.
- F-numbers durable; don't reuse F1's slot.
- Three-line-plus-heading round entry is the target.
- Heartbeats to `wip/heartbeats/reviewer.txt` on the usual cadence.

Begin.
