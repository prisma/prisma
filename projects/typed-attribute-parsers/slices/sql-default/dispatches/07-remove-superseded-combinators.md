# Brief: D7 — remove `scalarLiteral`/`bareIdentifier`; fix the `num.ts` vocab line

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default` (PR #938). Do NOT push or touch GitHub. ONE signed commit. Final dispatch of the slice.

## ⛔ TOOLING RULE (operator standing order)
**NEVER call the regex/codebase-search MCP tool — it HANGS and deadlocks the run.** Use `rg`/`grep` in the **terminal** only; reading a named file with the file reader is fine. Can't proceed without searching → STOP and report "brief under-specified."

## Context
D5/D6 made the `@default` specs dynamic; `scalarLiteral()` and `bareIdentifier()` now have no callers (D5 replaced `scalarLiteral` with `oneOf(str(), num(), bool())`; D6 replaced `bareIdentifier` with `oneOf(identifier(member)…)`). Remove them. Also fix a pre-existing framework-vocabulary regression that D5 introduced: `num.ts`'s doc comment contains the flagged word "constraint".

## Part A — fix the vocab line (`packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/num.ts`)
Its doc comment currently reads (line ~7–8):
```
// … a general number literal (any number, incl. floats). For an
// integer-only constraint use `int()`.
```
The word **"constraint"** is a flagged family/target-vocabulary term (the framework must stay family-blind), which pushed `lint:framework-vocabulary` to 906/905. Reword to drop it, e.g.:
```
// A general number literal — any number, including floats. Use `int()` when only
// integer literals are allowed.
```
(Keep the meaning; just avoid "constraint".)

## Part B — delete the two superseded combinators
- Delete `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/scalar-literal.ts` and `.../combinators/bare-identifier.ts`.
- Remove their two `export { … }` lines from `packages/1-framework/2-authoring/psl-parser/src/exports/index.ts` (`scalarLiteral` line ~53, `bareIdentifier` line ~39).
- In `packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts`, **read the file** and delete the `describe('scalarLiteral', …)` and `describe('bareIdentifier', …)` blocks (their coverage is obsolete — `str`/`num`/`bool`/`identifier` are tested individually and the composition is exercised by the SQL default suites).
- Confirm via terminal `rg` there are no remaining callers: `rg -n "scalarLiteral|bareIdentifier" packages` → only nothing (or, at most, stale *comments* in `interpreter.enum.test.ts` mentioning `bareIdentifier()` — reword those comments to describe the current `oneOf(identifier(member))` shape; they're not code).

## Part C — vocab threshold hygiene
After A + B, run `pnpm lint:framework-vocabulary`. Removing the two combinator files may drop the count below 905. Set `threshold` in `scripts/lint-framework-vocabulary.config.json` to **exactly** the resulting count (keep the ratchet tight — lower it if the count dropped; it should be ≤ 905 now). Report the final count.

## Part D — ADR note (no code)
ADR 231 is left **untouched** (operator instruction); the deviation (dropped `funcCallFrom` for `oneOf(funcCall(name))`; deferred `matchingScalarLiteral`) is already recorded in the slice spec (`projects/typed-attribute-parsers/slices/sql-default/spec.md`). Nothing to do here beyond confirming that record exists.

## Scope
**In:** the `num.ts` comment reword; deletion of `scalar-literal.ts` + `bare-identifier.ts` (+ exports + their unit-test blocks); vocab threshold adjustment; rewording stale `bareIdentifier` comments in the enum test. **Out:** any behaviour change — this is pure dead-code removal + a comment/threshold fix. No spec or interpreter logic changes.

## Constraints
No `any`; no bare `as`; no file-ext imports; never suppress biome. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**` (except reading), `.agents/**`. Do NOT touch GitHub.

## Gates (all must pass, in order)
1. `pnpm --filter @internal/psl-parser build`
2. `pnpm --filter @internal/psl-parser typecheck` and `pnpm --filter @internal/psl-parser test`
3. `pnpm --filter @internal/sql-contract-psl typecheck` and `pnpm --filter @internal/sql-contract-psl test`
4. `pnpm fixtures:check` — clean
5. `pnpm lint:framework-vocabulary` — **now green** (count ≤ threshold; you set threshold to the exact count); `pnpm lint:deps`
6. `rg -n "scalarLiteral|bareIdentifier" packages` → zero (comments reworded)

Report: the `num.ts` reword; confirmation both combinators + their exports + test blocks are gone and `rg` is zero; the final vocab count + the threshold you set; all gate results; and the commit SHA. If either combinator turns out to still have a real caller, STOP and report.
