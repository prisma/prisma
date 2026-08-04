# Brief: D1 — kit: `modelAttribute` constructor + model-level plumbing (+ `int`, `bool`)

> Fresh implementer (session resume unavailable). Slice 2 (`sql-attributes`) of the `typed-attribute-parsers` project, on branch `tml-2956-sql-attributes` (off fresh `origin/main`; slice 1 merged in #891). Do NOT push or touch GitHub.

## Context
- The kit is in `main`: `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/` — engine `interpret.ts` (`interpretAttribute` already accepts `FieldAttributeAst | ModelAttributeAst`), `field-attribute.ts` (`fieldAttribute`), combinators (`str`, `identifier`, `oneOf`, `list`, `fieldRef`, `optional`), `types.ts` (`AttributeSpec`, `InterpretCtx`, `AttributeLevel` = `'field' | 'model' | 'block'`, `InferAttr`, `ArgType`). Exports in `src/exports/index.ts`.
- Slice-1 exemplar for the model-level plumbing you'll mirror: `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` — `findRelationAttributeNode(field)`, `buildRelationInterpretCtx(...)`. You are building the **model** analogues.
- CST: `ModelAttributeAst` (`syntax/ast/attributes.ts`), `ModelDeclarationAst` (has `.attributes()`), `NumberLiteralExprAst` / `BooleanLiteralExprAst` (`syntax/ast/expressions.ts`).
- Slice spec (esp. Chosen design + Scope): `projects/typed-attribute-parsers/slices/sql-attributes/spec.md`; slice plan §D1: `.../plan.md`.

## Task
Grow the kit so the model-level SQL attributes (D2+) can be migrated. No attribute is migrated in D1 — this is foundational kit + tests.

1. **`modelAttribute(name, spec)` constructor** in `psl-parser` (new file `src/attribute-spec/model-attribute.ts` mirroring `field-attribute.ts`), fixing `level: 'model'`, same `{ positional, named, refine }` shape and `AttributeOut` inference as `fieldAttribute`. Export it from `src/exports/index.ts`.
2. **`int()` leaf** (`src/attribute-spec/combinators/int.ts`): parses a `NumberLiteralExprAst` whose value is an integer → `number`; non-number / non-integer → the standard leaf diagnostic (via `leafDiagnostic`). Export.
3. **`bool()` leaf** (`src/attribute-spec/combinators/bool.ts`): parses a `BooleanLiteralExprAst` → `boolean`; else leaf diagnostic. Export.
4. **Unit + type-level tests** for `modelAttribute` (constructs a `level:'model'` spec; `InferAttr` infers the same shape `fieldAttribute` would for equivalent params), `int`, `bool` (success + each diagnostic path).

Note: **no separate model-ctx plumbing helper in `psl-parser`** — the model-level `findModelAttributeNode` + `buildModelInterpretCtx` belong in the SQL package where they're consumed (D2 builds them next to the specs, mirroring `@relation`'s helpers). D1 is purely the psl-parser kit growth. (If you find it cleaner to add a tiny generic helper in the kit, surface it — but default to keeping ctx-assembly in the consumer, as `@relation` did.)

## Scope
**In:** `modelAttribute` constructor, `int` + `bool` leaves, their exports + tests, in `psl-parser`.
**Out:** any attribute migration (D2+); any SQL-package change; `record`/`entityRef`/`funcCall`/scalar-literal leaves (later dispatches); Mongo; `@db.*`.

## Completed when
- [ ] `modelAttribute`, `int`, `bool` exported from `@internal/psl-parser` and usable (`modelAttribute('x', { positional: [{ key:'k', type: int() }] })` type-checks and infers `{ k: number }`).
- [ ] Unit + type-level tests cover the three (success + diagnostic paths; `modelAttribute` level + inference).
- [ ] Gates: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm lint:framework-vocabulary` (kit growth may add framework lines — if the count moves, update `threshold` in `scripts/lint-framework-vocabulary.config.json`, keeping `allow: ["SymbolTable"]`, and report it).

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` with a reason, or types that avoid it — follow the existing combinators' style); no file-ext imports; no reexport outside `exports/`; tests-first. Explicit-staging commits with sign-off (`git commit -s`), no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Run the transient-ID scan on the `+` diff. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** thorough (foundational constructor + inference must mirror `fieldAttribute` exactly).
- **Halt conditions:** `modelAttribute` can't reuse `fieldAttribute`'s inference cleanly without duplicating the `AttributeOut` machinery (surface the shared-factory shape); the engine needs a change to handle model nodes (it shouldn't — it already accepts `ModelAttributeAst`).

Return the structured report: the `modelAttribute` shape (and any shared-factory refactor with `fieldAttribute`), the `int`/`bool` leaves, ratchet result, gate results, commit SHA(s).
