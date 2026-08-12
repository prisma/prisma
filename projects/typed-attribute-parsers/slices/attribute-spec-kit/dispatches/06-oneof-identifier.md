# Brief: D6 — replace `enumOf` with `oneOf` + `identifier`

> Fresh implementer (session resume unavailable). On the open slice-1 PR #891 branch `tml-2956-typed-attribute-parsers`. Operator-directed design change. Do NOT push or touch GitHub — the orchestrator pushes.

## Context
- Kit: `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/` — engine (`interpret.ts`), combinators (`combinators/`: `str`, `enumOf`, `fieldRef`, `list`, `diagnostic`), types (`types.ts`), exports (`src/exports/index.ts`). Tests under the package's `test/`.
- `enumOf`'s only consumer is `sqlRelation`'s `onDelete`/`onUpdate` (`packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts`), matching bare-identifier actions; the validated name maps to a `ReferentialAction` via `normalizeReferentialAction` (now a pure token→action map).
- Leaves are `Result`-pure (return diagnostics, never push a sink) — this is what lets `oneOf` backtrack. Leaf diagnostics carry `ctx.diagnosticCode` and anchor via `nodePslSpan(node, ctx.sourceFile)`.

## Decision (operator)
Replace the bespoke `enumOf` with two composable primitives joined by `oneOf` — ADR 231 principle #4 (compose, don't special-case).

## Tasks

### T1 — `oneOf(...alts)` combinator
- New combinator: tries each alternative's `parse` in order; **first success wins**; if all fail, emits **one** diagnostic (e.g. `Expected one of: <labels>`, aggregating the alternatives' `label`s) with `ctx.diagnosticCode`, anchored to the arg node. Because leaves are `Result`-pure, a failed branch leaves no diagnostics behind — do not leak the alternatives' internal failures; emit only the single aggregate.
- Type: `oneOf<Alts extends readonly ArgType<unknown>[]>(...alts: Alts): ArgType<OutOf<Alts[number]>>` (union of the alternatives' output types; `OutOf<A> = A extends ArgType<infer X> ? X : never`). Confirm the inferred output is the union of members.
- Unit tests: first-match-wins; all-fail → single aggregate diagnostic (code = the threaded `diagnosticCode`, span = arg node); type-level test that the output is the union of the alternatives.

### T2 — `identifier(name)` combinator
- New combinator: matches a bare `IdentifierAst` whose name **equals** `name`; returns that name. Pinned-only (no open form). Non-identifier OR identifier with a different name → diagnostic (`ctx.diagnosticCode`, span = arg node).
- Type: `identifier<const N extends string>(name: N): ArgType<N>` (so `oneOf` over several `identifier`s infers the precise union).
- Unit tests: matches the exact identifier; rejects a different identifier; rejects a non-identifier (e.g. a quoted string / number); the returned value is the pinned literal type.

### T3 — Rewire referential actions
- In `sqlRelation`, change `onDelete`/`onUpdate` from `optional(enumOf('NoAction', …))` to:
  `optional(oneOf(identifier('NoAction'), identifier('Restrict'), identifier('Cascade'), identifier('SetNull'), identifier('SetDefault')))`.
- The inferred output union (`'NoAction' | 'Restrict' | 'Cascade' | 'SetNull' | 'SetDefault'`) must be unchanged from what `enumOf` produced, so the call-site mapping through `normalizeReferentialAction` is untouched. Verify `onDelete: Cascade` parses and maps; a bad action (`WeirdAction`) yields one diagnostic with code `PSL_INVALID_RELATION_ATTRIBUTE` (the existing assertion in `interpreter.relations.test.ts` — message may differ, code must hold).

### T4 — Delete `enumOf`
- Remove `combinators/enum-of.ts`, its export, and its unit tests (the behaviour is now covered by `oneOf` + `identifier` tests). `rg "enumOf"` → zero.

## Scope
**In:** `oneOf` + `identifier` combinators + tests; rewire `sqlRelation` actions; delete `enumOf`; exports. **Out:** the pinned `str(value)`/`num(value)` literal matchers (their first consumer is Mongo's index `type` in slice 3 — do NOT build them now, no caller); `str()` stays the open string matcher unchanged; everything else (other attributes, Mongo, `@db.*`).

## Completed when
- [ ] `oneOf` + `identifier` exported and usable as `Param`s; `enumOf` gone (`rg enumOf` zero).
- [ ] `onDelete`/`onUpdate` use `oneOf(identifier(...))`; output union unchanged; SQL relations + diagnostics suites green (the bad-action case still emits `PSL_INVALID_RELATION_ATTRIBUTE`).
- [ ] Unit + type-level tests for `oneOf` (union inference, first-match, aggregate diagnostic) and `identifier` (pinned match/mismatch, literal type).
- [ ] Gates: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test`; `pnpm fixtures:check`; after `pnpm --filter @internal/psl-parser build`, workspace `pnpm typecheck`.

## Constraints
No `any`; no bare `as` (narrow `blindCast`/`castAs` with reason, or types that avoid it); no file-ext imports; no reexport outside `exports/`; tests-first. Explicit-staging commits, no amend, **no push**. Read-only on `projects/**/reviews/**`, `spec.md`, plan files. Transient-ID scan on the `+` diff. Do NOT post to GitHub.

## Operational metadata
- **Model tier:** mid (two combinators against a settled contract + a one-line spec rewire).
- **Halt conditions:** `oneOf`'s union type inference can't be expressed without `any`/a broad cast; deleting `enumOf` breaks a consumer you didn't expect (grep first); the spec rewire changes the `onDelete`/`onUpdate` output type (it must stay the same union).

Return the structured report per § Return shape: per-task results, the `oneOf` diagnostic shape + type-inference approach, confirmation the action union is unchanged, and commit SHA(s).
