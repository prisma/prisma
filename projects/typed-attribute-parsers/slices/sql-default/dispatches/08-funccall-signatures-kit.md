# Brief: D8 — kit foundation for typed `funcCall(name, sig)` arguments

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default` (PR #938). Do NOT push or touch GitHub. ONE signed commit.

## ⛔ TOOLING RULE (operator standing order)
**NEVER call the regex/codebase-search MCP tool — it HANGS and deadlocks the run.** SEARCH-FREE brief. Use `rg`/`grep` in the **terminal** only; reading a named file is fine. Can't proceed → STOP and report "brief under-specified."

## Why
ADR 231's `funcCall(sig)` specifies a function call's **arguments** via the recursive positional/named combinator model — each argument parsed by a combinator. Today `funcCall(name)` pins only the callee name and captures args as raw strings, deferring all arg parsing to the registry's imperative `lower`. This dispatch builds the **framework foundation** so a later dispatch can give each default function a real argument signature. Framework-only; no SQL/adapter changes here (those are D9/D10).

## Part A — extract a shared argument-binding helper
File `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/interpret.ts`. `interpretAttribute` currently inlines the positional/named binding loop (walk `attrNode.argList()?.args()`, bind each to a positional slot or named param, dup/excess/missing diagnostics, `finalizeAbsentKey` for optional/required). Extract that binding into an exported helper:
```ts
export function interpretArgs(
  args: Iterable<AttributeArgAst>,
  spec: { readonly positional: readonly PositionalParam<unknown>[]; readonly named: Readonly<Record<string, Param<unknown>>> },
  ctx: InterpretCtx,
  span: PslSpan,   // for missing/excess diagnostics
): Result<Record<string, unknown>, readonly PslDiagnostic[]>
```
Move the binding + `finalizeAbsentKey` logic verbatim into it (it returns the bound `output` record or the accumulated diagnostics). Then `interpretAttribute` becomes: build `attributeSpan`, call `interpretArgs(attrNode.argList()?.args() ?? [], spec, ctx, attributeSpan)`, and on success apply `spec.refine` (unchanged) before returning. Behaviour identical — all existing psl-parser + sql tests stay green with no edits.

## Part B — `funcCall(name, sig?)` parses args via the signature
File `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/func-call.ts`. Give `funcCall` an optional signature:
```ts
export interface FuncCallSig {
  readonly positional?: readonly PositionalParam<unknown>[];
  readonly named?: Readonly<Record<string, Param<unknown>>>;
}
export function funcCall(name: string, sig?: FuncCallSig): ArgType<{ readonly fn: string } & Record<string, unknown>>
```
- Keep the existing guards (reject non-`FunctionCallAst`, namespaced callee, name mismatch).
- **If `sig` is provided:** call `interpretArgs(arg.args(), { positional: sig.positional ?? [], named: sig.named ?? {} }, ctx, nodePslSpan(arg.syntax, ctx.sourceFile))`; on failure return its diagnostics; on success return `ok({ fn: name, ...boundArgs })` — the `fn` discriminant plus the typed argument record.
- **If `sig` is omitted:** keep today's behaviour exactly (capture raw `{ raw, span }` args, return the `ParsedDefaultFunctionCall` shape) so existing callers (`buildDefaultSpec`'s `funcCall(name)`) are unchanged until D9 migrates them. (Overload or a union return is fine; if the two return shapes make one signature awkward, use two overloads: `funcCall(name)` → `ArgType<ParsedDefaultFunctionCall>`, `funcCall(name, sig)` → `ArgType<{ fn: string } & …>`.)
- Update the `funcCall` unit tests: keep the no-sig cases; add a sig case (e.g. `funcCall('nanoid', { positional: [{ key: 'size', type: optional(int({ min: 2, max: 255 })) }] })` accepts `nanoid(16)` → `{ fn: 'nanoid', size: 16 }`, accepts `nanoid()` → `{ fn: 'nanoid' }`, rejects `nanoid(1)` and `nanoid(1, 2)`).

## Part C — the literal atoms the signatures need
- **`num(value)`** — extend the existing `num()` (`combinators/num.ts`) to accept an optional pinned value: `num(): ArgType<number>` and `num(value: number): ArgType<number>` (matches only that number literal; label the number). Mirror how `str()` vs `str(value)` / `identifier(name)` pin. Unit-test the pinned form (`num(4)` accepts `4`, rejects `7`/`"4"`).
- **`int({ min, max })`** — extend `int()` (`combinators/int.ts`) to accept optional bounds: `int(opts?: { min?: number; max?: number })`, still integer-only, additionally rejecting out-of-range with a clear message (`Expected an integer between {min} and {max}`). Unit-test the bounded form.
(These realize ADR 231's `num(value)` and `int({ min, max })`. Keep the unbounded/unpinned forms working.)

## Scope
**In:** `interpretArgs` extraction; `funcCall(name, sig?)`; `num(value)` + `int({min,max})` options; their unit tests. **Out:** the registry contract, the adapters, `buildDefaultSpec` wiring, `ParsedDefaultFunctionCall` arg-shape change (all D9/D10). Do NOT touch `packages/2-sql` or `packages/3-targets`.

## Constraints
No `any`; no bare `as` (the `interpretArgs`/`funcCall` output records may need a narrow `blindCast` exactly as `interpretAttribute` already does for its dynamic output — reuse that justified pattern, narrowly); no file-ext imports; never suppress biome; tests-first. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `.agents/**`. Do NOT touch GitHub.

## Gates (all must pass, in order)
1. `pnpm --filter @internal/psl-parser build`
2. `pnpm --filter @internal/psl-parser typecheck` and `pnpm --filter @internal/psl-parser test`
3. `pnpm --filter @internal/sql-contract-psl typecheck` and `pnpm --filter @internal/sql-contract-psl test` (must stay green with NO edits — `funcCall(name)` no-sig behaviour is unchanged)
4. `pnpm fixtures:check` — clean
5. `pnpm lint:framework-vocabulary` (bump threshold to exact count if it moves); `pnpm lint:deps`

Report: the `interpretArgs` signature + confirmation `interpretAttribute` is behaviour-identical; the `funcCall(name, sig?)` shape (overloads?) + its new sig test; the `num(value)` / `int({min,max})` additions + tests; how you handled the output-record typing (no bare `as`); all gate results; and the commit SHA. If the two `funcCall` return shapes can't coexist cleanly, STOP and report the options.
