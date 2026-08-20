# Brief: D2 — lift the row-scope machinery into `src/query-plan-scope.ts`

## Task

Move the machinery that answers "which rows does this chain describe?" out of `packages/3-extensions/sql-orm-client/src/query-plan-select.ts` and into a new sibling module `src/query-plan-scope.ts`, so `query-plan-aggregate.ts` can reach it in the next dispatch. This is a **move**, not a rewrite: `query-plan-select.ts` imports the helpers back and the SQL it compiles does not change by one byte.

What moves:

| Symbol | Currently at |
| --- | --- |
| `createTableRefRemapper` | `query-plan-select.ts:311` |
| `buildStateWhere` | `query-plan-select.ts:331` |
| the cursor lowering it calls — `buildCursorWhere`, `createBoundaryExpr`, `buildLexicographicCursorWhere` | `query-plan-select.ts`, immediately above `createTableRefRemapper` |
| `wrapWithRowNumberDedup` | `query-plan-select.ts:417` |

Take whatever private helpers those four depend on that have no other caller in `query-plan-select.ts`; leave anything with a remaining caller where it is and import it. Use your judgment on the exact cut line — the constraint is that neither module ends up importing from the other in both directions.

## Scope

**In:** `src/query-plan-scope.ts` (new), `src/query-plan-select.ts` (deletions + import statements only).

**Out:** any change to what `query-plan-select.ts` emits. `src/query-plan-mutations.ts:175` has its own private `createTableRefRemapper` copy — **leave it**; unifying the two is a different change with a different reviewer. No signature changes, no logic edits, no renames, no "while I'm in here" tidying. `query-plan-aggregate.ts` is untouched in this dispatch — wiring it up is D3.

## Completed when

- [ ] `src/query-plan-scope.ts` exports the four helpers; `query-plan-select.ts` no longer defines them and imports them instead.
- [ ] The baseline snapshot committed in the previous dispatch is **byte-unchanged** — verify explicitly with `git status` / `git diff` on the snapshot file, and say so in your report.
- [ ] The full `@internal/sql-orm-client` suite is green, including the nested scalar-refine tests at `test/query-plan-select.test.ts:504` and `:545` that cover the moved code.
- [ ] `pnpm lint:deps` is clean — a new module changes the import graph.
- [ ] Validation gates below all pass.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck` (plus the test tsconfig if the script is `src`-only)
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client lint`
- `pnpm lint:deps`
- `pnpm fixtures:check` — the slice touches `packages/3-extensions/**`

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- The move cannot be made without an import cycle between `query-plan-scope.ts` and `query-plan-select.ts` → halt and surface with the cycle's shape; do not break it by inventing a third module on your own judgment.
- Any test's expectations need editing to stay green. A behaviour diff here is a defect, not an improvement — halt and surface the diff rather than adjusting the test.
- The baseline snapshot moves.

## House rules that apply

- `.agents/rules/no-barrel-files.mdc` — no barrel/re-export file for the new module.
- `.agents/rules/no-inline-imports.mdc`, `.agents/rules/modular-refactoring-patterns.mdc`.
- Never add file extensions to imports.

## References

- Slice spec § Chosen design step 1 — the move table and why the mutations copy stays put.
- Slice plan § Dispatch 2.
- Project spec § Cross-cutting requirements — "The nested scalar-refine path emits exactly what it emits today. Helper extraction is a pure refactor; any diff in its compiled output is a defect."

## Operational metadata

- **Model tier:** mid — mechanical, strong gates, no design judgment to settle.
- **Time-box:** 45 minutes wall-clock. Overrun → halt and surface.
