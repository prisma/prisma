# Brief: D1 — kit combinators `scalarLiteral()` + `funcCall()`

> Fresh implementer. Slice `sql-default` (parent project `typed-attribute-parsers`), branch `tml-2956-sql-default` (off fresh `origin/main`). Do NOT push or touch GitHub.

## ⛔ TOOLING PROHIBITION — READ FIRST
**NEVER call the `grep` / regex-search / codebase-search MCP tool. It HANGS this
environment and deadlocks your run.** For EVERY search, shell out via the terminal
tool with `rg` (ripgrep) or `grep`, e.g. `rg -n "ParsedDefaultFunctionCall" packages`.
Non-negotiable — prior dispatches died on this. If you reach for a search tool that
isn't the terminal, STOP and use `rg` in the terminal instead.

## Context
This grows the attribute-spec kit with the two leaf combinators `@default` needs (the migration itself is D2). No SQL files change in this dispatch.
- **Kit location:** `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/`. Templates: `str.ts` (single-literal leaf), `field-ref.ts`, `entity-ref.ts`, `list.ts`. Re-export from `packages/1-framework/2-authoring/psl-parser/src/exports/index.ts`. Combinator tests live in `packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts`.
- **Literal AST nodes** (`packages/1-framework/2-authoring/psl-parser/src/syntax/ast/expressions.ts`): `StringLiteralExprAst.value(): string | undefined` (decoded — escapes/quotes resolved), `NumberLiteralExprAst.value(): number | undefined`, `BooleanLiteralExprAst.value(): boolean | undefined`.
- **`FunctionCallAst`** (same file): `.name(): QualifiedNameAst | undefined` and `.args(): Iterable<AttributeArgAst>`. Use the structural getters — for the function name, use `QualifiedNameAst.identifier()?.token()?.text` (do NOT stringify via `.path().join('.')`).
- **`ParsedDefaultFunctionCall`** is a framework type in `packages/1-framework/1-core/framework-components/src/shared/mutation-default-types.ts`, exported via `@internal/framework-components/control`. `psl-parser` already depends on `framework-components` (the kit imports `PslDiagnostic` from `@internal/framework-components/psl-ast`), so `funcCall()` can emit `ParsedDefaultFunctionCall` directly — layering-clean. Read that type + `DefaultFunctionArgument` before implementing; match their shape exactly (`{ name, raw, args: [{ raw, span }], span }` — confirm field names against the source).
- Slice spec + plan §D1: `projects/typed-attribute-parsers/slices/sql-default/{spec.md,plan.md}`.

## Task
1. **`scalarLiteral()`** (`combinators/scalar-literal.ts`): `ArgType<string | number | boolean>`. If the arg is a `StringLiteralExprAst`/`NumberLiteralExprAst`/`BooleanLiteralExprAst` and its `.value()` is defined, return it; else `notOk([leafDiagnostic(ctx, arg, 'Expected a string, number, or boolean literal')])`. Export it.
2. **`funcCall()`** (`combinators/func-call.ts`): `ArgType<ParsedDefaultFunctionCall>`. If the arg is a `FunctionCallAst`, build a `ParsedDefaultFunctionCall`:
   - `name` from `.name()?.identifier()?.token()?.text` (reject with a leaf diagnostic if absent/qualified in a way that yields no simple name).
   - `args` from `.args()` — for each, the `raw` source text (render via the AST — use the arg expression's decoded value where it is a literal, or `printSyntax(expr.syntax)` for the general case; producing text here is legitimate, the SQL registry re-parses these strings downstream) and its `span` via `nodePslSpan`.
   - `raw` and the call `span` via `nodePslSpan`.
   Reject a non-`FunctionCallAst` arg with `leafDiagnostic(ctx, arg, 'Expected a function call')`. **Registry-agnostic** — do NOT import any SQL type or validate the name against a registry (that stays in the interpreter, D2). Export it.
3. **Unit-test both** in `attribute-spec-combinators.test.ts` (match the file's existing `describe`/`GreenNodeBuilder`-or-`parse` convention):
   - `scalarLiteral`: accepts string / number / boolean literals (returns the decoded value); rejects an identifier, an array, a function call.
   - `funcCall`: accepts `now()` → `{ name: 'now', args: [] }`; accepts `dbgenerated("x")` → one arg whose `raw` is the source text; rejects a bare identifier / string literal / array.

## Scope
**In:** the two combinators + exports + unit tests.
**Out:** the `@default` spec, `lowerDefaultForField`, and deleting the string parsers — all D2. Do NOT touch `packages/2-sql/**` in this dispatch.

## Design point to resolve + report
Confirm `funcCall()` emitting `ParsedDefaultFunctionCall` from `@internal/framework-components/control` typechecks and keeps `lint:deps` clean (framework→framework, no SQL dependency). If for any reason that coupling is wrong (e.g. the type isn't cleanly importable from psl-parser), STOP and report rather than inventing a parallel type.

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` from `@internal/utils/casts` only if unavoidable); no file-ext imports; never suppress biome; tests-first. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`. Do NOT touch GitHub.

## Gates
1. `pnpm --filter @internal/psl-parser build`
2. `pnpm --filter @internal/psl-parser typecheck` and `pnpm --filter @internal/psl-parser test`
3. `pnpm lint:deps` — 0 violations (you added a framework→framework import)
4. `pnpm lint:framework-vocabulary` — if the two combinators push count over threshold, bump it in `scripts/lint-framework-vocabulary.config.json` to exactly the new count and say so

Report: the two combinator signatures; where `funcCall`'s output type came from + the `lint:deps` result; where the tests landed; whether you moved the vocab threshold; all gate results; and the commit SHA. If `ParsedDefaultFunctionCall` can't be cleanly imported into psl-parser, STOP and report.
