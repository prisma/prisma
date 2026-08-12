# Brief: D2 explicit JSON container adoption

## Task

Adopt D1's `AnyJsonValueProjection` algebra end-to-end in existing JSON container AST: `JsonObjectExpr` entries and `JsonArrayAggExpr` elements must own explicit projection variants, every current producer must construct `NativeJsonValueProjection` deliberately, and PostgreSQL/SQLite renderers must dispatch through the projection visitor while preserving byte-equivalent SQL for all pre-existing queries. This is a structural migration only; codec/document variants remain transitional pass-throughs until TML-3063.

## Scope

**In:** Tests first; relational-core JSON object/array types, constructors, rewrite/fold traversal, and focused tests; complete bounded-`rg` migration of all current bare-expression JSON object/array producers in packages and active tests to explicit native projections; PostgreSQL and SQLite JSON object/array rendering through `JsonValueProjectionVisitor`; existing adapter and SQL ORM query-plan tests needed to prove SQL/AST parity; external `ExprVisitor`/binding consumers only where compilation requires adaptation; conversion of existing bare casts in every touched production file per `no-bare-casts`.

**Out:** New expression kinds; `FunctionSource`; `ProjectionItem.codec` audit/fix; target descriptor registry/lookup; actual codec-specific transformation or SQLite document retagging; runtime errors/defaults for missing projection metadata; compatibility overloads accepting bare expressions; raw SQL; hardcoded codec IDs; aggregate/fixture/contract behavior; prototype code; project artifact edits.

## Completed when

- [ ] Tests written first prove JSON object entries and JSON array elements require and preserve concrete projection classes through construction, rewrite, fold, column/parameter collection, and freezing; a bare `ProjectionExpr` is not accepted by the public TypeScript surface.
- [ ] Every existing producer explicitly constructs `NativeJsonValueProjection`, both target renderers exhaustively visit all three variants as structural pass-throughs, and all existing PostgreSQL/SQLite/ORM JSON SQL assertions remain byte-equivalent.
- [ ] A complete closing `rg`/typecheck sweep finds no compatibility overload, plain-object projection, bare-expression container producer, dropped projection class, target/codec-ID branch, transient ID, or new bare production cast.
- [ ] Build relational-core, then run relevant relational-core/PostgreSQL-adapter/SQLite-adapter/SQL-ORM tests, typechecks, and lints plus `pnpm lint:casts`; commit with explicit staging and `git commit -s`, no amend/push.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up. Anything that changes the approved semantic shape or pulls in later-slice behavior halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/spec.md` § JSON value projection algebra.
- Slice plan: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/plan.md` § Dispatch 2.
- D1 handoff: commit `95a08898a0f6b57d529dc569a12a68f49cadd52e`; projection algebra tests and exported classes.
- Review log: `projects/codec-json-projections/reviews/code-review.md` — D1 SATISFIED, no findings.
- AST/cast rules: `.agents/skills/ast-visitor-pattern/SKILL.md`, `.agents/skills/no-bare-casts/SKILL.md`.
- Calibration: `drive/calibration/failure-modes.md` F3, F4, F5, F14, F22, F26; `.agents/rules/no-transient-project-ids-in-code.mdc`.

## Operational metadata

- **Model tier:** retained persistent implementer/thorough — migration crosses relational-core, two renderers, and ORM invariants; continuity outweighs a tier swap.
- **Time-box:** 60 minutes wall clock. Overrun or unexpectedly broad cast cleanup halts and surfaces.
- **Halt conditions:** explicit projections require a compatibility overload to keep consumers compiling; existing SQL cannot remain byte-equivalent; codec/document variants require real target semantics now; a new/fourth variant or raw SQL is needed; a touched production file's mandatory cast conversion becomes a separate refactor outcome; fixtures/contracts change; an out-of-scope surface is required; any named assumption is false; a gate is red for unclear/pre-existing reasons; any destructive Git or `git stash*` action appears necessary. The repository-global prototype stash must remain untouched.
