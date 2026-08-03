# Brief: D4 — kit `record` combinator + migrate `@@index`; delete the string-based helpers

> Fresh implementer. Slice 2 (`sql-attributes`), branch `tml-2956-sql-attributes`. Do NOT push or touch GitHub.

## ⛔ TOOLING PROHIBITION — READ FIRST
**NEVER call the `grep` / regex-search / codebase-search MCP tool. It HANGS this
environment and deadlocks your run.** For EVERY search, shell out via the terminal
tool with `rg` (ripgrep) or `grep`, e.g. `rg -n "parseObjectLiteralStringMap" packages`.
Non-negotiable — prior dispatches died on this. If you reach for a search tool that
isn't the terminal, STOP and use `rg` in the terminal instead.

## Context
This dispatch **grows the kit** (adds a combinator to `@internal/psl-parser`) and then migrates `@@index`, which lets a batch of now-dead string-parsing helpers be deleted.

- **Kit location:** `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/`. Existing leaves (`str.ts`, `list.ts`, `field-ref.ts`, `int.ts`, `bool.ts`, `one-of.ts`, `identifier.ts`) are your templates. Combinators are re-exported from `packages/1-framework/2-authoring/psl-parser/src/exports/index.ts` (see the `export { list } from '../attribute-spec/combinators/list'` lines ~39–48).
- **AST for the new combinator:** `packages/1-framework/2-authoring/psl-parser/src/syntax/ast/expressions.ts` — `ObjectLiteralExprAst` (`.fields()` → `Iterable<ObjectFieldAst>`); `ObjectFieldAst` has `.keyName(): string | undefined` (unquoted key) and `.value(): ExpressionAst | undefined`. String leaves are `StringLiteralExprAst` (`.value(): string | undefined`).
- **Current `@@index` handling:** `interpreter.ts` — the isolated `if (modelAttribute.name === 'index')` branch (~lines 700–800 after D3's split). It parses: `fields` (via `parseAttributeFieldList` + `findDuplicateFieldName`), `map` (via `parseConstraintMapArgument`), `type` (named, quoted string via `parseQuotedStringLiteral`), `options` (named, object literal via `parseObjectLiteralStringMap`), with the rule **`options` requires `type`**.
- **D2/D3 SQL plumbing you reuse:** `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts` — `findModelAttributeNode`, `buildModelInterpretCtx`, and the `interpretModelConstraint` pattern. Add the `@@index` spec + interpret helper here, alongside the others.
- Slice spec + plan §D4: `projects/typed-attribute-parsers/slices/sql-attributes/{spec.md,plan.md}`. Note the spec's edge-case row: **field lists are positional-only** — do NOT declare `fields` as a named arg (operator decision; the legacy named `fields:` spelling is intentionally dropped).

## Task
1. **Add the `record` combinator** (`combinators/record.ts`): `record<T>(of: ArgType<T>): ArgType<Record<string, T>>`. Parse an `ObjectLiteralExprAst`: for each `ObjectFieldAst`, take `keyName()` and parse `value()` through `of`. Reject: non-object-literal arg (`Expected an object literal`), a field with no key or no value, a duplicate key, and any element whose value fails `of.parse`. Accumulate leaf failures like `list` does. Use `leafDiagnostic(ctx, node, msg)` for all diagnostics (code = the kit's single `ATTRIBUTE_DIAGNOSTIC_CODE`). Export it from `exports/index.ts`. **Add a focused unit test** (`test/attribute-spec/record.test.ts` or beside the existing combinator tests — match the repo's layout) covering: single/multi key, empty object, duplicate key, non-object arg, non-matching leaf. Do NOT add a `map(key, value)` combinator — `@@index` needs only `record(str())` (YAGNI).
2. **Migrate `@@index`** to a spec in `sql-attribute-specs.ts`:
   `modelAttribute('index', { positional: [{ key: 'fields', type: list(fieldRef('self'), { nonEmpty: true, unique: true }) }], named: { map: optional(str()), type: optional(str()), options: optional(record(str())) }, refine: (v, ctx) => v.options !== undefined && v.type === undefined ? [<one leafDiagnostic: options requires type>] : [] })`.
   Add an interpret helper returning `{ fields, map, type, options }` (or the sentinel on failure), mirroring `interpretModelConstraint`. Wire it into the `@@index` branch, preserving `mapFieldNamesToColumns` and the shape pushed to `indexNodes` (`columns`, optional `name`/`type`/`options`).
3. **Delete the now-dead helpers** from `psl-attribute-parsing.ts` — but ONLY after confirming (via `rg`) each has zero remaining callers in `packages/`:
   - `parseObjectLiteralStringMap`, `splitObjectLiteralEntries`, `findTopLevelColon`
   - `parseAttributeFieldList`, `parseFieldList`, `findDuplicateFieldName`
   - `parseConstraintMapArgument`
   **Do NOT delete** shared primitives still used elsewhere: `parseQuotedStringLiteral`, `getNamedArgument`, `getPositionalArgument`, `getAttribute`, `lowerFirst`, `unquoteStringLiteral`, the `@db.*` helpers (`parseOptional*Argument`, `getPositionalArguments`) — `rg` each before touching it.
4. **Relocate the tests:** `test/psl-attribute-parsing.test.ts` currently unit-tests `parseObjectLiteralStringMap` (the `parseObjectLiteralStringMap` describe block). That coverage moves to the new `record` combinator test in psl-parser (step 1). Delete the now-orphaned `parseObjectLiteralStringMap` describe block; keep any tests for helpers that survive.

## Scope
**In:** the `record` combinator + its unit test + export; the `@@index` spec + interpret helper + call-site migration; deletion of the seven dead helpers; the test relocation.
**Out:** `@@control` (D5), polymorphism (D6), `@default` (D7), Mongo, `@db.*`. Do not migrate any other attribute.

## Behaviour parity
Same index output (`columns`, `name`, `type`, `options`) as before; `options`-requires-`type` still enforced. `pnpm fixtures:check` must stay clean. Argument-syntax errors now surface `PSL_INVALID_ATTRIBUTE_SYNTAX` with kit messages instead of `PSL_INVALID_ATTRIBUTE_ARGUMENT` — intentional; update every test asserting the old code/message (find via `rg`). The `options`-requires-`type` refine diagnostic may change wording; keep it clear.

## Completed when
- [ ] `record` combinator added, exported, unit-tested; psl-parser typecheck + test green.
- [ ] `@@index` lowered via spec; index output unchanged; `options`-requires-`type` preserved.
- [ ] All seven helpers deleted; `rg` for each in `packages/` → zero. Shared primitives + `@db.*` helpers retained.
- [ ] Gates: `pnpm --filter @internal/psl-parser build` (kit changed — required before downstream typecheck), then `pnpm --filter @internal/psl-parser typecheck && test`; `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm fixtures:check`; `pnpm lint:framework-vocabulary` (the `record` combinator adds framework lines — if `count` exceeds `threshold`, bump the threshold in `scripts/lint-framework-vocabulary.config.json` to the new count and say so).

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` from `@internal/utils/casts`, narrowed); no file-ext imports; tests-first where emitted code/behaviour changes. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** high — this is the slice's biggest dispatch (kit growth + migration + 7-helper sweep). Take the steps in order: combinator + test first (prove it in isolation), then the migration, then the deletions last (so `rg`-zero is meaningful).
- **Halt conditions:** if any of the seven helpers still has a caller you can't migrate within this dispatch's scope, leave it and surface. If `@@index` `options` parsing needs a non-string leaf (it shouldn't — V1 is string-only), surface rather than widening `record`.

Return: the `record` combinator signature + where its test landed, the `@@index` spec + refine shape, the confirmed `rg`-zero list for all seven deleted helpers, whether you moved the vocabulary threshold (and to what), all gate results, and the commit SHA.
