# Brief: D1 projection algebra

## Task

Introduce the target-neutral JSON value projection algebra in `@internal/sql-relational-core/ast`: a frozen class/visitor union with `CodecJsonValueProjection`, `NativeJsonValueProjection`, and `JsonDocumentProjection`, each wrapping a `ProjectionExpr`, with the codec variant also preserving a complete immutable `CodecRef`. Deliver this as an independently tested exported substrate only; JSON object/array adoption belongs to D2.

## Scope

**In:** Relational-core AST production source and focused relational-core tests required for the projection base, visitor, concrete classes, union export, defensive codec copying/freezing, same-variant rewrite, fold/column/parameter traversal, and stable kind discriminants. Convert existing bare production casts only in files you touch, following the `no-bare-casts` skill.

**Out:** `JsonObjectExpr`/`JsonArrayAggExpr` signatures or call sites; PostgreSQL/SQLite adapters; SQL ORM; function/cast/case/source nodes; `ProjectionItem`; target descriptor lookup; actual codec/document SQL behavior; compatibility overloads; raw SQL; aggregate/fixture/docs work; any hunk from the preserved prototype. Do not edit project spec/plan/review artifacts.

## Completed when

- [ ] Tests written first prove all three concrete classes are frozen class instances, dispatch exhaustively through `JsonValueProjectionVisitor`, rewrite/fold their wrapped expressions without changing variant kind, and defensively preserve full codec metadata including nested `typeParams` and `many`.
- [ ] The projection algebra is publicly exported through the existing AST export surface, uses no plain-object variants or shallow-spread reconstruction, and introduces no bare production cast.
- [ ] `pnpm --filter @internal/sql-relational-core test`, `typecheck`, `lint`, and `build`, plus `pnpm lint:casts`, pass; commit the dispatch with explicit staging and `git commit -s`.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal—even if it looks useful—halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/spec.md`.
- Slice plan: `projects/codec-json-projections/slices/01-sql-json-projection-ast-foundations/plan.md` § Dispatch 1.
- Project design: `projects/codec-json-projections/design-notes.md` § Target-neutral JSON value projection AST.
- AST pattern: `.agents/skills/ast-visitor-pattern/SKILL.md`.
- Cast policy: `.agents/skills/no-bare-casts/SKILL.md`.
- Calibration: `drive/calibration/failure-modes.md` F3, F4, F5, F14, F22, F26; `.agents/rules/no-transient-project-ids-in-code.mdc`.
- Current canonical AST implementation/tests: discover with bounded `rg` before editing; use tests as verification, not discovery.

## Operational metadata

- **Model tier:** orchestrator / implementer-thorough — this dispatch fixes a public AST substrate and constructor invariants; design fidelity matters more than mechanical fan-out.
- **Time-box:** 45 minutes wall clock. Overrun halts and surfaces rather than silently expanding.
- **Halt conditions:** the three-variant class/visitor shape cannot fit existing AST conventions; a fourth variant or raw-SQL representation appears necessary; the dispatch needs to change JSON containers or any other out-of-scope package to compile; a named spec assumption is false; a validation gate is red for unclear/pre-existing reasons; any destructive Git or `git stash*` operation appears necessary. Never run `git stash`, `git stash pop`, `git stash drop`, or `git stash clear` because the repository-global prototype stash must remain untouched.
