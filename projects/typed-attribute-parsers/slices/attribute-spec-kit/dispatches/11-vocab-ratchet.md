# Brief: D11 — satisfy the framework-vocabulary ratchet (post-rebase)

> On the rebased slice-1 branch `tml-2956-typed-attribute-parsers`. Main's new PR #918 added `pnpm lint:framework-vocabulary` (`scripts/lint-framework-vocabulary.mjs` + `.config.json`), which forbids family terms from growing in `packages/1-framework`. Our new code trips it by **+3** (count 970 vs threshold 967) — all false positives. Fix honestly, minimize any threshold bump. Do NOT push or touch GitHub.

## The 3 false-positive hits (all in `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/types.ts`)
1. Line ~5 — `import type { …, SymbolTable } from '../symbol-table'` → matches "table".
2. Line ~39 — `readonly symbols: SymbolTable;` on `InterpretCtx` → matches "table".
3. Line ~100 — doc comment "…a constraint would reject every spec…" → matches "constraint" (it means a TypeScript generic bound, not SQL CONSTRAINT).

## Tasks
### T1 — Remove the dead `InterpretCtx.symbols` field
`InterpretCtx.symbols: SymbolTable` is **never read** anywhere in the attribute-spec kit (combinators resolve via `selfModel` / `resolveReferencedModel()`; verify with `rg "\\.symbols" packages/1-framework/2-authoring/psl-parser/src/attribute-spec`). Remove it:
- Delete the `symbols: SymbolTable` field from `InterpretCtx` in `types.ts`, and drop `SymbolTable` from that file's `../symbol-table` import (keep `FieldSymbol`, `ModelSymbol` — still used). This also tightens the "deliberately lean" ctx as its own doc claims.
- In `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts`, `buildRelationInterpretCtx` sets `symbols: input.symbols` — remove that property from the returned ctx. Keep the `input.symbols` parameter (the `resolveReferencedModel` closure still captures it). Confirm no other `InterpretCtx` construction sets `symbols`.

### T2 — Reword the "constraint" prose
In `types.ts`, the `InferAttr` doc comment uses "constraint" for a TS generic bound. Reword to a framework-neutral term (e.g. "an upper bound would reject" / "a type bound would reject") — behaviour-neutral, and honestly avoids an SQL-ish word in a framework package.

### T3 — Re-run the ratchet; minimize any residual
Run `pnpm lint:framework-vocabulary`. After T1+T2 the count should drop by ~2–3. If it now **passes**, do nothing to the config. If a small **irreducible** residual remains (e.g. the `'../symbol-table'` module path still contributes one "table" hit that can't be removed without renaming a shared framework module — do NOT rename it), then lower the `threshold` in `scripts/lint-framework-vocabulary.config.json` by **exactly** that residual, and add a one-line justification in your report (the residual is a false positive on the framework-neutral `symbol-table` module path). Report the before/after threshold and the exact residual. Do not bump the threshold for anything you could have removed via T1/T2.

## Completed when
- [ ] `InterpretCtx.symbols` removed (`rg "symbols" packages/1-framework/2-authoring/psl-parser/src/attribute-spec/types.ts` → zero); `buildRelationInterpretCtx` no longer sets it.
- [ ] "constraint" reworded in the `InferAttr` comment.
- [ ] `pnpm lint:framework-vocabulary` passes (with a minimal, justified threshold delta only if an irreducible residual remains).
- [ ] Gates: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm fixtures:check`; after `pnpm --filter @internal/psl-parser build`, workspace `pnpm typecheck`.

## Constraints
No `any`; no bare `as`; no file-ext imports; no behaviour change (removing a dead field + rewording a comment must not alter parsing). Explicit-staging commit(s) with sign-off, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT rename the `symbol-table` module or any shared type. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** mid.
- **Halt conditions:** `ctx.symbols` turns out to be read somewhere (then it's not dead — surface it); the ratchet can't be satisfied without renaming a shared framework module or a threshold bump larger than the irreducible residual.

Return: confirmation `ctx.symbols` was dead + removed, the reworded comment, the final `lint:framework-vocabulary` result (and any threshold delta with justification), all gate results, and commit SHA(s).
