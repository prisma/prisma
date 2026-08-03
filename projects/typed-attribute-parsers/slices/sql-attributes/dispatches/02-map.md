# Brief: D2 — migrate `@map` (field) + `@@map` (model); delete `parseMapName`

> Fresh implementer. Slice 2 (`sql-attributes`), branch `tml-2956-sql-attributes`. Do NOT push or touch GitHub.

## Context
- Kit now has `modelAttribute` + `fieldAttribute` + `str`/`optional`/… (D1 landed on this branch, commit `7c982c739`).
- Exemplar for the plumbing: `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` — `findRelationAttributeNode(field)` + `buildRelationInterpretCtx(...)`. You'll build the **model** analogues.
- `@map`/`@@map` are parsed today by `parseMapName` (`psl-attribute-parsing.ts:71-104`), called from `buildModelMappings` (`psl-field-resolution.ts` ~:571 model, ~:582 field) with a **default** when the attribute is absent: model → `lowerFirst(model.name)`, field → `field.name`.
- Slice spec + plan §D2: `projects/typed-attribute-parsers/slices/sql-attributes/{spec.md,plan.md}`.

## Task
Migrate field `@map` and model `@@map` onto specs, and add the reusable model-level plumbing this and later `@@` dispatches need.

1. **Model-level plumbing** (in the SQL package, next to where it's used — a new small module or beside the existing relation helpers): `findModelAttributeNode(model: ModelSymbol, name): ModelAttributeAst | undefined` and `buildModelInterpretCtx({ selfModel, symbols, sourceFile, sourceId }): InterpretCtx` — mirror `@relation`'s helpers but for model level (`level: 'model'`, no `field`, `resolveReferencedModel` may return `undefined`). Reuse for both this dispatch and D3–D6.
2. **Specs:** `const mapFieldSpec = fieldAttribute('map', { positional: [{ key: 'name', type: str() }] })` and `const mapModelSpec = modelAttribute('map', { positional: [{ key: 'name', type: str() }] })`.
3. **Route the call sites:** in `buildModelMappings`, replace the `parseMapName` calls. For each model / field: if its `map`/`@@map` attribute node exists → `interpretAttribute(node, spec, ctx)` and use `result.name`; if absent → apply the existing default (`lowerFirst(model.name)` for the model table name; `field.name` for the column). Thread the diagnostics through as `@relation` does.
4. **Delete `parseMapName`** (`psl-attribute-parsing.ts`). Confirm no other caller remains.

## Scope
**In:** the two `map` specs; model-level plumbing (`findModelAttributeNode` + `buildModelInterpretCtx`); the `buildModelMappings` call-site migration; deleting `parseMapName`.
**Out:** every other attribute (D3+); other legacy helpers (`parseConstraintMapArgument` etc. stay — they serve other attributes); Mongo; `@db.*`.

## Behaviour parity
`@map`/`@@map` set the same column/table names as before, incl. the absent-attribute defaults. `pnpm fixtures:check` must stay clean. Diagnostic: a malformed `@map` argument now emits the kit's `PSL_INVALID_ATTRIBUTE_SYNTAX` (was `PSL_INVALID_ATTRIBUTE_ARGUMENT`) — intentional per the slice spec; update any test asserting the old code.

## Completed when
- [ ] `@map`/`@@map` lowered via `interpretAttribute`; absent-attribute defaults preserved.
- [ ] `parseMapName` deleted (`rg parseMapName packages/2-sql` → zero).
- [ ] Gates: `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm fixtures:check`; `pnpm lint:framework-vocabulary`; after `pnpm --filter @internal/psl-parser build` (only if you touched psl-parser — you shouldn't), workspace `pnpm typecheck`.

## Constraints
No `any`; no bare `as`; no file-ext imports; tests-first where the emitted code/behaviour changes. Explicit-staging commit(s) with sign-off, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Transient-ID scan on the `+` diff. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** mid (mechanical migration once the plumbing exists; the plumbing is the one design bit).
- **Halt conditions:** the absent-attribute default can't be cleanly expressed at the call site (surface it); `parseMapName` has a caller outside `@map`/`@@map` (leave it, surface).

Return: the model-plumbing shape (reused by D3+), the two specs, confirmation `parseMapName` is gone, gate results, commit SHA(s).
