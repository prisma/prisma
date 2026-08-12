# Brief: D4 function-source aliases and ordinality

## Task

Extend the existing frozen `FunctionSource` AST so it can immutably represent returned-column aliases and `WITH ORDINALITY` while preserving the current `FunctionSource.of(fn, args, alias?)` construction surface and every existing SQL result. PostgreSQL must render the compositional array-lift source shape `fn(args) WITH ORDINALITY AS alias(columns...)`; SQLite must preserve existing function-source rendering and reject unsupported new source options clearly. This dispatch provides source vocabulary only—it does not build the array-lifting query.

## Scope

**In:** Tests first; `FunctionSource` state/API/invariants, immutable configuration, defensive column-alias copying/freezing, rewrite preservation, SelectAst column/parameter collection through function arguments, stable kind/export behavior; PostgreSQL exact rendering for ordinality plus aliases/returned columns and existing combinations; SQLite exact existing rendering plus explicit rejection tests for new unsupported options; current function-source tests/callers; touched production cast conversion per policy.

**Out:** The default PostgreSQL array-lift CASE/subquery/unnest aggregation; JSON projection behavior; new scalar expression kinds; SQLite stored-array semantics; generalized table-function grammar; descriptor/codec lookup; raw SQL; `ProjectionItem`; aggregate/fixture/contract/prototype work; compatibility-breaking changes to current `FunctionSource.of(fn,args,alias?)`; project artifact edits.

## Completed when

- [ ] Tests written first prove current `FunctionSource.of` forms remain byte-equivalent and new immutable configuration preserves args/alias/column aliases/ordinality across rewrite and ref collection; invalid returned-column aliases without a table alias fail clearly.
- [ ] PostgreSQL renders exact ordering/quoting for `function(args) WITH ORDINALITY AS "alias"("element", "ord")`, including parameters and rewritten args; SQLite renders all legacy forms unchanged and rejects each unsupported new option with actionable errors rather than invalid SQL.
- [ ] Closing consumer/exhaustiveness/scoping scans find no array-lift query, target branch outside renderers, raw SQL, transient ID, or new bare production cast.
- [ ] Relational-core build/test/typecheck/lint and applicable PostgreSQL/SQLite target/adapter tests/typechecks/lints plus `pnpm lint:casts` pass; signed-off explicit-staging commit, no amend/push.

## Standing instruction

Stay focused on the source primitive and backward-compatible construction surface. Any need to build the array algorithm, model arbitrary table-function syntax, or change existing SQL is a halt, not an invitation to expand.

## References

- Slice spec: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/spec.md` § Function source aliases and ordinality.
- Slice plan: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/plan.md` § Dispatch 4.
- Stable prior head: D3 commit `2c07fb15741ead0bd5d2a18e138f96c328ef42e9`; D1–D3 reviewer-SATISFIED, no findings.
- Current function-source consumers/tests must be enumerated with bounded `rg` before editing.
- Rules: `.agents/skills/ast-visitor-pattern/SKILL.md`, `.agents/skills/no-bare-casts/SKILL.md`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Calibration: `drive/calibration/failure-modes.md` F3, F4, F5, F14, F22, F26.

## Operational metadata

- **Model tier:** persistent implementer/thorough — public source AST invariants and dialect-specific rendering require judgment.
- **Time-box:** 40 minutes wall clock. Overrun halts rather than adding grammar.
- **Halt conditions:** preserving the existing `of(fn,args,alias?)` surface requires ambiguous overloads; returned-column aliases cannot be validated without a broader type; SQLite needs to emit unsupported syntax; the array-lift algorithm or raw SQL becomes necessary; touched cast cleanup becomes separate scope; fixtures/contracts change; a named assumption is false; unclear gate red; any destructive Git or `git stash*` action. Preserve the repository-global prototype stash.
