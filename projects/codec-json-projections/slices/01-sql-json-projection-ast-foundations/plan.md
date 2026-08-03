# SQL JSON projection AST foundations — Dispatch plan

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3062](https://linear.app/prisma-company/issue/TML-3062/sql-json-projection-ast-foundations)
**Parent branch:** `tml-3060-codec-json-projections`

## Dispatches

### Dispatch 1: projection algebra

- **Outcome:** `@internal/sql-relational-core/ast` exports a tested frozen `AnyJsonValueProjection` class/visitor union whose three variants preserve class identity, wrapped-expression traversal, and complete codec refs.
- **Builds on:** The slice spec's chosen class/visitor design and the existing frozen AST conventions.
- **Hands to:** A stable, independently tested projection algebra that JSON container nodes and target renderers can consume without deciding target behavior.
- **Focus:** Tests first; abstract/concrete projection classes, visitor, rewrite/fold helpers, defensive codec freezing, kind/export coverage. Do not change `JsonObjectExpr`, `JsonArrayAggExpr`, adapters, ORM call sites, or SQL output yet.

### Dispatch 2: explicit JSON container adoption

- **Outcome:** `JsonObjectExpr` and `JsonArrayAggExpr` consume `AnyJsonValueProjection`; every existing producer chooses `NativeJsonValueProjection` explicitly; PostgreSQL/SQLite renderers exhaustively visit the variants as transitional pass-throughs; all pre-existing JSON SQL assertions remain byte-equivalent.
- **Builds on:** Dispatch 1's exported projection algebra.
- **Hands to:** End-to-end explicit JSON-boundary intent across current AST producers and both target renderers, with no bare-expression fallback and no target codec behavior.
- **Focus:** Tests first; migrate relational-core, SQL ORM, adapter, and test producers identified by a complete `rg` sweep; update expression visitor/binding consumers; preserve projection classes through JSON rewrite/fold. Do not add descriptor lookup, document retagging, codec SQL, hardcoded IDs, or compatibility overloads.

### Dispatch 3: scalar projection expression vocabulary

- **Outcome:** Frozen `FunctionCallExpr`, `CastExpr`, and searched `CaseExpr` nodes participate in every expression visitor/rewrite/fold/collection/exhaustiveness path and render compositionally in PostgreSQL and SQLite with focused tests.
- **Builds on:** Dispatch 2's current exhaustive expression consumers and target-renderer test baseline.
- **Hands to:** Typed scalar AST composition sufficient for built-in encode/hex/json/cast/null-guard projections without built-in raw SQL.
- **Focus:** Tests first; minimal public constructors, freezing, kinds, visitors, nested rewrite/fold, parameter/column collection, atomic-expression policy, and target SQL syntax. No simple CASE, target descriptor behavior, or generalized SQL grammar.

### Dispatch 4: function-source aliases and ordinality

- **Outcome:** `FunctionSource` immutably represents returned-column aliases and `WITH ORDINALITY`; PostgreSQL renders the array-lift source shape, SQLite rejects unsupported new options clearly, and all existing function-source SQL remains unchanged.
- **Builds on:** Dispatch 3's compositional expression arguments and the existing `FunctionSource.of(fn, args, alias?)` API.
- **Hands to:** A typed `unnest(input) WITH ORDINALITY AS alias(element, ord)` source primitive for TML-3063's default PostgreSQL array lift.
- **Focus:** Tests first; preserve current construction compatibility; enforce alias/column invariants; rewrite/fold/param collection; target rendering and focused adapter tests. Do not build the array subquery, aggregate projected elements, or add SQLite stored-array semantics.

### Dispatch 5: projected codec preservation and slice gate

- **Outcome:** `ProjectionItem.codec` is documented and regression-tested as projected-result metadata, every audited wrapper preserves it—including `wrapWithRowNumberDedup`—and the complete slice passes package, downstream, and workspace validation after a final consumer/exhaustiveness sweep.
- **Builds on:** Dispatches 1–4's final AST shapes and explicit JSON producer migration.
- **Hands to:** TML-3061 receives a review-clean public AST foundation with authoritative output-codec propagation, tested target renderers, and no target-specific codec execution.
- **Focus:** Tests first for the known row-number-dedup loss using parameterized/many codec metadata; audit every projection reconstruction with `rg`; convert touched-file bare casts per the no-bare-casts skill; run final gates and verify forbidden-scope greps. Do not absorb descriptor, canonical JSON, aggregate, fixture, or prototype work.

### Dispatch 6: post-rebase lint compatibility

- **Outcome:** The touched where-binding regression remains semantically identical while satisfying the newer `main` lint rule against unsafe optional chaining.
- **Builds on:** Dispatch 5's complete implementation and the final rebase onto the merged planning PR plus current `main`.
- **Hands to:** A branch with no actionable local validation defect; the separately accepted PostgreSQL infrastructure flake remains disclosed to CI/reviewers.
- **Focus:** Change only the unsafe test assertion, preserve its type/nesting evidence, run the focused test and SQL ORM lint/typecheck, and commit with sign-off. No production behavior, broader test cleanup, or retry-based infrastructure work.

## Dispatch-INVEST check

| Dispatch | Independent handoff | One coherent outcome | Binary verification |
|---|---|---|---|
| 1 | Projection algebra is exported and package-tested before adoption. | One class/visitor substrate. | Class, visitor, freezing, rewrite/fold, and export tests pass. |
| 2 | Every current JSON consumer compiles against the algebra and preserves existing SQL. | One mechanical adoption after design is fixed. | Bare-expression construction no longer typechecks; relational/adapter/ORM tests pass. |
| 3 | Scalar expression nodes are usable independently of target descriptors. | One expression-vocabulary family. | Exhaustiveness, traversal, and both renderer suites pass. |
| 4 | Function-source ordinality is usable independently by later array planning. | One source-vocabulary extension. | Source invariants and PostgreSQL/SQLite behavior tests pass. |
| 5 | Output codec metadata survives wrappers and the slice is review-ready. | One propagation invariant plus its final proof. | Regression test, reconstruction sweep, and final gates pass. |
| 6 | The rebased touched test satisfies the current lint invariant. | One post-rebase compatibility correction. | Focused test and SQL ORM lint/typecheck pass. |

Dispatches 1–5 are sequential because they share the same AST discriminants and renderer exhaustiveness surface. Parallel execution would create write/write conflicts and make consumer migrations compile against moving types. Dispatch 6 is a small post-rebase remediation discovered only after the planning PR merged and `main` advanced.

## Validation gates

### Per-dispatch baseline

- Write or adapt the focused tests before changing production implementation.
- Run `pnpm --filter @internal/sql-relational-core test`, `pnpm --filter @internal/sql-relational-core typecheck`, and `pnpm --filter @internal/sql-relational-core lint` whenever relational-core changes.
- After exported AST types change, run `pnpm --filter @internal/sql-relational-core build` before downstream typechecks.
- Run package tests/typechecks/lint for every touched consumer package: `@internal/adapter-postgres`, `@internal/adapter-sqlite`, and `@internal/sql-orm-client` as applicable.
- Run `pnpm lint:casts` for every dispatch touching production TypeScript.

### Final slice gate

- `pnpm --filter @internal/sql-relational-core build`
- `pnpm --filter @internal/sql-relational-core test`
- `pnpm --filter @internal/sql-relational-core typecheck`
- `pnpm --filter @internal/sql-relational-core lint`
- `pnpm --filter @internal/adapter-postgres test`
- `pnpm --filter @internal/adapter-postgres typecheck`
- `pnpm --filter @internal/adapter-postgres lint`
- `pnpm --filter @internal/adapter-sqlite test`
- `pnpm --filter @internal/adapter-sqlite typecheck`
- `pnpm --filter @internal/adapter-sqlite lint`
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client typecheck`
- `pnpm --filter @internal/sql-orm-client lint`
- `pnpm lint:casts`
- `pnpm lint:deps`
- `pnpm typecheck`
- `pnpm test:packages`

`pnpm fixtures:check` is N/A for this slice unless implementation unexpectedly changes a serialized contract/fixture; that event is a scope stop, not permission to regenerate fixtures. Manual QA is N/A because the slice deliberately preserves user-visible query behavior and adds internal AST substrate only.

## Grep and failure-mode gates

- **F3:** enumerate consumers with `rg` before test discovery loops; run suites as verification, not search.
- **F4:** keep each dispatch to its single named outcome; re-plan rather than expanding a brief.
- **F5/F22:** no implementer or reviewer may run destructive Git commands or any `git stash*` command; the repository-global prototype stash must remain untouched. Use a temporary worktree for pristine-base checks.
- **F14/F25:** lint each touched package, cover test TypeScript where package scripts require it, sync the parent before final validation, and prove any “pre-existing” red in a pristine temporary worktree.
- **F20:** the orchestrator writes only project artifacts; every source/test change is implementer-owned.
- **F26:** reviewer findings are fixed class-first with a complete `rg` sweep, not point-fixed.
- Closing searches must show no new target/codec-ID branch in target-neutral code, no bare-expression JSON container construction, no dropped codec in projection reconstruction, no new bare production cast, and no unexpected fixture diff.

## Open items

None. Exact implementation helper names remain negotiable inside the pinned semantic shape; any need for a new projection variant, compatibility overload, built-in raw SQL, simple CASE, or target descriptor lookup is a stop condition requiring spec discussion.
