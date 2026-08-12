# Brief: D3 scalar projection expression vocabulary

## Task

Add the minimal frozen relational expression vocabulary selected for target JSON projections: scalar function calls, standard casts, and searched CASE expressions. Integrate `FunctionCallExpr`, `CastExpr`, and `CaseExpr` through `AnyExpression`, `ExprVisitor`, rewrite/fold/column/parameter traversal, atomic/grouping policy, public exports, external exhaustive consumers, and PostgreSQL/SQLite rendering, with tests that prove nested composition and exact SQL. Do not construct codec projections or broaden into a general SQL grammar.

## Scope

**In:** Tests first; relational-core AST source/tests for the three expression nodes, searched CASE branch invariants and optional ELSE, defensive freezing, same-class rewrite, fold/traversal, kinds and exports; all production/test `ExprVisitor` and exhaustive switch consumers made explicit for the new variants; PostgreSQL/SQLite renderer syntax and focused adapter tests including nested composition and precedence/grouping; touched-file bare-cast conversion per `no-bare-casts`.

**Out:** Simple `CASE value WHEN`; function-source aliases/ordinality; JSON projection semantics/registry lookup; convenience authoring DSL beyond minimal class factories; schema-qualified/quoted function or type-name grammar; raw SQL; target codec IDs/behavior; `ProjectionItem` changes; aggregates/fixtures/contracts; prototype code; project artifact edits.

## Completed when

- [ ] Tests written first prove each node is a frozen class with stable kind/visitor arm, nested rewrite/fold/column/parameter traversal, immutable arrays/branches, and searched CASE rejects zero branches while preserving optional ELSE.
- [ ] Both renderers emit exact compositional SQL for zero/multiple-argument function calls, casts, and multi-branch CASE (including nested parameters/expressions), with grouping/atomic classification covered rather than assumed.
- [ ] Every `ExprVisitor`/exhaustive expression consumer handles all three kinds deliberately; existing behavior outside the new nodes remains unchanged and closing scans find no raw-SQL shortcut, target branch, transient ID, or new bare production cast.
- [ ] Relational-core build/test/typecheck/lint and applicable PostgreSQL/SQLite/SQL-ORM tests/typechecks/lints plus `pnpm lint:casts` pass; commit with explicit staging and `git commit -s`, no amend/push.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that serve exhaustive integration belong here; any new grammar, authoring surface, or target semantic behavior halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/spec.md` § Typed expression vocabulary.
- Slice plan: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/plan.md` § Dispatch 3.
- Prior stable head: D2 commit `c8369fb90ba3419a3f56479d628e46bb60531592`; review log shows D1/D2 SATISFIED with no findings.
- Existing AST conventions and exhaustive consumers: discover with bounded `rg`; do not use test suites as discovery.
- Rules: `.agents/skills/ast-visitor-pattern/SKILL.md`, `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Calibration: `drive/calibration/failure-modes.md` F3, F4, F5, F14, F22, F26.

## Operational metadata

- **Model tier:** persistent implementer/thorough — public expression substrate and SQL precedence are design-judgment work.
- **Time-box:** 50 minutes wall clock. Overrun halts rather than broadening.
- **Halt conditions:** selected semantics require simple CASE, raw SQL, a fourth/new expression family, a generalized identifier/type grammar, or target-specific branching in neutral AST; external consumers need behavior changes rather than explicit preservation/rejection; touched-file cast cleanup becomes a separate refactor; fixtures/contracts change; any spec assumption is false; unexplained gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
