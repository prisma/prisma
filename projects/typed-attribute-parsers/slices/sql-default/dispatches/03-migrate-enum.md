# Brief: D3 — kit `bareIdentifier()` + migrate the enum `@default` path

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default`. Do NOT push or touch GitHub. Commit as ONE signed commit.

## ⛔ ABSOLUTE TOOLING RULE (operator standing order for dispatches here)
**NEVER call the regex/codebase-search MCP tool — it HANGS and deadlocks the run** (it has already killed dispatches). This brief is SEARCH-FREE: every path, line, and snippet is inline. You should not need to search. If you must confirm something, use `rg`/`grep` in the **terminal** only. If you feel you cannot proceed without searching, STOP and report "brief under-specified" — do not touch any non-terminal search tool.

## Part A — add the `bareIdentifier()` combinator
New file `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/bare-identifier.ts`. Model it on the sibling `entity-ref.ts` (same directory), which parses a bare `IdentifierAst` → its name. Difference: a neutral label and no "entity" framing:
```ts
import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { IdentifierAst } from '../../syntax/ast/identifier';
import type { ArgType } from '../types';
import { leafDiagnostic } from './diagnostic';

// A bare identifier (e.g. an enum member name) → its text. No validation; the
// caller decides what the identifier must resolve to.
export function bareIdentifier(): ArgType<string> {
  return {
    kind: 'bareIdentifier',
    label: 'an identifier',
    parse: (arg, ctx): Result<string, readonly PslDiagnostic[]> => {
      if (!(arg instanceof IdentifierAst)) {
        return notOk([leafDiagnostic(ctx, arg, 'Expected an identifier')]);
      }
      const name = arg.name();
      if (name === undefined) return notOk([leafDiagnostic(ctx, arg, 'Expected an identifier')]);
      return ok(name);
    },
  };
}
```
Export it from `packages/1-framework/2-authoring/psl-parser/src/exports/index.ts` (add a line next to the other combinator exports, e.g. `export { bareIdentifier } from '../attribute-spec/combinators/bare-identifier';`). Add a unit test in `packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts` (new `describe('bareIdentifier', …)`): accepts a bare identifier (returns its text); rejects a string literal, a number, and a function call. Rebuild: `pnpm --filter @internal/psl-parser build`.

## Part B — migrate the enum `@default` path
### B1. Spec — `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts`
Add `bareIdentifier` to the `@internal/psl-parser` import, and add:
```ts
export const enumDefaultSpec = fieldAttribute('default', {
  positional: [{ key: 'member', type: bareIdentifier() }],
});
```

### B2. Rewrite `lowerEnumDefaultForField` — `packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts` (currently lines 43–99)
Current body does: exactly-one-positional check (`PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`); `isQuotedString`/`isFunctionCall` regex rejection (`PSL_ENUM_DEFAULT_MUST_BE_MEMBER_NAME`); member match against `input.enumHandle.enumMembers` (`PSL_ENUM_UNKNOWN_DEFAULT_MEMBER`); success → the member's value as a literal default.
Rewrite it to:
- Change its input: drop `defaultAttribute`; add `readonly field: FieldSymbol`, `readonly model: ModelSymbol`, `readonly sourceFile: SourceFile`. Keep `modelName`, `fieldName`, `enumHandle`, `sourceId`, `diagnostics`.
- Body:
  ```ts
  const node = findFieldAttributeNode(field, 'default');
  if (node === undefined) return {};
  const member = interpretFieldAttribute({ node, spec: enumDefaultSpec, model, field, sourceFile, sourceId, diagnostics });
  if (member === undefined) return {};                     // arg-shape errors already pushed by the engine/bareIdentifier
  const match = enumHandle.enumMembers.find((m) => m.name === member);
  if (!match) {
    const validNames = enumHandle.enumMembers.map((m) => m.name).join(', ');
    diagnostics.push({
      code: 'PSL_ENUM_UNKNOWN_DEFAULT_MEMBER',
      message: `Field "${modelName}.${fieldName}" @default(${member}) does not name a member of ${enumHandle.enumName}. Valid members: ${validNames}.`,
      sourceId, span: nodePslSpan(node.syntax, sourceFile),
    });
    return {};
  }
  return { defaultValue: { kind: 'literal', value: blindCast<ColumnDefaultLiteralInputValue, 'enum member values are codec-validated JsonValue-compatible scalars'>(match.value) } };
  ```
  (`interpretFieldAttribute` + `findFieldAttributeNode` are already imported in this file; `nodePslSpan` is exported from `@internal/psl-parser` — import if not already present.)
- The `isQuotedString`/`isFunctionCall` regex block and the exactly-one-positional guard are **gone** — the `bareIdentifier()` spec + the engine's single-positional param now enforce those shapes (a quoted string / function call / array / missing-or-extra arg fails to `PSL_INVALID_ATTRIBUTE_SYNTAX`).
- **Keep** `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` (semantic — member not in the enum).

### B3. Update the call site — `psl-field-resolution.ts` line 471
The `lowerEnumDefaultForField({...})` call (inside the same branch as the D2-updated `lowerDefaultForField` call) has `model`, `field`, `input.sourceFile` in scope. Pass `field`, `model`, `sourceFile: input.sourceFile`; drop `defaultAttribute`. Leave the outer `defaultAttribute ?` presence check on line 469 as-is.

## Test edits (exact)
In `packages/2-sql/2-authoring/contract-psl/test/interpreter.enum.test.ts`:
- Line ~927 (`quoted raw value @default("low") … emits diagnostic`) and line ~949 (`function default @default(uuid()) … emits diagnostic`): these now fail at the spec (`bareIdentifier` rejects a string literal / function call) → change the asserted `code` from `'PSL_ENUM_DEFAULT_MUST_BE_MEMBER_NAME'` to `'PSL_INVALID_ATTRIBUTE_SYNTAX'`. Update each test's title/comment to reflect that the shape is now rejected as invalid attribute syntax.
- Line ~903 (`non-member identifier … @default(Critical)`): **unchanged** — `bareIdentifier` accepts `Critical`, the interpreter matches against the enum and still emits `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` (message names `Critical` + `Priority`). Verify it stays green.
If `rg` (terminal) finds any other test asserting `PSL_ENUM_DEFAULT_MUST_BE_MEMBER_NAME`, update it the same way. Do NOT touch `parseDefaultFunctionCall` or `default-function-registry.test.ts` — that cleanup is a separate dispatch (D4).

## Scope
**In:** `bareIdentifier()` + test + export; `enumDefaultSpec`; the `lowerEnumDefaultForField` rewrite + call-site threading; the two enum test shifts. **Out:** `parseDefaultFunctionCall`/`splitTopLevelArgs` deletion (D4); the non-enum path (done in D2); Mongo.

## Constraints
No `any`; keep the single existing `blindCast` for the enum member value (it is pre-existing and justified); no other bare `as`; no file-ext imports; never suppress biome; tests-first for `bareIdentifier`. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `.agents/**`. Do NOT touch GitHub.

## Gates (all must pass, in order)
1. `pnpm --filter @internal/psl-parser build`
2. `pnpm --filter @internal/psl-parser typecheck` and `pnpm --filter @internal/psl-parser test`
3. `pnpm --filter @internal/sql-contract-psl typecheck` and `pnpm --filter @internal/sql-contract-psl test`
4. `pnpm fixtures:check` — clean
5. `pnpm lint:framework-vocabulary`; `pnpm lint:deps`

Report: the `bareIdentifier` signature + its test; the `enumDefaultSpec` + the rewritten `lowerEnumDefaultForField` signature/body; the two enum test shifts + confirmation `@default(Critical)` stays `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER`; confirmation you did NOT touch `parseDefaultFunctionCall`/its test; all gate results; and the commit SHA. If anything isn't covered here, STOP and report — do not use a non-terminal search tool.
