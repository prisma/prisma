# Brief: D10 — remove the dead raw `funcCall` lineage

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default` (PR #938). Do NOT push or touch GitHub. ONE signed commit. Tests-first.

## ⛔ TOOLING RULE (operator standing order — non-negotiable)
**NEVER call the regex / codebase-search MCP tool. It HANGS and deadlocks the run.** SEARCH-FREE brief. Use `rg` / `grep` **in the terminal** only; reading a named file is fine. If under-specified, STOP and report — do not reach for the search tool.

## Why
After D9 the SQL `@default` `funcCall` is fully typed: `buildDefaultSpec` builds `funcCall(name, signature)` for every registry entry, so the **no-signature `funcCall(name)` overload (`rawFuncCall`) has no production caller** — only its own unit tests exercise it. Its return type `ParsedDefaultFunctionCall`, and the legacy raw types kept alive only through it plus one indirection (`DefaultFunctionLoweringHandler`, `DefaultFunctionRegistryEntry`, `DefaultFunctionRegistry`, the `DefaultFunctionArgument` helper), are now vestigial. Remove the whole raw lineage so `funcCall` has a single typed shape. Type/test-level only — no runtime behaviour change.

Before removing each type, confirm zero remaining importers with a terminal `rg` (e.g. `rg -rn "ParsedDefaultFunctionCall" packages`); if any live consumer outside the files below turns up, STOP and report rather than widening the change.

## Changes

### 1. `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/func-call.ts`
- Delete the two `funcCall` overload declarations and the union-return implementation, and delete `rawFuncCall` entirely. Collapse to a single required-signature function (body identical to today's `typedFuncCall`):
```ts
export function funcCall(name: string, sig: FuncCallSig): ArgType<TypedFuncCall> {
  return {
    kind: 'funcCall',
    label: 'function call',
    parse: (arg, ctx): Result<TypedFuncCall, readonly PslDiagnostic[]> => {
      const guard = matchCallee(arg, name, ctx);
      if (!guard.ok) return guard;
      const span = nodePslSpan(guard.value.syntax, ctx.sourceFile);
      const bound = interpretArgs(
        guard.value.args(),
        { name, positional: sig.positional ?? [], named: sig.named ?? {} },
        ctx,
        span,
      );
      if (!bound.ok) return notOk<readonly PslDiagnostic[]>(bound.failure);
      return ok({ fn: name, span, args: bound.value });
    },
  };
}
```
- Remove now-unused imports: `ParsedDefaultFunctionCall` (line 1) and `printSyntax` (line 7). Keep `nodePslSpan`, `interpretArgs`, `FunctionCallAst`/`ExpressionAst` (used by `matchCallee`), `ArgType`/`InterpretCtx`/`Param`/`PositionalParam`, `leafDiagnostic`, `notOk`/`ok`/`Result`. Keep `FuncCallSig`, `TypedFuncCall`, `matchCallee`.
- Replace the stale doc comment above `funcCall` (the "Without a signature the call is captured into the framework `ParsedDefaultFunctionCall` shape…" paragraph) with a short one describing the single typed form: it pins the callee `name`, parses the call's arguments through `sig`, and binds them into `{ fn, span, args }`.

### 2. `packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts`
The `describe('funcCall', …)` block (~L599-689) drives the no-signature form. **Migrate the guard cases** to the empty signature `funcCall(name, {})` (the callee guards still apply), and **delete the two raw-arg-capture cases** which no longer have meaning:
- Keep + migrate: "accepts a nullary call whose callee matches the pinned name" (`funcCall('now', {})` on `now()` → assert `result.value` `toMatchObject({ fn: 'now', args: {} })` instead of `.name`/`.raw`/`.args` array), "rejects a call whose callee differs" (`funcCall('now', {})` on `uuid()`), "rejects a bare identifier" (`now`), "rejects a string literal" (`"now"`), "rejects an array literal" (`[1]`), "rejects a namespaced callee" (`foo.now()`) — all still `funcCall('now', {})`.
- **Delete**: "captures each argument as its verbatim source text" and "preserves a numeric argument as source text" (raw capture is gone).
- Leave the `describe('funcCall with a signature', …)` block unchanged.

### 3. `packages/1-framework/1-core/framework-components/src/shared/mutation-default-types.ts`
Delete these now-unused declarations: `DefaultFunctionArgument` (interface), `ParsedDefaultFunctionCall` (interface), `DefaultFunctionLoweringHandler` (type), `DefaultFunctionRegistryEntry` (interface), `DefaultFunctionRegistry` (type). Keep everything else (`SourceSpan`, `SourceDiagnostic`, `DefaultFunctionLoweringContext`, `LoweredDefaultValue`, `LoweredDefaultResult`, `TypedDefaultFunctionCall`, `MutationDefaultGeneratorDescriptor`, `ControlMutationDefaultEntry`, `ControlMutationDefaultRegistry`, `ControlMutationDefaults`).

### 4. `packages/1-framework/1-core/framework-components/src/exports/control.ts`
Remove `ParsedDefaultFunctionCall`, `DefaultFunctionLoweringHandler`, `DefaultFunctionRegistry`, `DefaultFunctionRegistryEntry` from the `export type { … } from '../shared/mutation-default-types'` list. Keep `DefaultFunctionLoweringContext`, `LoweredDefaultResult`, `LoweredDefaultValue`, `SourceDiagnostic`, `SourceSpan`, `TypedDefaultFunctionCall`, and the `ControlMutationDefault*` / `MutationDefaultGeneratorDescriptor` entries.

### 5. `packages/2-sql/2-authoring/contract-psl/src/exports/index.ts`
Remove `DefaultFunctionLoweringHandler`, `DefaultFunctionRegistry`, `DefaultFunctionRegistryEntry` from the re-export block (lines ~4-6). **Keep `DefaultFunctionLoweringContext`** (still live).

### 6. `packages/3-targets/6-adapters/sqlite/src/core/control-mutation-defaults.ts`
- Delete `type LoweredDefaultResult = ReturnType<DefaultFunctionLoweringHandler>;` (line 28).
- Change the import block (lines 14-17) that pulls `DefaultFunctionLoweringContext, DefaultFunctionLoweringHandler` from `@internal/sql-contract-psl`: drop `DefaultFunctionLoweringHandler`, and import `DefaultFunctionLoweringContext` **and** `LoweredDefaultResult` from `@internal/framework-components/control` instead (add them to the existing `@internal/framework-components/control` type import that already brings in `ControlMutationDefaultEntry, MutationDefaultGeneratorDescriptor, TypedDefaultFunctionCall`). This removes the `@internal/sql-contract-psl` import entirely from this file if nothing else uses it — verify with the file contents. (postgres already imports `DefaultFunctionLoweringContext`/`LoweredDefaultResult` from framework-components/control — align sqlite to match.)

## Scope
**In:** the six edits above. **Out:** any behavioural change; `DefaultFunctionLoweringContext` (keep); the adapter `lower` bodies / signatures (unchanged); `projects/**`, `.agents/**` (read-only).

## Constraints
No `any`; no bare `as`; no file-extension imports; never suppress biome; tests-first. `git commit -s` (DCO), explicit staging, no `--amend`, **no push**. Do NOT touch GitHub.

## Gates (all green, in order)
1. `pnpm --filter @internal/framework-components build && typecheck && test`
2. `pnpm --filter @internal/psl-parser build && typecheck && test`
3. `pnpm --filter @internal/sql-contract-psl typecheck && test`
4. `pnpm --filter @internal/adapter-postgres typecheck && test`
5. `pnpm --filter @internal/adapter-sqlite typecheck && test`
6. `pnpm lint:deps` (0 violations) and `pnpm lint:framework-vocabulary` (threshold unchanged; reword rather than bump if a comment moves it)

## Report back
The final collapsed `funcCall` signature; the list of deleted types + confirmation (via `rg`) each had no remaining importer; the psl-parser test cases migrated vs deleted; the sqlite import fix; all gate results; the commit SHA. If any live consumer of a to-be-removed type surfaces, STOP and report it rather than widening scope.
