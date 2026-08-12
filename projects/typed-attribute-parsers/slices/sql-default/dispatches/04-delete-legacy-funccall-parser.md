# Brief: D4 — delete the legacy `parseDefaultFunctionCall` string parser + refactor its test

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default`. Do NOT push or touch GitHub. Commit as ONE signed commit. This is the slice's final cleanup dispatch.

## ⛔ ABSOLUTE TOOLING RULE (operator standing order for dispatches here)
**NEVER call the regex/codebase-search MCP tool — it HANGS and deadlocks the run.** For any lookup use `rg`/`grep` in the **terminal** only. **Reading a named file with the file reader is fine and expected** (it is not "searching"). If you feel you cannot proceed without the search tool, STOP and report "brief under-specified."

## Context
`funcCall()` (the kit combinator, shipped D1/D2) replaced the hand-written `parseDefaultFunctionCall` string parser for the production `@default` path. `parseDefaultFunctionCall` now has **no production caller** — only its own unit test uses it (as an input-builder for testing `lowerDefaultFunctionWithRegistry`, which STAYS). Remove the dead string parser and its exclusive support chain, and refactor the test to build inputs directly.

## Part A — delete the dead parser from `packages/2-sql/2-authoring/contract-psl/src/default-function-registry.ts`
Delete these (all confirmed used ONLY by the string parser — verify with terminal `rg` before each if you like):
- `parseDefaultFunctionCall` (currently ~lines 123–168)
- `splitTopLevelArgs` (~line 62)
- `createSpanFromBase` (~line 48) and `resolveSpanPositionFromBase` (~line 14)
- the `DefaultFunctionArgument` interface (~line 9)
- the `import type { PslSpan } from '@internal/psl-parser';` (line 7) — it is used ONLY by the deleted helpers; drop it (confirm with `rg "PslSpan" ` on the file after deleting).

**RETAIN** (unchanged): the imports of `ControlMutationDefaultRegistry` / `DefaultFunctionLoweringContext` / `LoweredDefaultResult` / `ParsedDefaultFunctionCall`, `formatSupportedFunctionList` (~line 170), and `lowerDefaultFunctionWithRegistry` (~line 182). After deletion, `default-function-registry.ts` should contain only those two functions + their imports.

## Part B — refactor `packages/2-sql/2-authoring/contract-psl/test/default-function-registry.test.ts`
**Read the whole file first** (it is ~286 lines). It has two kinds of tests:
1. **Tests OF `parseDefaultFunctionCall`'s parsing** (e.g. `parseDefaultFunctionCall('uuid', span)` → `undefined`, `'uuid(4'` → `undefined`, `'4uuid()'` → `undefined`, trailing/empty-arg cases, and the "parses `X(a, b)` into a call" cases). **Delete these** — they test a parser that no longer exists. The equivalent parsing behaviour now lives in `funcCall()` and is covered by `attribute-spec-combinators.test.ts` in psl-parser; do not port them.
2. **Tests OF `lowerDefaultFunctionWithRegistry`** (they call `parseDefaultFunctionCall('cuid(2)', span)` etc. only to build a `ParsedDefaultFunctionCall` input, then assert on `lowerDefaultFunctionWithRegistry(...)`). **Keep these**, but replace the input construction: build the `ParsedDefaultFunctionCall` as an explicit object literal via a small local helper at the top of the file, e.g.
   ```ts
   function call(name: string, args: readonly string[]): ParsedDefaultFunctionCall {
     const span = createSpan();
     return { name, raw: `${name}(${args.join(', ')})`, args: args.map((raw) => ({ raw, span })), span };
   }
   ```
   (Import `ParsedDefaultFunctionCall` as a type from `@internal/framework-components/control`. Reuse the file's existing `createSpan()` helper for spans — the exact offsets don't matter to these registry-lowering assertions, only the `name`/`args` do.) Then `parseDefaultFunctionCall('cuid(2)', createSpan())` becomes `call('cuid', ['2'])`, `parseDefaultFunctionCall('mystery()', createSpan())` becomes `call('mystery', [])`, `parseDefaultFunctionCall('nanoid(16, 32)', createSpan())` becomes `call('nanoid', ['16', '32'])`, etc.
- Remove `parseDefaultFunctionCall` from the file's import (keep `lowerDefaultFunctionWithRegistry`).
- Every retained registry-lowering assertion must still pass unchanged (same codes/messages) — you are only changing how the input call object is built.

## Scope
**In:** deleting the dead parser + its exclusive helpers from src; refactoring its test (delete parsing tests, rebuild lowering-test inputs via the local `call()` helper). **Out:** everything else — the `@default` specs (D2/D3), the enum path, Mongo. Touch only `default-function-registry.ts` and `default-function-registry.test.ts`.

## Constraints
No `any`; no bare `as` (the `call()` helper needs none); no file-ext imports; never suppress biome. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `.agents/**`. Do NOT touch GitHub.

## Gates (all must pass)
1. `pnpm --filter @internal/sql-contract-psl typecheck`
2. `pnpm --filter @internal/sql-contract-psl test` — `default-function-registry.test.ts` green (fewer tests, since the parsing tests are gone); everything else unchanged
3. `pnpm fixtures:check` — clean
4. `pnpm lint:framework-vocabulary`; `pnpm lint:deps`
5. Terminal `rg -n "parseDefaultFunctionCall|splitTopLevelArgs|createSpanFromBase|resolveSpanPositionFromBase" packages/2-sql` → zero

You should NOT need to touch `@internal/psl-parser` here. If you do, STOP and report.

Report: confirmation of the src deletions + that `formatSupportedFunctionList`/`lowerDefaultFunctionWithRegistry` remain; the `call()` test helper + how many parsing tests you deleted; the `rg`-zero result; all gate results; and the commit SHA. If reading the test file reveals a `parseDefaultFunctionCall` use that ISN'T cleanly one of the two categories above, STOP and report.
