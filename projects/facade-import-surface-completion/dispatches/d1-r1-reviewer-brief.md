# Reviewer delegation — D1 R1

> Skeleton; orchestrator fills in commit SHAs + implementer report after D1 R1 implementer completes. Sent fresh (first review round of the project).

## You are the reviewer for `facade-import-surface-completion`

You are operating under the `drive-build-workflow` skill. Your persona, protocols, read-only constraints, and verdict format are documented at `.claude/skills/drive-build-workflow/agents/reviewer.md` — re-read that first, then this prompt.

## Dispatch scope

- **Slice spec:** `projects/facade-import-surface-completion/slices/facade-completion/spec.md`
- **Slice plan:** `projects/facade-import-surface-completion/slices/facade-completion/plan.md`
- **Project spec (FRs):** `projects/facade-import-surface-completion/spec.md`
- **Code review log (your primary working artifact):** `projects/facade-import-surface-completion/reviews/code-review.md`
- **Dispatch under review:** D1 — Postgres `/migration` re-export + `defineContract` contract-builder pre-binding wrap.
- **Round number:** R1 (first review round of the project).
- **ACs in scope for promotion:** FR1, FR11 (partial — FR11 spans D1/D2/D3; D1 lands the Postgres facet).
- **Implementer brief (read-only context):** `projects/facade-import-surface-completion/dispatches/d1-brief.md`

## What changed since the last review

**New commits this round:**

- `5058518f2` — `feat(@internal/postgres): add /migration re-export with parity tests`
- `9ff5d1533` — `feat(@internal/postgres): wrap defineContract to pre-bind family and target`

Pull the diff via `git diff cd82609fd..HEAD` (base = the commit immediately before D1 R1 started; HEAD = `9ff5d1533`).

**Implementer's structured report follows.** Use it for context and to know what to triage; do **not** use it as primary evidence.

```text
D1 is done. Here's a summary of what was delivered:

Commit 1 — /migration re-export
- src/exports/migration.ts: single `export * from '@internal/target-postgres/migration'`
- tsdown.config.ts: migration entry point added
- package.json: `./migration` exports entry
- architecture.config.json: new file registered
- test/migration/re-export.test.ts: 12 parity tests verifying all named exports match the target module

Commit 2 — defineContract wrap
- src/contract/define-contract.ts: two-overload wrapper (definition form + factory form) that pre-binds
  sqlFamilyPack and postgresPack before delegating to the base function. Return type is
  ReturnType<typeof baseDefineContract<SqlFamily, PostgresPack>> — portable and resolves
  target: 'postgres' and targetFamily: 'sql' as literals.
- src/exports/contract-builder.ts: now re-exports the wrapped defineContract
- test/contract-builder/define-contract.test.ts: 4 runtime tests covering both forms and
  extensionPacks: undefined
- test/contract-builder/define-contract.test-d.ts: type tests rejecting family/target in input
  and asserting literal return types

68 tests pass, clean build, clean typecheck, clean lint:deps.
```

**Diff stat** (`git diff cd82609fd..HEAD --stat`):

```text
 architecture.config.json                                            |  6 ++
 packages/3-extensions/postgres/README.md                            | 30 ++++++-
 packages/3-extensions/postgres/package.json                         |  1 +
 packages/3-extensions/postgres/src/contract/define-contract.ts      | 91 ++++++++++++++++++++++
 packages/3-extensions/postgres/src/exports/contract-builder.ts      |  2 +-
 packages/3-extensions/postgres/src/exports/migration.ts             |  1 +
 packages/3-extensions/postgres/test/contract-builder/define-contract.test-d.ts | 16 ++++
 packages/3-extensions/postgres/test/contract-builder/define-contract.test.ts   | 41 ++++++++++
 packages/3-extensions/postgres/test/migration/re-export.test.ts     | 55 +++++++++++++
 packages/3-extensions/postgres/tsdown.config.ts                     |  1 +
 10 files changed, 242 insertions(+), 2 deletions(-)
```

## Items to triage

The implementer's report may flag items for verdict. For each, your verdict is one of: Accept / File as F<N> / Escalate.

Specific items the orchestrator wants you to look at independently of the implementer's flagging:

- **The wrapped `defineContract`'s generic signature, especially the 2-param `PostgresBaseResult`.** D1's one design judgment. The implementer wrote `type PostgresBaseResult = ReturnType<typeof baseDefineContract<SqlFamily, PostgresPack>>` (see `packages/3-extensions/postgres/src/contract/define-contract.ts` L46-47, comment: _"Using only 2 type params keeps the type chain portable and resolves target: 'postgres'"_). The base `defineContract` takes more type params for `Types`, `Models`, `ExtensionPacks`, `Capabilities`. By only passing 2 here, the wrap's return type is structurally less specific than the base would produce at a fully-parameterised call site. **Your task:** verify that this doesn't degrade call-site inference for downstream `Types`/`Models`/`ExtensionPacks`/`Capabilities` (e.g. that `schema(contract).models.X` still resolves to the right model shape after a fully-loaded `defineContract({ models: ..., types: ..., extensionPacks: ... })`). If inference degrades, it's `must-fix`. If it compiles but the downstream type is `any`/`unknown`/lossy on any of `Types`/`Models`/`ExtensionPacks`/`Capabilities`, it's `must-fix`. If the 2-param approach is genuinely necessary (e.g. base has cyclical type constraints D1 had to break), `Accept` with reasoning recorded under `## For orchestrator`.
- **The `family`/`target` drop from input type.** Verify the type-level negative test asserts `family` and `target` are NOT accepted by the wrap. A wrap that accepts both (even if it discards them at runtime) defeats FR11's intent.
- **No regression to other `@internal/postgres/contract-builder` re-exports.** Verify `field`, `model`, `rel`, and the type re-exports still flow through unchanged.
- **`architecture.config.json` entry.** Verify the new `/migration` entry's `domain`/`layer`/`plane` triplet matches the existing `/contract-builder` or `/control` entries' plane convention for migration-side exports.
- **README updates.** Verify both the new `/migration` section in the Exports list AND the updated `/contract-builder` section's example reflect the new no-family/target shape.

## Acceptance bar for SATISFIED (D1)

Use the checklist in `.claude/skills/drive-build-workflow/agents/reviewer.md § The acceptance bar for SATISFIED`. For D1 specifically:

- **FR1 PASS:** `@internal/postgres/migration` re-exports `Migration`, `MigrationCLI`, `placeholder`, `dataTransform`, the documented op-factory surface. Evidence = parity test commit + test file path.
- **FR11 (Postgres facet) PASS:** wrapped `defineContract` pre-binds family + target, drops them from the input type, preserves inference. Evidence = wrap-shape test commit + test file path.
- All "Done when" gates from the D1 brief pass (`pnpm build --filter @internal/postgres`, `pnpm typecheck --filter @internal/postgres`, `pnpm test:packages --filter @internal/postgres`, `pnpm lint:deps`, workspace-wide `pnpm typecheck`, the brief's grep gates).
- Transient-ID scan emits zero hits against the `+` diff.

D2's items (mongo) and D3's items (sqlite) are **out of scope** for this round. Their ACs (FR2, FR3, FR4–FR7, FR10) stay `NOT VERIFIED — D<x> R1 pending`.

## Findings discipline

`code-review.md § Findings log` is a work backlog for the implementer's next round, not an observation journal. Every finding must be addressable in this PR by the implementer. No `informational` severity. See `.claude/skills/drive-build-workflow/agents/reviewer.md § Findings discipline`.

## Round-entry format

Append a single block under `## Round notes` in `code-review.md` using the format in `agents/reviewer.md § Round-entry format`. Three lines plus heading is the target.

## Read-only constraint reminder

You may **only** modify `projects/facade-import-surface-completion/reviews/code-review.md` and `wip/heartbeats/reviewer.txt`. Do **not** edit code, tests, `spec.md`, `plan.md`, the slice spec/plan, or the D1 brief. Do **not** produce `system-design-review.md` or `walkthrough.md`.

## Heartbeats

Write to `wip/heartbeats/reviewer.txt` per `agents/reviewer.md § Heartbeats`. `mkdir -p wip/heartbeats` once at round start; overwrite each ping.

## Return shape

Structured response per `agents/reviewer.md § Return shape`. No prose narrative.

Begin.
