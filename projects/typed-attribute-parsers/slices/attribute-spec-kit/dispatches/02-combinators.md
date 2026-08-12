# Brief: D2 — the `@relation` combinators

> Implementer note: you are a **fresh** implementer (the prior D1 implementer's session became inaccessible). You have no project transcript — read the context paths below, especially the on-disk D1 engine, before editing.

## Context paths (read before editing)
- **The D1 engine you build on** (committed, on disk): `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/` — read `types.ts`, `interpret.ts`, `optional.ts`, `field-attribute.ts`, and exports in `src/exports/index.ts`. Tests: `packages/1-framework/2-authoring/psl-parser/test/attribute-spec.test.ts` + `attribute-spec.test-d.ts`.
- Slice spec: `projects/typed-attribute-parsers/slices/attribute-spec-kit/spec.md`; slice plan §Dispatch 2: `projects/typed-attribute-parsers/slices/attribute-spec-kit/plan.md`.
- ADR 231: `docs/architecture docs/adrs/ADR 231 - Declarative attribute specifications.md`.
- CST types exported from `packages/1-framework/2-authoring/psl-parser/src/exports/syntax.ts` (`StringLiteralExprAst`, `NumberLiteralExprAst`, `ArrayLiteralAst`, `IdentifierAst`, `ExpressionAst`, …). Span helper `nodePslSpan(node, sourceFile)` in `src/resolve.ts`. Diagnostics are `PslDiagnostic`; failure channel `Result<T, readonly PslDiagnostic[]>` from `@internal/utils/result`.

Engine facts (verify against the code): `ArgType<T> { kind; label; _out?; parse(arg: ExpressionAst, ctx: InterpretCtx): Result<T, readonly PslDiagnostic[]> }`. `InterpretCtx` currently `{ level, sourceId, sourceFile, symbols, selfModel, resolveReferencedModel(), field? }`. `AttributeSpec` has `diagnosticCode?` (defaults `PSL_INVALID_ATTRIBUTE_SYNTAX`).

## Task
Author the four domain combinators `@relation` needs, as `ArgType`s over `ExpressionAst`, in a new module beside the engine (e.g. `src/attribute-spec/combinators/`); export each from the package public surface; unit-test each:

- **`str()`** — `StringLiteralExprAst` → string value; non-string-literal → diagnostic.
- **`enumOf(...values)`** — `StringLiteralExprAst` or `NumberLiteralExprAst` whose value is a member of the fixed set (members may be mixed string/number per ADR 231); non-member / wrong-token → diagnostic. Build it generically; whether `@relation` uses it for `onDelete`/`onUpdate` is a D3 wiring decision.
- **`fieldRef(scope)`**, scope `'self' | 'referenced'` — bare `IdentifierAst` → the field **name string**. **Do NOT resolve or validate field existence at parse time** — the SQL interpreter validates existence downstream; a parse-time check would emit new diagnostics and break `@relation` parity. Carry `scope` as combinator metadata (for the future language server); the parsed value is just the name. Non-identifier → diagnostic.
- **`list(of, opts?)`**, `opts?: { nonEmpty?: boolean; unique?: boolean }` — reads an `ArrayLiteralAst`, maps each element through the element `ArgType` `of`, returns `T[]`; `nonEmpty` → diagnostic on empty; `unique` → diagnostic on duplicates; non-array → diagnostic. Build `unique` too (slices 2–3 need it).

## Codes parity (load-bearing)
Diagnostic **codes** must stay identical; legacy `@relation` errors all use `PSL_INVALID_RELATION_ATTRIBUTE`. Leaf-emitted diagnostics must carry the **attribute's** code, not a hard-coded generic. Thread the spec's `diagnosticCode` to the leaves — cleanest shape: add `diagnosticCode` to `InterpretCtx` and have `interpretAttribute` populate it from the spec before calling any leaf's `parse`, so each combinator emits with `ctx.diagnosticCode`. Pick the cleanest shape against the D1 engine; name it in your report (it's the D3 hand-off). Leaf-diagnostic spans anchor to the offending element/arg node via `nodePslSpan(node, ctx.sourceFile)`.

## Scope
**In:** the four combinators + their unit tests; the `diagnosticCode` threading (or equivalent); exports in `src/exports/`.
**Out:** ANY interpreter change and the `sqlRelation` spec itself (that's D3); the rest of ADR 231's alphabet (`int`, `bool`, `json`, `map`, `record`, `entityRef`, `codecRef`, `oneOf`, `funcCall`, `modelAttribute`, `blockAttribute`); `@db.*`; field-existence resolution.

## Completed when
- [ ] `str`, `enumOf`, `fieldRef`, `list` exported from `psl-parser` and usable as `Param`s in an `AttributeSpec`.
- [ ] Unit tests per combinator: parse success + each diagnostic path; `enumOf` covers a mixed string/number set; `list` covers `nonEmpty` + `unique` + element-error propagation; `fieldRef` returns the name and emits NO existence diagnostic.
- [ ] A test proves a leaf diagnostic carries the attribute's `diagnosticCode` end-to-end through `interpretAttribute`.
- [ ] Gate green: `pnpm --filter @internal/psl-parser typecheck && pnpm --filter @internal/psl-parser test && pnpm --filter @internal/psl-parser lint`.

## Standing instruction
Stay focused on the goal; control scope. Trivial-and-related fixes that serve the goal go in with a one-line note in your wrap-up; anything pulling you off the goal halts and surfaces.

## Constraints
- No `any`; no bare `as` (narrow `blindCast`/`castAs` from `@internal/utils/casts` with a reason, or types that avoid the cast); arktype not zod — where a leaf reduces to a context-free value check (`enumOf`'s literal set), ADR 231 suggests backing it with an arktype `Type`; use judgment for a small fixed set vs a plain membership check, and note the choice; no file-extension imports; tests-first.
- Explicit-staging commits (`git add <paths>`, never `-A`/`.`); no amend; **no push**.
- Read-only on `projects/typed-attribute-parsers/reviews/**`, `spec.md`, plan files.
- Run the "no transient project IDs in code" scan on your `+` diff before declaring done.

## Operational metadata
- **Model tier:** mid (routine combinators against a settled contract).
- **Halt conditions:** a combinator can't emit code-parity diagnostics without an engine change you can't make cleanly; the diff drifts into interpreter / `sqlRelation` territory (that's D3); an `ExpressionAst` shape you need isn't exported.

Return the structured report per your persona's § Return shape; note the `diagnosticCode`-threading shape you landed and the final exported combinator signatures (the D3 hand-off).
