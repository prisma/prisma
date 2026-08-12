# Brief: D3 — migrate `@id`/`@unique` (field) + `@@id`/`@@unique` (model)

> Fresh implementer. Slice 2 (`sql-attributes`), branch `tml-2956-sql-attributes`. Do NOT push or touch GitHub.

## ⛔ TOOLING PROHIBITION — READ FIRST
**NEVER call the `grep` / regex-search / codebase-search MCP tool. It HANGS this
environment and will deadlock your run.** For every search, shell out via the
terminal tool using `rg` (ripgrep) or `grep` as a command — e.g.
`rg -n "parseAttributeFieldList" packages/2-sql`. This is non-negotiable; two
prior dispatches died on this exact mistake. If you catch yourself reaching for a
search tool that isn't the terminal, STOP and use `rg` in the terminal instead.

## Context
- The attribute-spec kit is at `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/`. It is already published on this branch — import kit funcs/types from `@internal/psl-parser`; AST types from `@internal/psl-parser/syntax`. Do NOT modify psl-parser in this dispatch.
- **D2 landed the SQL-side plumbing you reuse:** `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts` — `findModelAttributeNode`, `findFieldAttributeNode`, `buildModelInterpretCtx`, `buildFieldInterpretCtx`. Add your new specs + helpers here.
- **Combinators you need (already exist):**
  - `optional(str())` — optional value.
  - `str()` — string literal → `string`.
  - `fieldRef('self')` — bare identifier → field name (`string`); validates the field exists on `ctx.selfModel`.
  - `list(fieldRef('self'), { nonEmpty: true, unique: true })` — `[a, b]` → `string[]`; enforces non-empty + no duplicates + per-element field existence. This **subsumes** `parseAttributeFieldList` + `findDuplicateFieldName` for the migrated attributes.
- **Today's handling:**
  - Field `@id`/`@unique`: `extractFieldConstraintNames` in `psl-field-resolution.ts:249-279` — presence via `getAttribute`, constraint name via `parseConstraintMapArgument` (the `map:` named arg). Presence booleans feed `isIdField`/`isUnique` at `psl-field-resolution.ts:493-551`.
  - Model `@@id`: `interpreter.ts:620-696`. Model `@@unique`/`@@index` share one branch at `interpreter.ts:697-` (`name === 'unique' || name === 'index'`), using `parseAttributeFieldList` + `findDuplicateFieldName`, then nullable check (`@@id` only), `mapFieldNamesToColumns`, `parseConstraintMapArgument`.
- Slice spec + plan §D3: `projects/typed-attribute-parsers/slices/sql-attributes/{spec.md,plan.md}`.

## Task
Migrate the four constraint attributes so their **argument syntax** is parsed by specs, while the **semantic** checks (nullable-in-PK, column mapping, both-inline-and-block-PK, duplicate-declaration) stay in the interpreter.

1. **Specs (in `sql-attribute-specs.ts`):**
   - `fieldAttribute('id', { named: { map: optional(str()) } })` and the same for `'unique'`.
   - `modelAttribute('id', { positional: [{ key: 'fields', type: list(fieldRef('self'), { nonEmpty: true, unique: true }) }], named: { map: optional(str()) } })` and the same for `'unique'`.
   - Export small interpret helpers mirroring D2's `interpret*MapName` shape: return the parsed `{ fields, map }` (model) / `{ map }` (field) or push diagnostics + return a sentinel. Keep the call-site ergonomics close to D2.
2. **Field `@id`/`@unique` (`psl-field-resolution.ts`):** replace the two `parseConstraintMapArgument` calls in `extractFieldConstraintNames` with the field spec's interpretation to get `idName`/`uniqueName`. Presence detection (`idAttribute`/`uniqueAttribute` booleans) can stay via `getAttribute` OR via `findFieldAttributeNode`; keep whichever is cleaner — the downstream only needs a boolean + the map name.
3. **Model `@@id` / `@@unique` (`interpreter.ts`):** replace the `parseAttributeFieldList` + `findDuplicateFieldName` extraction with the model spec's `fields` result. **Split the shared `unique || index` branch:** route `@@unique` through the spec; **leave `@@index` on the legacy path unchanged** (it migrates in D4). Keep the nullable-field check, `mapFieldNamesToColumns`, the both-inline-and-block-PK guard, the duplicate-declaration guard, and the constraint `map` name (now from the spec, not `parseConstraintMapArgument`).
4. **Do NOT delete `parseAttributeFieldList` / `parseFieldList` / `findDuplicateFieldName`** — `@@index` still consumes them until D4. (The plan's D3 entry says to delete them; that is inaccurate because `@@index` shares the path. Leave them; D4 deletes them.) `parseConstraintMapArgument` + `mapFieldNamesToColumns` are also retained.

## Scope
**In:** the four specs + their interpret helpers; the field `@id`/`@unique` map-name migration; the model `@@id`/`@@unique` field-list + map migration; splitting the `unique`/`index` branch.
**Out:** `@@index` (D4), `@@control` (D5), polymorphism (D6), `@default` (D7), Mongo, `@db.*`. Do not touch legacy helpers other than ceasing to call them from the migrated paths.

## Behaviour parity
Same primary-key / unique-constraint output (columns, constraint names, inline-vs-block PK resolution) as before. `pnpm fixtures:check` must stay clean. Diagnostics for **argument-syntax** errors (non-list `@@id` arg, duplicate field in the list, unknown field in the list, non-string `map`) now surface the kit's `PSL_INVALID_ATTRIBUTE_SYNTAX` with the kit's messages (`Expected a list of field name`, `Duplicate list entry`, `Field "X" does not exist on model "Y"`, `Expected a string literal`) instead of the old `PSL_INVALID_ATTRIBUTE_ARGUMENT` — intentional per the slice spec. **Semantic** diagnostics that stay in the interpreter (nullable field in PK, both inline+block `@@id`, duplicate `@@id` declaration, column-mapping failures) keep their existing codes/messages. Update every test that asserts a changed code/message; find them with `rg` in the terminal.

## Completed when
- [ ] Field `@id`/`@unique` map name + model `@@id`/`@@unique` fields+map lowered via specs; `@@index` untouched and still green.
- [ ] `parseAttributeFieldList`/`parseFieldList`/`findDuplicateFieldName` retained (still used by `@@index`); no longer called from the migrated `@@id`/`@@unique` paths.
- [ ] Gates: `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm fixtures:check`; `pnpm lint:framework-vocabulary`.

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` from `@internal/utils/casts` if truly unavoidable); no file-ext imports; tests-first where emitted code/behaviour changes. Explicit-staging commit with `git commit -s` (DCO), no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** high — the branch split + preserving the exact semantic-check ordering is the design risk; the spec wiring is mechanical.
- **Halt conditions:** if migrating `@@unique` forces a change to `@@index` behaviour (it should NOT — split the branch cleanly), STOP and surface. If a semantic check can't be preserved because the spec consumes the arg the interpreter needed, surface it rather than dropping the check.

Return: the four specs + helper shapes, the branch-split diff summary for `@@unique`/`@@index`, confirmation the three list helpers are retained, gate results, and the commit SHA.
