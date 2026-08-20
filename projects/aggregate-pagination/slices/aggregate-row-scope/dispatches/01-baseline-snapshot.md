# Brief: D1 — baseline snapshot of today's aggregate plans

## Task

Add a characterization test to `packages/3-extensions/sql-orm-client` that snapshots the compiled query-plan AST for ORM aggregate chains which name no row scope, and commit it **against unmodified `src/`**. Later dispatches in this slice add row-scoping to `compileAggregate`; this snapshot is the mechanism that proves those dispatches cost unpaginated queries nothing. Its value depends entirely on being generated before any behaviour change — a snapshot written afterwards proves only self-consistency.

Corpus to cover, all through the public collection surface (`createCollectionFor` / the fixtures in `test/collection-fixtures.ts`, mirroring how `test/aggregate-pagination.test.ts` and `test/query-plan-aggregate.test.ts` drive the ORM):

- root `.aggregate()` with no other clause
- root `.aggregate()` with `.where(...)`
- root `.aggregate()` with `.orderBy(...)` (which is inert today and must stay inert)
- root `.aggregate()` with several selectors at once, including one with no column (`count()`)
- `.groupBy(...).aggregate(...)` bare
- `.groupBy(...).aggregate(...)` with `.where(...)`
- `.groupBy(...).having(...).aggregate(...)`

The grouped cases are in scope even though grouped behaviour belongs to a later slice: the guard's job is to fail the moment that slice widens the wrap condition too far, and it can only do that if the grouped baseline exists now.

## Scope

**In:** one new test file under `packages/3-extensions/sql-orm-client/test/` plus its snapshot artifact. Snapshot the compiled **plan AST** (and `plan.params`), not rendered SQL — this package has no renderer dependency.

**Out:** every file under `src/`. Every existing test file, including `test/aggregate-pagination.test.ts` — leave its `it.fails` cases exactly as they are. No refactoring of test helpers "while you're in there."

## Completed when

- [ ] The new test passes against unmodified source with no snapshot-update flag.
- [ ] `git status --porcelain packages/3-extensions/sql-orm-client/src` is empty, and the dispatch's commits touch no path under `src/`.
- [ ] The snapshot lives in a file a reviewer can diff on its own — not inline in a way that buries a future behaviour change inside unrelated test edits.
- [ ] Validation gates below all pass.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck` — and confirm whether that script covers `test/**`; if it is `src`-only, also run the test tsconfig (`tsc -p tsconfig.test.json --noEmit`).
- `pnpm --filter @internal/sql-orm-client test` — the `--filter` form, not `pnpm test:packages -- <name>` (that is a workspace-wide *path* filter and red-fails on unrelated infra).
- `pnpm --filter @internal/sql-orm-client lint` — a separate CI job; typecheck will not catch an unused import or a formatter diff.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## Halt conditions

- Producing the snapshot would require any edit under `src/`. That would mean the guard cannot be built the way this slice depends on; surface rather than working around it.
- A corpus entry throws when compiled. That is information, not an obstacle: it means the chain is not reachable today. Record it and surface it; do not silently drop the case or "fix" it.
- The diff exceeds 3 files.

## House rules that apply

- `.agents/rules/omit-should-in-tests.mdc` — test descriptions omit "should".
- `.agents/rules/sql-orm-client-whole-shape-assertions.mdc` — assert whole result shapes.
- `.agents/rules/test-import-patterns.mdc` — import from source, relative paths.
- `.agents/rules/no-transient-project-ids-in-code.mdc` — no `D1` / project-slug references in test names, comments, or file names. Name what the test pins, not which dispatch produced it.
- Never use `any`; no bare `as` in production code (test files are exempt from the cast rule).

## References

- Slice spec: `projects/aggregate-pagination/slices/aggregate-row-scope/spec.md` — chosen design, and § Pre-investigated edge cases for the binding trap this snapshot exists to catch.
- Slice plan: `projects/aggregate-pagination/slices/aggregate-row-scope/plan.md` § Dispatch 1.
- Project spec: `projects/aggregate-pagination/spec.md` § Cross-cutting requirements — "An unpaginated aggregate compiles byte-identically to today" is the requirement this dispatch operationalises.
- Existing shape to mirror: `packages/3-extensions/sql-orm-client/test/query-plan-aggregate.test.ts` (how the compile functions are driven), `test/aggregate-pagination.test.ts` (how a plan's AST is pulled off a mock runtime).

## Operational metadata

- **Model tier:** mid — brief-precise, strong gates, no design judgment to settle.
- **Time-box:** 45 minutes wall-clock. Overrun → halt and surface; do not extend.
