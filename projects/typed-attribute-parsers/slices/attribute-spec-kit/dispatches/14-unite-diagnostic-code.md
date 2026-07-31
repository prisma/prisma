# Brief: D14 — unite on a single diagnostic code + purge not-taken-alternative comments

> On the slice-1 PR branch `tml-2956-typed-attribute-parsers`. Operator review batch. Do NOT push or touch GitHub.

## Part A — comment purge (comment-only)
The operator wants comments that explain by **contrasting with an alternative we never wrote** removed, plus two specific ones:
- **`combinators/identifier.ts`** — remove the `const N` comment ("just explains how TS works").
- **`combinators/one-of.ts`** — remove the inline comment on the fallthrough `return notOk(...)` ("doesn't add value on top of the code"; it also uses the "shared list" contrast).
- **Sweep every remaining comment** added by this PR (`git --no-pager diff origin/main...HEAD -- 'packages/**/*.ts'`) that explains via a not-taken alternative — phrases like "rather than pushing to a shared list", "instead of writing to a shared list/sink", "rather than a hard-coded generic". Remove them. In particular check `attribute-spec/types.ts` (the `ArgType.parse` note) and `combinators/diagnostic.ts` / `interpret.ts`.

## Part B — unite on a single diagnostic code (code change; operator-directed)
The operator asks: "Why does `diagnosticCode` need to be customizable? Can't we just unite on a single `PSL_INVALID_ATTRIBUTE`?" The per-attribute `diagnosticCode` exists only to preserve legacy codes-parity for `@relation` (`PSL_INVALID_RELATION_ATTRIBUTE`). Remove the customization; use **one constant code** for all attribute-spec structural + leaf diagnostics.

- Pick the single code: check `PslDiagnosticCode` (in `@internal/framework-components/psl-ast`) for the best existing generic — prefer one literally meaning "invalid attribute". If a `PSL_INVALID_ATTRIBUTE` exists, use it; otherwise use the current default `PSL_INVALID_ATTRIBUTE_SYNTAX` uniformly. Note which you chose and why.
- **Remove `AttributeSpec.diagnosticCode`** (types.ts) and its usage; **remove `InterpretCtx.diagnosticCode`** and the `leafCtx = { ...ctx, diagnosticCode: code }` threading in `interpret.ts` — the engine emits structural diagnostics with the single constant directly, and passes `ctx` (unchanged) to leaves.
- **Leaves** (`leafDiagnostic` in `combinators/diagnostic.ts`) stamp the single constant instead of `ctx.diagnosticCode`. If `leafDiagnostic` no longer needs anything attribute-specific from ctx for the code, simplify accordingly.
- **SQL `sqlRelation`** (`psl-relation-resolution.ts`): remove `diagnosticCode: 'PSL_INVALID_RELATION_ATTRIBUTE'` from the spec; `relationInvariants` (the both-or-neither refine) currently hard-codes `PSL_INVALID_RELATION_ATTRIBUTE` — change it to the single unified code; `buildRelationInterpretCtx` — remove the `diagnosticCode` property.
- **Tests/fixtures:** any assertion expecting `PSL_INVALID_RELATION_ATTRIBUTE` for a `@relation` error path now expects the unified code. Update them intentionally (this is authorised — it further relaxes the codes-parity bar). Report the count of changed assertions and whether any fixture changed (contract output must NOT change — only diagnostic codes in tests).

## Parity note
This changes `@relation` error **codes** from `PSL_INVALID_RELATION_ATTRIBUTE` to the single generic code. Contract output is unaffected. `pnpm fixtures:check` must stay clean (fixtures are valid schemas; they don't exercise these error paths). If any fixture *does* change, halt and surface.

## Vocabulary ratchet
Removing the `diagnosticCode` field/comments involves no forbidden vocabulary, so the count likely stays 906. Re-run `pnpm lint:framework-vocabulary`; if the count moved, update `threshold` to the new count (keep `allow: ["SymbolTable"]`).

## Completed when
- [ ] Part A: the two named comments removed; no "rather than/instead of … shared list/sink" or "rather than a hard-coded generic" comment remains (`rg -n "shared list|shared sink|hard-coded generic|rather than pushing" packages/1-framework/2-authoring/psl-parser` → zero).
- [ ] Part B: `AttributeSpec.diagnosticCode` and `InterpretCtx.diagnosticCode` gone (`rg -n "diagnosticCode" packages/1-framework/2-authoring/psl-parser/src/attribute-spec packages/2-sql/2-authoring/contract-psl/src` → zero); all attribute-spec diagnostics use one constant code; `sqlRelation` no longer sets a per-attribute code.
- [ ] Gates: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test`; `pnpm fixtures:check` (clean); `pnpm lint:framework-vocabulary`; workspace `pnpm typecheck` after psl-parser build.

## Constraints
No `any`; no bare `as`; no file-ext imports; tests-first where behaviour (the code emitted) changes. Explicit-staging commit(s) with sign-off, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** thorough (engine + SQL-spec + test change with a diagnostic-code semantics shift).
- **Halt conditions:** removing the per-attribute code breaks a NON-`@relation` consumer that depends on a specific code (surface it); a fixture's contract output changes; no single generic code fits cleanly (surface the `PslDiagnosticCode` options).

Return: the single code you chose (+ why), confirmation `diagnosticCode` is fully gone, the count of updated test assertions, ratchet result, all gate results, and commit SHA(s).
