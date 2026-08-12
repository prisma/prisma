# Brief: D5 — migrate `@@control`; delete `parseControlPolicyAttribute`

> Fresh implementer. Slice 2 (`sql-attributes`), branch `tml-2956-sql-attributes`. Do NOT push or touch GitHub.

## ⛔ TOOLING PROHIBITION — READ FIRST
**NEVER call the `grep` / regex-search / codebase-search MCP tool. It HANGS this
environment and deadlocks your run.** For EVERY search, shell out via the terminal
tool with `rg` (ripgrep) or `grep`, e.g. `rg -n "parseControlPolicyAttribute" packages`.
Non-negotiable — prior dispatches died on this. If you reach for a search tool that
isn't the terminal, STOP and use `rg` in the terminal instead.

## Context
A small, mechanical migration — no kit growth (all combinators exist).
- **Current handling:** `@@control` is parsed by `parseControlPolicyAttribute` (`packages/2-sql/2-authoring/contract-psl/src/psl-attribute-parsing.ts` ~lines 190–240), called from the interpreter's `if (modelAttribute.name === 'control')` branch (`interpreter.ts` ~line 596). The interpreter owns a `PSL_DUPLICATE_ATTRIBUTE` guard (`controlPolicyDeclared`) **which stays**. The parser validates: no named args, exactly one positional, and the token is one of `managed`/`tolerated`/`external`/`observed` (`ControlPolicy`).
- **Combinators:** `oneOf(...)` and `identifier(name)` already exist and are exported from `@internal/psl-parser`. `identifier('managed')` matches a bare identifier and returns the literal `'managed'`; `oneOf(identifier('managed'), identifier('tolerated'), identifier('external'), identifier('observed'))` yields `ControlPolicy`.
- **Plumbing to reuse:** `sql-attribute-specs.ts` — `findModelAttributeNode` + `buildModelInterpretCtx` + the `interpretModelConstraint`/`interpretModelIndex` pattern (D3/D4). Add the `@@control` spec + interpret helper here.
- Slice spec + plan §D5: `projects/typed-attribute-parsers/slices/sql-attributes/{spec.md,plan.md}`. Note the spec's edge-case row: `@@control` policy is **bare-identifier only** now (`@@control(external)`); the legacy quoted spelling `@@control("external")` is intentionally dropped (operator decision — no in-repo schema uses it).

## Task
1. **Spec (in `sql-attribute-specs.ts`):** `modelAttribute('control', { positional: [{ key: 'policy', type: oneOf(identifier('managed'), identifier('tolerated'), identifier('external'), identifier('observed')) }] })`. Add an interpret helper returning the `ControlPolicy` (or the sentinel on failure), mirroring the existing ones.
2. **Wire it into the interpreter** `control` branch: keep the `controlPolicyDeclared` / `PSL_DUPLICATE_ATTRIBUTE` guard exactly as-is; replace only the `parseControlPolicyAttribute(...)` call with the spec interpretation; assign the result to `controlPolicy` as before.
3. **Delete** `parseControlPolicyAttribute`, `CONTROL_POLICY_LITERALS`, `CONTROL_POLICY_LITERAL_SET`, and `isControlPolicyLiteral` from `psl-attribute-parsing.ts`. If that removes the last use of the `ControlPolicy` import there, drop the import too. Before deleting, `rg` to confirm none of these four have another caller. **Do NOT** delete shared helpers `getPositionalArguments` / `unquoteStringLiteral` unless `rg` shows they now have zero callers across `packages/` (they likely still serve `@db.*` / other paths — leave them if so).

## Scope
**In:** the `@@control` spec + interpret helper + call-site migration; deletion of the four control-policy helpers.
**Out:** polymorphism `@@discriminator`/`@@base` (D6), `@default` (D7), Mongo, `@db.*`, every other attribute.

## Behaviour parity
Same `control` policy resolved and stored on the model node; the duplicate-`@@control` `PSL_DUPLICATE_ATTRIBUTE` diagnostic is unchanged (it stays in the interpreter). Argument-syntax errors (missing/too-many positional, named arg supplied, unknown policy word) now surface `PSL_INVALID_ATTRIBUTE_SYNTAX` with the kit's messages instead of `PSL_INVALID_ATTRIBUTE_ARGUMENT` — intentional. `pnpm fixtures:check` must stay clean. Update every test asserting the old code/message (the `@@control` cases live in `test/interpreter.control-policy.test.ts` and possibly `interpreter.diagnostics.test.ts` — find them with `rg`).

## Completed when
- [ ] `@@control` lowered via the spec; duplicate-attribute guard retained.
- [ ] The four control-policy helpers deleted; `rg` for each in `packages/` → zero.
- [ ] Gates: `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm fixtures:check`; `pnpm lint:framework-vocabulary`. (No psl-parser change → no rebuild needed; if you somehow touched psl-parser, STOP and report.)

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` from `@internal/utils/casts`, narrowed); no file-ext imports; tests-first where emitted code/behaviour changes. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** mid — mechanical; the one judgment call is not accidentally deleting a still-shared helper (`rg` before each delete).
- **Halt conditions:** if `getPositionalArguments`/`unquoteStringLiteral` turn out to have no remaining callers and you're unsure whether the `@db.*` path needs them, leave them and surface rather than deleting.

Return: the `@@control` spec + helper shape, `rg`-zero confirmation for the four deleted control-policy helpers, which shared helpers you retained, gate results, and the commit SHA.
