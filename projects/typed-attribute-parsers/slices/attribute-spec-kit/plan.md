# Slice: attribute-spec-kit — Dispatch plan

**Slice spec:** `projects/typed-attribute-parsers/slices/attribute-spec-kit/spec.md`

Sandwich shape: engine → combinators → consumer migration. 3 dispatches, sequential.

### Dispatch 1: Engine + core types

- **Outcome:** `psl-parser` exports `ArgType<T>`, `AttributeSpec`, `Param`/`optional`, `fieldAttribute`, `interpretAttribute`, `InferAttr`, and `InterpretCtx`. The engine parses positional + named arguments (including the positional-or-named alias) into a flat typed object, runs the optional `refine`, and returns `Result<InferAttr<S>, Diagnostic[]>` — proven against a trivial in-test stub `ArgType` and `InferAttr` type-level tests. No domain combinators yet.
- **Builds on:** The spec's chosen design; the `ExpressionAst` exports.
- **Hands to:** The `ArgType<T>` contract (`parse(arg: ExpressionAst, ctx) → Result<T, Diagnostic[]>`) + the engine, so dispatch 2 can author real combinators against a stable interface.
- **Focus:** Engine + types only. Message-templating machinery is included only if Open Question 1 resolves to "strict message parity."
- **Gate:** `cd packages/1-framework/2-authoring/psl-parser && pnpm typecheck && pnpm test`; `pnpm --filter @internal/psl-parser lint`.

### Dispatch 2: The `@relation` combinators

- **Outcome:** `str`, `enumOf(...values)`, `fieldRef(scope)`, and `list(of, { nonEmpty })` exist as `ArgType`s over `ExpressionAst`, each with unit tests covering parse success + each diagnostic path. `fieldRef` carries its scope (`'self'` / `'referenced'`) and resolves against `InterpretCtx`.
- **Builds on:** Dispatch 1's `ArgType` contract + engine.
- **Hands to:** The combinator set sufficient to express `sqlRelation`.
- **Focus:** Only the four combinators `@relation` needs. The rest of ADR 231's alphabet is out (slices 2–3).
- **Gate:** psl-parser typecheck + test + lint.

### Dispatch 3: Migrate SQL `@relation`; delete the legacy parser

- **Outcome:** `sqlRelation` spec defined; the `@relation` call sites in `packages/2-sql/.../interpreter.ts` + `psl-relation-resolution.ts` route through `interpretAttribute` with an assembled `InterpretCtx`; `parseRelationAttribute` (and helpers it alone used) deleted; diagnostic codes + spans byte-identical (message-text per Open Question 1).
- **Builds on:** Dispatch 2's combinator set.
- **Hands to:** SQL `@relation` validated via spec; legacy parser gone — the migration recipe slices 2–3 follow.
- **Focus:** `@relation` only. Other SQL attributes stay on their legacy paths (slice 2).
- **Gate:** `pnpm --filter @internal/contract-psl-sql test` (relations + diagnostics suites); `pnpm fixtures:check`; `rg "parseRelationAttribute"` empty; workspace `pnpm typecheck` after `psl-parser` build (cross-package consumer check).

_(Final `hands to` ⊇ slice-DoD: legacy parser removed (D3), kit exported + tested (D1–D2), parity gates green (D3). Complete.)_
