# Brief: D6 — kit `entityRef` combinator + migrate `@@discriminator` + `@@base`

> Fresh implementer. Slice 2 (`sql-attributes`), branch `tml-2956-sql-attributes`. Do NOT push or touch GitHub.

## ⛔ TOOLING PROHIBITION — READ FIRST
**NEVER call the `grep` / regex-search / codebase-search MCP tool. It HANGS this
environment and deadlocks your run.** For EVERY search, shell out via the terminal
tool with `rg` (ripgrep) or `grep`, e.g. `rg -n "collectPolymorphismDeclarations" packages`.
Non-negotiable — prior dispatches died on this. If you reach for a search tool that
isn't the terminal, STOP and use `rg` in the terminal instead.

## Context
Grows the kit with one small combinator (`entityRef`), then migrates the two SQL polymorphism attributes. **SQL family only — do NOT touch `packages/2-mongo-family/**` (Mongo is slice 3).**

- **Kit location:** `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/`. `field-ref.ts` is your closest template. Combinators re-export from `packages/1-framework/2-authoring/psl-parser/src/exports/index.ts`.
- **`IdentifierAst`** lives in `packages/1-framework/2-authoring/psl-parser/src/syntax/ast/identifier.ts` (`.name(): string | undefined`).
- **Current handling:** `@@discriminator`/`@@base` are parsed in `collectPolymorphismDeclarations` (`interpreter.ts` ~lines 1251–1316), which iterates `model.attributes` (ResolvedAttribute). The main model-attribute loop just skips them (`interpreter.ts:596` `if (name === 'discriminator' || name === 'base') continue;` — leave that skip in place). Downstream, `resolvePolymorphism` owns the cross-model semantic checks (both-`@@discriminator`-and-`@@base`, base-model existence, orphaned-discriminator, etc.).
- Both use the singular `getPositionalArgument` helper (`psl-attribute-parsing.ts`), whose ONLY remaining callers are these three lines (verify with `rg -n "getPositionalArgument\\b" packages/2-sql`). After this migration it is dead → delete it. **Do NOT** delete the *plural* `getPositionalArguments` (serves `@db.*`) or `parseQuotedStringLiteral` (used widely) — `rg` to confirm before touching either.
- **Operator decision (Option A) — read carefully:** model `@@discriminator` via **`fieldRef('self')`** (it validates the field exists on the declaring model). This means an unknown discriminator field now fails at parse with the kit's `PSL_INVALID_ATTRIBUTE_SYNTAX` ("Field … does not exist on model …") — consistent with how `@@id`/`@@unique`/`@@index` already report unknown fields. The old dedicated `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` check in `resolvePolymorphism` (`interpreter.ts` ~line 1364–1372) becomes **unreachable** (the declaration is never set for a missing field) → **remove that block in the SQL interpreter** and update its test. Leave the Mongo copy of that code + test alone.
- Slice spec + plan §D6: `projects/typed-attribute-parsers/slices/sql-attributes/{spec.md,plan.md}`.

## Task
1. **Add the `entityRef` combinator** (`combinators/entity-ref.ts`): `entityRef(): ArgType<string>` — parses a bare `IdentifierAst` → its name; **does NOT** validate that any model with that name exists (base-model resolution stays in `resolvePolymorphism`). Reject a non-identifier / nameless arg with `leafDiagnostic(ctx, arg, 'Expected a model name')`. Export from `exports/index.ts`. **Unit-test it** beside the existing combinator tests (`packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts`): accepts a bare identifier; rejects a string literal / number / array.
2. **Specs (in `sql-attribute-specs.ts`):**
   - `modelAttribute('discriminator', { positional: [{ key: 'field', type: fieldRef('self') }] })`.
   - `modelAttribute('base', { positional: [{ key: 'base', type: entityRef() }, { key: 'value', type: str() }] })`.
   Add interpret helpers returning `{ field }` / `{ base, value }` (or the sentinel on failure), mirroring the existing `interpretModel*` helpers.
3. **Rewire `collectPolymorphismDeclarations`:** thread a `sourceFile: SourceFile` param through (and pass it at the call site). For each model, use `findModelAttributeNode(model, 'discriminator')` / `findModelAttributeNode(model, 'base')` to get the node, interpret via the spec, and populate the same `discriminatorDeclarations` / `baseDeclarations` maps. **Keep the discriminator String-type semantic check** (`typeName !== 'String'` → `PSL_INVALID_ATTRIBUTE_ARGUMENT`, message contains "must be of type String") — after `fieldRef` the field is guaranteed to exist, so look it up and check its type. All the `resolvePolymorphism` cross-model checks stay unchanged **except** the now-dead `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` block, which you remove (SQL only).
4. **Delete the singular `getPositionalArgument`** from `psl-attribute-parsing.ts` once `rg` confirms zero callers in `packages/`.
5. **Update tests:** the SQL polymorphism test "diagnoses missing discriminator field on base model" (`interpreter.polymorphism.test.ts` ~line 735) now expects `PSL_INVALID_ATTRIBUTE_SYNTAX` with a "does not exist" message instead of `PSL_DISCRIMINATOR_FIELD_NOT_FOUND`. Keep the non-String test (~768) asserting `must be of type String` green. Find any other churned assertions with `rg`.

## Scope
**In:** the `entityRef` combinator + test + export; the two polymorphism specs + interpret helpers; the `collectPolymorphismDeclarations` migration; removal of the dead `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` block (SQL); deletion of the singular `getPositionalArgument`.
**Out:** `@default` (D7); **all of `packages/2-mongo-family/**`** (slice 3 — its `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` + parsing stay); every other attribute; `@db.*`.

## Behaviour parity
Same discriminator/base declarations resolved; the String-type check and all `resolvePolymorphism` cross-model diagnostics keep their codes/messages, EXCEPT unknown-discriminator-field which intentionally moves from `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` to `PSL_INVALID_ATTRIBUTE_SYNTAX` (Option A). `@@base` bad arg-count / non-string value now surface `PSL_INVALID_ATTRIBUTE_SYNTAX`. `@@base` model-name is a bare identifier (unchanged spelling). `pnpm fixtures:check` must stay clean.

## Completed when
- [ ] `entityRef` added, exported, unit-tested; psl-parser typecheck + test green.
- [ ] `@@discriminator`/`@@base` lowered via specs; String-type check retained; dead `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` block removed (SQL only); Mongo untouched.
- [ ] Singular `getPositionalArgument` deleted; `rg -n "getPositionalArgument\\b" packages/2-sql` → only zero (plural `getPositionalArguments` retained).
- [ ] Gates: `pnpm --filter @internal/psl-parser build` (kit changed), then `pnpm --filter @internal/psl-parser typecheck && test`; `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm fixtures:check`; `pnpm lint:framework-vocabulary` (if the `entityRef` combinator moves the count above threshold, bump the threshold in `scripts/lint-framework-vocabulary.config.json` to the new count and say so).

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` from `@internal/utils/casts`, narrowed); no file-ext imports; tests-first where emitted code/behaviour changes. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** high — the `collectPolymorphismDeclarations` rewire + safely removing the dead check without disturbing the other `resolvePolymorphism` diagnostics is the risk. Do the combinator + test first, then the specs, then the rewire, then the deletion.
- **Halt conditions:** if removing the `PSL_DISCRIMINATOR_FIELD_NOT_FOUND` block turns out to be reachable by some path `fieldRef('self')` does NOT cover (e.g. a discriminator validated against a model other than `selfModel`), STOP and surface — do not remove a still-live check. If threading `sourceFile` into `collectPolymorphismDeclarations` is awkward at the call site, surface rather than hacking around it.

Return: the `entityRef` signature + where its test landed; the two specs + helper shapes; confirmation the String-type check is retained and the dead block removed (SQL only, Mongo untouched); `rg`-zero for the singular `getPositionalArgument`; whether the vocabulary threshold moved; all gate results; and the commit SHA.
