# Dispatch brief — D1: Postgres `/migration` + contract-builder pre-binding

## Context (≤ 1 paragraph)

You are working on the **`facade-completion`** slice of the **`facade-import-surface-completion`** project. The project's purpose: close the gaps that force users of `@internal/postgres` to reach into internal `@internal/target-postgres/*`, `@internal/family-sql/*`, `@internal/sql-*`, `@internal/cli/*` packages. This is D1 — the first dispatch. No prior dispatches have landed; the workspace is at HEAD of branch `tml-2526-facades-must-re-export-everything-users-import-in-their-app`.

## Inputs (read these first)

- **Slice spec:** [`projects/facade-import-surface-completion/slices/facade-completion/spec.md`](../slices/facade-completion/spec.md)
- **Slice plan (your dispatch is the "Dispatch 1" section):** [`projects/facade-import-surface-completion/slices/facade-completion/plan.md`](../slices/facade-completion/plan.md)
- **Project spec (FRs your work pins):** [`projects/facade-import-surface-completion/spec.md`](../spec.md) — specifically FR1 + FR11.
- **Code review log (read-only for you; orchestrator owns):** [`projects/facade-import-surface-completion/reviews/code-review.md`](../reviews/code-review.md)
- **Implementer persona + protocols:** `.claude/skills/drive-build-workflow/agents/implementer.md` — re-read this first.
- **Failure modes to thread (read each, then apply mitigations):** [`drive/calibration/failure-modes.md`](../../../drive/calibration/failure-modes.md) — specifically:
  - **F3** (Discovery via test suite instead of grep) — pre-compute consumer-impact greps; don't iterate `pnpm test:packages` for discovery.
  - **F4** (Feature-sized dispatch with no inspection cadence) — D1 is M; if you find yourself spawning more than ~10 files of changes, surface to orchestrator immediately.
  - **F5** (Destructive git operations) — **forbidden without orchestrator approval**: no `git clean -f*`, no `git reset --hard`, no `git stash drop/clear`, no `git checkout -- .`, no `git rm -r --force`, no `rm -rf` against the worktree.
- **Reference façade:** [`packages/3-extensions/postgres/`](../../../packages/3-extensions/postgres/) — the most-complete façade; D1's work mirrors its existing patterns.
- **Base `defineContract` signature (mirror this for the wrap):** [`packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts`](../../../packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts) L162–L290 (three overloads + impl).

## Intent (1–3 sentences)

Add two surface additions to `@internal/postgres` only:

1. **`@internal/postgres/migration`** — a re-export of `@internal/target-postgres/migration` (one-line `export *`).
2. **Wrap `defineContract`** exposed at `@internal/postgres/contract-builder` so it pre-binds `family: sqlFamily` + `target: postgresPack` internally and drops both from the input scaffold's type. Users writing a Postgres contract should write `defineContract({ extensionPacks, ... })` (or `defineContract(scaffold, factory)`) — never pass `family`/`target` again.

**What stays the same:** every other re-export from `@internal/postgres/contract-builder` (`field`, `model`, `rel`, all type re-exports). Other façade subpaths. The renderer (D4 owns that flip). Anything in `packages/3-targets/`, `packages/2-sql/`, `packages/1-framework/`, `examples/`. The renderer continues to emit `@internal/target-postgres/migration` for now — the `/migration` re-export is additive; the renderer flip is D4.

## Files in play

**New files:**

- `packages/3-extensions/postgres/src/exports/migration.ts` — one-line `export * from '@internal/target-postgres/migration';` (mirror `packages/3-extensions/postgres/src/exports/family.ts` for file shape if present, otherwise minimal).
- `packages/3-extensions/postgres/src/contract/define-contract.ts` — new directory + file. Wrapped `defineContract` that:
  - Imports `sqlFamily` from `@internal/family-sql/pack` (default export) and `postgresPack` from `@internal/target-postgres/pack` (default export).
  - Imports `defineContract as baseDefineContract` from `@internal/sql-contract-ts/contract-builder`.
  - Re-implements the three-overload signature from `packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts` L162–L290 with `Family` and `Target` generics fixed to `typeof sqlFamily` and `typeof postgresPack` (drop them from the input `ContractDefinition` / `ContractScaffold` type via `Omit<..., 'family' | 'target'>` so users cannot accidentally pass them).
  - Calls `baseDefineContract({ family: sqlFamily, target: postgresPack, ...scaffold }, factory?)`.
- `packages/3-extensions/postgres/test/migration/re-export.test.ts` — named-export parity test (see "Test design" below).
- `packages/3-extensions/postgres/test/contract-builder/define-contract.test.ts` — wrap-shape test (see "Test design" below).

**Modified files:**

- `packages/3-extensions/postgres/src/exports/contract-builder.ts` — change the line that re-exports `defineContract` from `@internal/sql-contract-ts/contract-builder`. Replace it with `export { defineContract } from '../contract/define-contract';`. Keep every other re-export untouched (`field`, `model`, `rel`, `buildSqlContractFromDefinition`, all the `type` re-exports).
- `packages/3-extensions/postgres/package.json` — add `"./migration": "./dist/migration.mjs"` to the `exports` map (mirror the alphabetical placement of the existing `"./contract-builder"`, `"./control"`, etc. entries).
- `packages/3-extensions/postgres/README.md` — add `### @internal/postgres/migration` section to the "Exports" list; update the `### @internal/postgres/contract-builder` section's example to show the new no-family/target shape.
- `architecture.config.json` — add a single entry for `packages/3-extensions/postgres/src/exports/migration.ts`. Mirror the existing `packages/3-extensions/postgres/src/exports/contract-builder.ts` entry's `domain`/`layer`/`plane` triplet. (Inspect that entry to confirm; do not guess.)

**Out of scope for D1 (do not touch):**

- Anything under `packages/3-extensions/mongo/`, `packages/3-extensions/sqlite/`.
- Anything under `packages/3-targets/3-targets/postgres/src/core/migrations/` (renderer change is D4).
- Any other `architecture.config.json` entry.
- Any `examples/*` file.
- Any other test file in the project.

## Test design

### Parity test for `/migration` re-export

`packages/3-extensions/postgres/test/migration/re-export.test.ts`:

- Import all named exports from `@internal/target-postgres/migration` (via a wildcard import or by enumerating the known surface from `packages/3-targets/3-targets/postgres/src/exports/migration.ts`).
- Import all named exports from `@internal/postgres/migration`.
- Assert the two surfaces have the same named exports (use `Object.keys(...).sort()` equality or enumerate every expected symbol explicitly — judgment call; explicit enumeration is more failure-mode-friendly).
- At minimum, assert that `Migration`, `MigrationCLI`, `placeholder`, `dataTransform`, `createTable`, `addColumn`, `dropTable`, `rawSql`, `setNotNull`, `createIndex`, `installExtension` are re-exported (sample the known surface — these are the ones the planner and extension-pack migrations use).

### Wrap-shape test for the contract-builder

`packages/3-extensions/postgres/test/contract-builder/define-contract.test.ts`:

- **Test 1 (positive — no factory form):** Call `defineContract({ extensionPacks: {} })` (or with `extensionPacks: undefined` if that's the working shape). Assert it returns a `SqlContractResult<...>` whose `definition.family.id === 'sql'` and `definition.target.id === 'postgres'` (inspect the base `defineContract`'s return shape to find the actual property paths — verify by reading `buildSqlContractFromDefinition` first).
- **Test 2 (positive — factory form):** Call `defineContract({ extensionPacks: {} }, ({ field, model }) => ({ models: { Foo: model('Foo', { fields: { id: field.id.uuidv4() } }) } }))`. Assert the returned contract has the `Foo` model.
- **Test 3 (negative — type-level):** in a `.test-d.ts` sibling file (`define-contract.test-d.ts`), assert that the wrapped `defineContract`'s input type does NOT have `family` or `target` keys. Use `expectError` from a tsd-equivalent helper, or use `@ts-expect-error` against the *no* policy — actually, per AGENTS.md, `@ts-expect-error` is allowed in negative type tests, so use it. Sample assertion:
  ```ts
  // @ts-expect-error — family is no longer accepted; the facade pre-binds it
  defineContract({ family: sqlFamily, extensionPacks: {} });
  // @ts-expect-error — target is no longer accepted; the facade pre-binds it
  defineContract({ target: postgresPack, extensionPacks: {} });
  ```
- **Test 4 (positive — type inference):** assert that the returned contract's type carries the literal `'sql'` family-ID and `'postgres'` target-ID. A `Equal<...>` type-helper assertion is fine.

## "Done when" gates (this dispatch)

Run only **once** at end-of-round (per implementer protocol § Test execution discipline). During iteration, run only the test files you're actively editing.

- [ ] `pnpm build --filter @internal/postgres` — clean.
- [ ] `pnpm typecheck --filter @internal/postgres` — clean.
- [ ] `pnpm test:packages --filter @internal/postgres` — clean. New parity + wrap-shape tests pass.
- [ ] `pnpm lint:deps` — clean. Validates the new `architecture.config.json` entry.
- [ ] **Cross-package typecheck sanity (because D1 changes a public type — the wrapped `defineContract`'s signature):** `pnpm typecheck` workspace-wide. Should be clean — the verbose form still works at runtime (we're only narrowing the input *type* on the wrap; existing callers passing `{ family, target, ... }` will fail TS and that's the point). Surface any breakage to orchestrator.
- [ ] **Grep gate:** `rg "@internal/postgres/migration" packages/3-extensions/postgres/` returns at least 2 hits (the new export file + the new test file + the new README section).
- [ ] **Grep gate:** the new wrapped `defineContract` doesn't accidentally re-export the base one. `rg "from '@internal/sql-contract-ts/contract-builder'" packages/3-extensions/postgres/src/exports/contract-builder.ts` should NOT include `defineContract` in the named imports.
- [ ] **Transient ID gate (run before declaring done):** the script from `agents/implementer.md § No transient project IDs in code` against your `+` diff returns empty.
- [ ] **Intent-validation (orchestrator-applied):** diff matches "Postgres `/migration` re-export + contract-builder wrap"; no out-of-scope surfaces touched.

## Edge cases (from slice spec; D1's portion)

- **Existing user-authored `migration.ts` files in user repos still import `@internal/target-postgres/migration`.** Disposition: the `target-postgres/migration` export stays in place forever (this is NFR2). The parity test catches drift if any target export drops out.
- **Mongo + SQLite façades not yet wrapped.** Disposition: D1 doesn't touch them. The wrap is per-facade.
- **Destructive git operations forbidden.** Disposition: F5 above. No `git clean -f*`, etc.

## Edge cases (from this brief, dispatch-specific)

- **The wrap's generic signature is the one design judgment in this dispatch.** Mirror the base `defineContract`'s three overloads — don't oversimplify to a single signature that loses inference. If you find yourself unable to mirror the overloads cleanly, surface to orchestrator (don't ship a degraded type).
- **`postgresPack` and `sqlFamily` may not be default exports.** Verify by reading `packages/3-targets/3-targets/postgres/src/exports/pack.ts` and `packages/2-sql/9-family/src/exports/pack.ts` (or wherever they live) before importing.
- **The base `defineContract` validates input shape with `isContractInput`.** Confirm the wrapped scaffold (after splatting family + target in) still passes that check. Add a smoke run if unsure.

## Constraints

- **Tests-first** per AGENTS.md ("Always write tests before creating or modifying implementation"). Write the parity test + wrap-shape test first (they'll fail), then add the implementation.
- **Explicit-staging commits only.** No `git add -A` / `git add .` / `git add :/`.
- **No amend** unless orchestrator authorizes.
- **No push** without explicit authorization.
- **Commit organization:** two atomic commits suggested:
  - Commit 1: `/migration` re-export + parity test + `package.json` exports entry + `architecture.config.json` entry + README "Exports" list update.
  - Commit 2: contract-builder wrap + wrap-shape test + `.test-d.ts` + README "contract-builder" section update.
  If a different split reads cleaner, use it and surface the choice.
- **Side-quests:** none authorized.
- **Read-only constraints:** do not edit `projects/facade-import-surface-completion/reviews/`, `projects/facade-import-surface-completion/spec.md`, `projects/facade-import-surface-completion/slices/facade-completion/spec.md`, or `projects/facade-import-surface-completion/slices/facade-completion/plan.md`.

## Heartbeats

Write to `wip/heartbeats/implementer.txt` per `agents/implementer.md § Heartbeats`. At round start, before/after every long-running shell call, at each task / commit boundary, and at least every ~5 min otherwise.

`mkdir -p wip/heartbeats` once at round start; overwrite the file each ping. The orchestrator reads it between turns to detect a stalled round.

## Deferral protocol

You may not unilaterally defer. If you hit a blocker:

- Concretely identify (file, line, test, architectural fact).
- Surface: "Task <X> is blocked by <blocker>. Options: <a>, <b>. I recommend <choice> because <rationale>. Awaiting decision."
- Pause that task; continue independent ones if any.

The single exception is task-description ambiguity: pick the interpretation most consistent with the spec + this brief, document the choice, continue.

## Return shape

Final message structured as:

1. **Pre-implementation reconnaissance** — what you found reading the base `defineContract`, the existing facade `contract-builder.ts`, the pack files. Anything that informed scoping.
2. **Decisions made** — the wrap's generic signature shape; the test enumeration vs `Object.keys` choice; any ambiguity resolutions.
3. **Diff highlights** — the wrap's signature; the test file structure.
4. **Validation results** — every "Done when" gate, pass/fail, with the commands you ran.
5. **Commit SHAs** — both commits with subject lines.
6. **Anything surprising** — pre-existing issues; gaps in the existing facade structure.
7. **Deferral requests** — if any.
8. **Pushback** — N/A round 1.

Begin.
