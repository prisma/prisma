# D5c R1 — Reviewer brief

You are reviewing **dispatch D5c R1** of the `facade-import-surface-completion` slice. D5c's scope is architectural cycle-breaking: move pgvector-dependent (and analogous mongo-contract-ts-dependent) tests out of `packages/*/test/` and into `test/integration/`, then drop the offending `devDependencies` from the package manifests. The cycle being broken is `@internal/postgres` → `@internal/sql-builder` → `@internal/extension-pgvector` → (would-be) `@internal/postgres`, which currently blocks D5d from migrating `pgvector`/`postgis`/`mongo-runtime` `src/contract.ts` to facade-form imports.

Critically: D5c is **a pre-requisite for D5d**, so your role is to confirm the cycle is verifiably broken AND that no test coverage was lost in the move (no skips, no broad `as unknown as` casts, no scope creep).

## Read first

1. **`projects/facade-import-surface-completion/spec.md`** — slice scope (especially the in-flight § A7 exemption that D5d will remove)
2. **`projects/facade-import-surface-completion/slices/facade-completion/plan.md`** § "D5c" — Done-when checklist
3. **`projects/facade-import-surface-completion/dispatches/d5c-brief.md`** — original implementer brief (you're reviewing against this contract)
4. **`projects/facade-import-surface-completion/reviews/code-review.md`** — D5c R1 orchestrator notes including:
   - `### D5c R1 — sonnet-low banned; model floor raised` — the implementer transition (sonnet-low banned mid-dispatch, fresh composer-2.5-fast agent finished the remainder)
   - Operator's architectural directive: "Delete the dependencies that violate the architectural layering, from sql builder -> pgvector etc."

## Commit range

```
82e4e7105  refactor(@internal/sql-builder): move playground tests to integration, drop pgvector devDep
8d86ea44b  refactor(@internal/sql-orm-client): move pgvector-dependent tests to integration, drop pgvector devDep
cdedc86cb  refactor(@internal/mongo-runtime): move query-builder test to integration, drop mongo-contract-ts devDep
fb45ba05e  refactor(@internal/sql-orm-client): move pgvector model-accessor tests to integration
ad692094d  fix(@internal/sql-orm-client): align package test fixture with postgres-only runtime
```

Use `git log --oneline f73787e16..HEAD` and `git diff f73787e16..HEAD --stat` to scope your review. (`f73787e16` is the last project artifact commit before D5c implementation started.)

## Required verifications

### Architectural

1. **Cycle is verifiably broken.** From the structured return:
   - Before D5c: `Cyclic dependency detected: @internal/extension-pgvector, @internal/sql-builder, @internal/sql-orm-client, @internal/postgres` (per D5a R1).
   - After D5c (transient experiment, reverted): adding `"@internal/postgres": "workspace:0.9.0"` to `packages/3-extensions/pgvector/package.json` devDeps + `pnpm install` + `pnpm typecheck --filter @internal/extension-pgvector` returns **exit 0**.

   You must independently re-run this experiment to confirm. Steps:
   - Add the transient devDep to `packages/3-extensions/pgvector/package.json`.
   - `pnpm install`.
   - `pnpm typecheck --filter @internal/extension-pgvector` — must succeed.
   - **Revert** the devDep + re-run `pnpm install` before signing off.
   - Capture the typecheck command's exit code as evidence in your verdict.

2. **The three offending devDeps are actually dropped.** Read these three `package.json`s and confirm:
   - `packages/2-sql/4-lanes/sql-builder/package.json` — no `@internal/extension-pgvector` in `devDependencies`.
   - `packages/3-extensions/sql-orm-client/package.json` — no `@internal/extension-pgvector` in `devDependencies`.
   - `packages/2-mongo-family/7-runtime/package.json` — no `@internal/mongo-contract-ts` (or whichever the cycle-causing dep was — confirm against `cdedc86cb`'s diff).

### Test relocation hygiene (CRITICAL)

3. **No `it.skip` / `describe.skip` markers anywhere in the moved tests.** Grep:
   ```bash
   rg -n '\b(it|describe|test)\.skip\b' test/integration/test/sql-orm-client/ test/integration/test/sql-builder/ test/integration/test/mongo/
   ```
   If any new skip markers appeared in the D5c diff (compare against `f73787e16`), that's a regression — the prior sonnet-low implementer was banned specifically for skipping pgvector-dependent tests instead of moving them.

4. **No broad `as unknown as Record<string, unknown>` (or similar) casts in the moved test bodies.** Grep:
   ```bash
   rg -n 'as unknown as' test/integration/test/sql-orm-client/model-accessor.pgvector.test.ts test/integration/test/sql-builder/ test/integration/test/mongo/
   ```
   Narrow type-specific casts (e.g. `as InsertAst<...>`) that were already there pre-D5c are fine. Broad object-shape escape hatches that mask "this test belongs elsewhere" are not.

5. **The model-accessor split is clean.** Compare `packages/3-extensions/sql-orm-client/test/model-accessor.test.ts` against its `f73787e16` state. Tests still in the package should be **non**-pgvector (no `cosineDistance` references, no `'embedding'` field accessor as a method, no `'extension operations'` describe block content that touches pgvector). Tests in `test/integration/test/sql-orm-client/model-accessor.pgvector.test.ts` should be the inverse — all the pgvector-coupled cases. **No test was deleted outright.**

6. **`packages/3-extensions/sql-orm-client/test/simplify-deep.test-d.ts` is unchanged in semantic content.** Type-only assertions can keep `embedding: number[] | null` because the hand-edited `contract.d.ts` still defines `embedding` as `number[] | null`. Diff vs `f73787e16` should show either zero change or only formatting.

### Gates

7. Re-run these gates (the structured return claims green on all):
   - `pnpm typecheck --filter @internal/sql-orm-client`
   - `pnpm typecheck --filter @internal/sql-builder`
   - `pnpm typecheck --filter @internal/mongo-runtime`
   - `pnpm test --filter @internal/sql-orm-client`
   - `pnpm test --filter @internal/sql-builder`
   - `pnpm test --filter @internal/mongo-runtime`
   - `pnpm test:integration test/sql-orm-client/model-accessor.pgvector.test.ts`
   - `pnpm lint:deps`

   For each, record PASS/FAIL + test count. Treat workspace-wide `pnpm test` and `pnpm test:integration` (full suite) as **out of scope** for this round — they're known red until D5d closes (per the D5/D5a notes), and chasing those failures here is scope creep.

### Scope guard

8. **No facade source changed.** D5c should NOT have touched `packages/3-extensions/{postgres,mongo,sqlite}/src/` — confirm via:
   ```bash
   git diff f73787e16..HEAD --stat -- packages/3-extensions/postgres/src/ packages/3-extensions/mongo/src/ packages/3-extensions/sqlite/src/
   ```
   Should be empty.

9. **No extension-pack `src/contract.ts` migrated.** D5d will do that; D5c must leave `packages/3-extensions/{pgvector,postgis}/src/contract.ts` and `packages/2-mongo-family/7-runtime/src/contract.ts` (or wherever the mongo equivalent is) on their verbose pre-facade imports.

## Your verdict

Append a **`### D5c R1 — reviewer verdict`** section to `projects/facade-import-surface-completion/reviews/code-review.md` containing:

- Verdict line: `SATISFIED` / `SATISFIED WITH FINDINGS [F#]` / `NOT SATISFIED`
- Cycle-broken evidence with command + exit code captured
- Per-check pass/fail table for the eight verifications above (architectural, hygiene, gates, scope)
- Any findings as new `F#` entries (next free number is `F4`; F1/F2/F3 are taken — see prior orchestrator notes)
- If SATISFIED, a one-paragraph go/no-go for D5d

**Heartbeat** to `wip/heartbeats/reviewer.txt` every ~5 min using format `ts`, `role: reviewer`, `agent_id` (your own), `round=D5c R1`, `phase`, `last_progress`, `next_step`.

**Structured return** at end: verdict, gate command outputs, the cycle-broken exit-code evidence (load-bearing for D5d), any F# entries with file:line citations.

## Begin

Heartbeat with `phase: orienting`, read the project context, then execute the eight verifications.
