# Brief: D9 — typed `funcCall` end-to-end (SQL `@default` argument signatures)

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default` (PR #938). Do NOT push or touch GitHub. ONE signed commit. Tests-first.

## ⛔ TOOLING RULE (operator standing order — non-negotiable)
**NEVER call the regex / codebase-search MCP tool. It HANGS and deadlocks the run — it has killed multiple dispatches.** This brief is SEARCH-FREE: every path, symbol, and snippet you need is inline. For any lookup, use `rg` / `grep` **in the terminal** only. Reading a named file with the file reader is fine. If something is genuinely under-specified, STOP and report "brief under-specified: <what>" — do not reach for the search tool.

## Why
ADR 231's `funcCall(sig)` specifies a function call's **arguments** through the recursive positional/named combinator model — each argument parsed by a combinator, so arg shape/arity/range is a **grammar** concern and the parsed value is **typed**. Today the SQL `@default` registry uses `funcCall(name)` (raw): it captures args as verbatim strings and every registry `lower` re-parses them imperatively (`parseIntegerArgument`, `parseStringLiteral`, `expectNoArgs`, count checks). D8 already shipped the kit foundation (`interpretArgs`, `funcCall(name, sig)`, `num(value)`, `int({min,max})`). This dispatch wires it through: each default function declares an **argument signature**, `buildDefaultSpec` builds `funcCall(name, signature)`, and each `lower` consumes the **typed** args. Arg-shape errors become grammar failures (`PSL_INVALID_ATTRIBUTE_SYNTAX`, per operator Option A); genuinely-semantic errors keep their codes.

This is **one atomic change** (retyping the registry `lower` contract forces the framework type, `buildDefaultSpec`, both adapters, and the test stub registry to move together). Land it as one signed commit with a green tree.

## Layering constraint you must respect
- `FuncCallSig` / combinator types (`ArgType`, `PositionalParam`, `Param`) live in `@internal/psl-parser` (authoring layer, `1-framework/2-authoring`).
- `ControlMutationDefaultEntry` and friends live in `@internal/framework-components` (**core** layer, `1-framework/1-core`). **Core cannot import authoring** (`pnpm lint:deps` will fail).
- Therefore the entry's `signature` field is typed `unknown` in core (an opaque payload); the SQL family narrows it back with **one** justified `blindCast<FuncCallSig, ...>` in `buildDefaultSpec`. The **typed call** passed to `lower` (`{ fn, span, args }`) is plain-structural and core-safe.

---

## Phase 1 — Framework types (`@internal/framework-components`)

File `packages/1-framework/1-core/framework-components/src/shared/mutation-default-types.ts`.

1. Add a new exported interface (place it just above `ControlMutationDefaultEntry`, reusing the existing `SourceSpan` already defined in this file):
```ts
// The typed form of a parsed default-function call: the `fn` discriminant, the call-site span
// (for lowering diagnostics), and the argument record already parsed + validated by the
// function's `funcCall(name, signature)` combinator. Replaces the raw `ParsedDefaultFunctionCall`
// on the registry lowering path — the registry no longer re-parses argument source text.
export interface TypedDefaultFunctionCall {
  readonly fn: string;
  readonly span: SourceSpan;
  readonly args: Readonly<Record<string, unknown>>;
}
```
2. Change `ControlMutationDefaultEntry` (currently lines ~96-102) to:
```ts
export interface ControlMutationDefaultEntry {
  // The function's argument signature (a `FuncCallSig` from `@internal/psl-parser`), consumed by
  // the SQL family's `buildDefaultSpec` to build a typed `funcCall(name, signature)` arm. Typed
  // `unknown` here because `FuncCallSig` lives in the authoring layer, which the core framework
  // cannot import; the registering family owns the entries and narrows it back.
  readonly signature?: unknown;
  readonly lower: (input: {
    readonly call: TypedDefaultFunctionCall;
    readonly context: DefaultFunctionLoweringContext;
  }) => LoweredDefaultResult;
  readonly usageSignatures?: readonly string[];
}
```
3. **Leave `ParsedDefaultFunctionCall`, `DefaultFunctionRegistryEntry`, `DefaultFunctionLoweringHandler`, `DefaultFunctionRegistry` defined** (still the return type of no-signature `funcCall(name)` and out of scope to remove).

File `packages/1-framework/1-core/framework-components/src/exports/control.ts` — add `TypedDefaultFunctionCall` to the `export type { … } from '../shared/mutation-default-types'` list (keep it alphabetical: it sorts after `SourceSpan`).

Gate: `pnpm --filter @internal/framework-components build && pnpm --filter @internal/framework-components typecheck && pnpm --filter @internal/framework-components test`.

---

## Phase 2 — psl-parser `funcCall` typed output (`@internal/psl-parser`)

File `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/func-call.ts`.

Today `TypedFuncCall = { readonly fn: string } & Record<string, unknown>` and `typedFuncCall` returns `ok({ ...bound.value, fn: name })` (flat). Change to a **nested** shape carrying the call span:

1. Add `import type { PslSpan } from '@internal/framework-components/psl-ast';`
2. Replace the `TypedFuncCall` type with:
```ts
// The typed record a signed call binds to: the `fn` discriminant, the call-site span, and the
// parsed argument record produced by `interpretArgs`.
export interface TypedFuncCall {
  readonly fn: string;
  readonly span: PslSpan;
  readonly args: Readonly<Record<string, unknown>>;
}
```
3. Change `typedFuncCall` to compute the span once and nest the args:
```ts
function typedFuncCall(name: string, sig: FuncCallSig): ArgType<TypedFuncCall> {
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
Leave `rawFuncCall` (the no-signature overload) and the `funcCall` overload signatures unchanged.

### Test update — `packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts`
Only the `describe('funcCall with a signature', …)` block (currently ~L691-740) changes; the raw-`funcCall` block above it is unchanged. Update the two success assertions to the nested shape (the span is a real object — assert with `toMatchObject`, not `toEqual`):
- `nanoid(16)` case: `if (result.ok) expect(result.value).toMatchObject({ fn: 'nanoid', args: { size: 16 } });`
- `nanoid()` case: `if (result.ok) expect(result.value).toMatchObject({ fn: 'nanoid', args: {} });`
The three rejection cases (`nanoid(1)`, `nanoid(16, 2)`, `cuid(16)`) are unchanged (`ok === false`).

Gate: `pnpm --filter @internal/psl-parser build && pnpm --filter @internal/psl-parser typecheck && pnpm --filter @internal/psl-parser test`.

---

## Phase 3 — SQL contract wiring (`@internal/sql-contract-psl`)

### 3a. `src/sql-attribute-specs.ts` — `buildDefaultSpec`
- Imports: add `castAs`? NO — use `blindCast` (already imported? check the top; if not, `import { blindCast } from '@internal/utils/casts';`). Add `import type { FuncCallSig, TypedFuncCall } from '@internal/psl-parser';`. Remove the `ParsedDefaultFunctionCall` import if it becomes unused.
- Change the `DefaultArgValue` type alias: replace `ParsedDefaultFunctionCall` with `TypedFuncCall`:
```ts
type DefaultArgValue =
  | string
  | number
  | boolean
  | (string | number | boolean)[]
  | TypedFuncCall;
```
- Change the func arm construction from `.keys()`/`funcCall(name)` to `.entries()`/typed:
```ts
const funcArms = [...input.registry.entries()].map(([name, entry]) =>
  funcCall(
    name,
    blindCast<
      FuncCallSig,
      'The registry stores each signature opaquely as `unknown` because FuncCallSig lives in the authoring layer that core cannot name; the SQL family owns these entries and guarantees every one declares a FuncCallSig.'
    >(entry.signature),
  ),
);
```
Everything else in `buildDefaultSpec` (the `literal`, `valueArms`, `oneOf`) stays; `funcArms` is now `ArgType<TypedFuncCall>[]`, still a member of the `DefaultArgValue` union.

### 3b. `src/default-function-registry.ts` — `lowerDefaultFunctionWithRegistry`
- Imports: replace `ParsedDefaultFunctionCall` with `TypedDefaultFunctionCall` (from `@internal/framework-components/control`).
- Change the `call` param type to `TypedDefaultFunctionCall`, and `input.call.name` → `input.call.fn` (two sites: the `registry.get(...)` and the diagnostic message). `input.call.span` is unchanged (TypedDefaultFunctionCall has `span`).
- Keep the unknown-function branch + `formatSupportedFunctionList` as-is (it is defensive: in production the name is always a registry key because `buildDefaultSpec` only builds arms for registry keys, but the unit test exercises this branch directly).

### 3c. `src/psl-column-resolution.ts` — `lowerDefaultForField` (~L879-974)
The `value` in the object branch is now a `TypedFuncCall`. Verify it compiles; the existing code already does `lowerDefaultFunctionWithRegistry({ call: value, … })` and reads `value.span` for the `PSL_INVALID_DEFAULT_APPLICABILITY` diagnostics — both still valid. Update the `ControlMutationDefaultRegistry`/import types only if the compiler complains. No behavioural change here.

### 3d. Test stub registry — `test/fixtures.ts`
This file has a hand-written **parallel** registry (`createBuiltinLikeControlMutationDefaults`, ~L434-610) plus the helpers `invalidArgumentDiagnostic` (~L161), `executionGenerator` (~L177), `expectNoArgs` (~L191), `parseIntegerArgument` (~L206), `parseStringLiteral` (~L218). Migrate it to **mirror the adapters exactly** (see Phase 4 for the per-function lower bodies — use the postgres bodies verbatim, since this stub is postgres-flavoured):
- Imports (top of file, ~L20-28): drop `ParsedDefaultFunctionCall`; add `TypedDefaultFunctionCall` to the `@internal/framework-components/control` type import. Add `import { int, num, oneOf, optional, str } from '@internal/psl-parser';` and `import type { FuncCallSig } from '@internal/psl-parser';` (the file already imports other things from `@internal/psl-parser`).
- Change `invalidArgumentDiagnostic`'s `span: ParsedDefaultFunctionCall['span']` → `span: TypedDefaultFunctionCall['span']`.
- **Delete** `expectNoArgs`, `parseIntegerArgument`, `parseStringLiteral`. Keep `invalidArgumentDiagnostic`, `executionGenerator`.
- In `createBuiltinLikeControlMutationDefaults`, give each of the 7 entries a `signature` (see the FuncCallSig table in Phase 4) and rewrite each `lower` to read typed args (see the lower bodies in Phase 4 — postgres variants). The entries here are `[name, { signature, lower, usageSignatures }]`; keep the `usageSignatures` values already present.

### 3e. `test/interpreter.defaults.test.ts` — code shifts
Only the block `it('returns diagnostics for unsupported default functions and invalid arguments', …)` (~L249-293) changes. The model has `cuid()`, `uuid(5)`, `nanoid(1)`, `dbgenerated("")`. After this change:
- `cuid()`, `uuid(5)`, `nanoid(1)` are **grammar** failures. Because they sit inside the outer `oneOf(str(), num(), bool(), …funcCall)`, a funcCall arm that matches the callee but fails on its args causes the **outer `oneOf`** to backtrack and emit its own generic `PSL_INVALID_ATTRIBUTE_SYNTAX` "Expected one of: …" diagnostic (this coarse-diagnostic behaviour is the ADR's explicit accepted trade-off, ADR 231 § "Alternatives and function calls"). So these three surface as `PSL_INVALID_ATTRIBUTE_SYNTAX` with a generic message.
- `dbgenerated("")` **parses** (empty string is a valid `str()`), then `lowerDbgenerated`'s empty check fires → **`PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`** (semantic, preserved).

Rewrite the `expect(...).toEqual(expect.arrayContaining([...]))` to:
```ts
expect(result.failure.diagnostics).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ code: 'PSL_INVALID_ATTRIBUTE_SYNTAX', sourceId: 'schema.prisma' }),
    expect.objectContaining({
      code: 'PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT',
      sourceId: 'schema.prisma',
      message: expect.stringContaining('dbgenerated'),
    }),
  ]),
);
```
Leave every other block in this file unchanged (they use valid calls — `uuid()`, `uuid(7)`, `nanoid()`, `dbgenerated("…")`, `now()` — which still lower correctly; and the `token String? @default(nanoid())` optional-execution-default block at ~L295 whose diagnostic is an applicability check, not arg-parsing). **Run the whole file and fix only what actually fails.**

### 3f. `test/default-function-registry.test.ts` — heavy rework
This file drives `lowerDefaultFunctionWithRegistry` **directly**, bypassing the grammar. Post-migration, arity/shape is grammar-enforced, so cases that fed malformed arg *counts/shapes* to `lower` test impossible states and must go.
- Change the `call(...)` helper to build the typed shape:
```ts
import type { TypedDefaultFunctionCall } from '@internal/framework-components/control';
function call(fn: string, args: Record<string, unknown> = {}): TypedDefaultFunctionCall {
  return { fn, span: createSpan(), args };
}
```
- Custom registries typed `Map<string, DefaultFunctionRegistryEntry>` → `Map<string, ControlMutationDefaultEntry>` (import `ControlMutationDefaultEntry` instead of `DefaultFunctionRegistryEntry`); their `lower: () => ({...})` bodies are fine (they ignore the call).
- KEEP + migrate to typed calls:
  - `cuid(2)` → `cuid2` (`call('cuid', { version: 2 })`). **Delete** the `cuid()` rejection half of that test (arity is now grammar; `lowerCuid` no longer rejects).
  - `derives unknown-function supported list from registry keys` (`call('mystery')`) — keep.
  - `uses contributed usage signatures when provided` — keep.
  - `lists supported signatures for unknown generator-like function names` (`call('uuidv7')`) — keep.
- **Delete** (these tested deleted imperative parsing / now-grammar arity):
  - `returns diagnostics for nanoid and dbgenerated invalid argument shapes` (nanoid too-many, dbgenerated no-arg, dbgenerated non-string).
  - `preserves escaped dbgenerated string content` — the un-quoting/un-escaping now lives in `str()` at parse time; this direct-lower test no longer exercises it. Delete it (its concern is covered by psl-parser `str()` tests + the sqlite canonicalization tests).
- OPTIONAL keep: a dbgenerated empty-string semantic case — `call('dbgenerated', { expression: '' })` → `ok:false`, code `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`.

### 3g. `test/composed-mutation-defaults.test.ts`
Not expected to reference the call shape, but **run it** and fix any fallout from the entry-type change (e.g. a registry literal now needing `signature`). Keep changes minimal.

Gate: `pnpm --filter @internal/sql-contract-psl typecheck && pnpm --filter @internal/sql-contract-psl test`.

---

## Phase 4 — Adapters

### FuncCallSig table (identical for postgres + sqlite)
```ts
const nowSig: FuncCallSig = {};
const autoincrementSig: FuncCallSig = {};
const ulidSig: FuncCallSig = {};
const uuidSig: FuncCallSig = { positional: [{ key: 'version', type: optional(oneOf(num(4), num(7))) }] };
const cuidSig: FuncCallSig = { positional: [{ key: 'version', type: num(2) }] };
const nanoidSig: FuncCallSig = { positional: [{ key: 'size', type: optional(int({ min: 2, max: 255 })) }] };
const dbgeneratedSig: FuncCallSig = { positional: [{ key: 'expression', type: str() }] };
```

### Lower bodies (read typed args off `input.call.args`; no imperative parsing; no casts — use `typeof` guards / literal comparisons on `unknown`)
```ts
// no-arg functions ignore the call entirely:
function lowerAutoincrement(): LoweredDefaultResult {
  return { ok: true, value: { kind: 'storage', defaultValue: { kind: 'function', expression: 'autoincrement()' } } };
}
function lowerNow(): LoweredDefaultResult {
  return { ok: true, value: { kind: 'storage', defaultValue: { kind: 'function', expression: 'now()' } } };
}
function lowerUlid(): LoweredDefaultResult {
  return executionGenerator('ulid');
}
// version is grammar-guaranteed 4 | 7 | undefined:
function lowerUuid(input: { call: TypedDefaultFunctionCall; context: DefaultFunctionLoweringContext }): LoweredDefaultResult {
  return input.call.args.version === 7 ? executionGenerator('uuidv7') : executionGenerator('uuidv4');
}
// version is grammar-guaranteed to be 2 (required num(2)):
function lowerCuid(): LoweredDefaultResult {
  return executionGenerator('cuid2');
}
// size is grammar-guaranteed number(2..255) | undefined:
function lowerNanoid(input: { call: TypedDefaultFunctionCall; context: DefaultFunctionLoweringContext }): LoweredDefaultResult {
  const size = input.call.args.size;
  return typeof size === 'number' ? executionGenerator('nanoid', { size }) : executionGenerator('nanoid');
}
```
Postgres `lowerDbgenerated` (expression grammar-guaranteed string; empty check is the only surviving semantic guard):
```ts
function lowerDbgenerated(input: { call: TypedDefaultFunctionCall; context: DefaultFunctionLoweringContext }): LoweredDefaultResult {
  const expression = input.call.args.expression;
  if (typeof expression !== 'string' || expression.trim().length === 0) {
    return invalidArgumentDiagnostic({
      context: input.context,
      span: input.call.span,
      message: 'Default function "dbgenerated" argument cannot be empty.',
    });
  }
  return { ok: true, value: { kind: 'storage', defaultValue: { kind: 'function', expression } } };
}
```
Sqlite `lowerDbgenerated` (same, plus the existing `NOW_SYNONYMS` canonicalization on the trimmed value):
```ts
function lowerDbgenerated(input: { call: TypedDefaultFunctionCall; context: DefaultFunctionLoweringContext }): LoweredDefaultResult {
  const raw = input.call.args.expression;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return invalidArgumentDiagnostic({
      context: input.context,
      span: input.call.span,
      message: 'Default function "dbgenerated" argument cannot be empty.',
    });
  }
  const trimmed = raw.trim();
  const expression = NOW_SYNONYMS.has(trimmed.toLowerCase()) ? 'now()' : trimmed;
  return { ok: true, value: { kind: 'storage', defaultValue: { kind: 'function', expression } } };
}
```

### 4a. `packages/3-targets/6-adapters/postgres/src/core/control-mutation-defaults.ts`
- Import: replace `ParsedDefaultFunctionCall` with `TypedDefaultFunctionCall` in the `@internal/framework-components/control` import. Add `import { int, num, oneOf, optional, str } from '@internal/psl-parser';` and `import type { FuncCallSig } from '@internal/psl-parser';` (this package already depends on `@internal/psl-parser`).
- Change `invalidArgumentDiagnostic`'s `span: ParsedDefaultFunctionCall['span']` → `TypedDefaultFunctionCall['span']`.
- **Delete** `expectNoArgs`, `parseIntegerArgument`, `parseStringLiteral`. Keep `invalidArgumentDiagnostic`, `executionGenerator`.
- Replace the 7 `lowerX` bodies with the Phase-4 versions.
- Add the FuncCallSig consts and put `signature: <sig>` on each entry in `postgresDefaultFunctionRegistryEntries` (keep the existing `usageSignatures`). The `satisfies ReadonlyArray<readonly [string, ControlMutationDefaultEntry]>` stays.

### 4b. `packages/3-targets/6-adapters/sqlite/src/core/control-mutation-defaults.ts`
- **Add `@internal/psl-parser` to this package's `package.json` dependencies** (`"@internal/psl-parser": "workspace:0.14.0"`) — it is not currently a dependency and `pnpm lint:deps` will fail without it. After editing package.json run `pnpm install --lockfile-only` (or `pnpm install`) so the workspace link + lockfile update.
- Imports: it currently derives `type ParsedDefaultFunctionCall = Parameters<DefaultFunctionLoweringHandler>[0]['call'];` (L26) — **delete that alias**. Add `TypedDefaultFunctionCall` to the `@internal/framework-components/control` import (the file already imports `ControlMutationDefaultEntry, MutationDefaultGeneratorDescriptor` from there). Add `import { int, num, oneOf, optional, str } from '@internal/psl-parser';` and `import type { FuncCallSig } from '@internal/psl-parser';`. Keep the `DefaultFunctionLoweringContext` / `LoweredDefaultResult` imports (adjust source if needed so they still resolve).
- Change `invalidArgumentDiagnostic`'s `span: ParsedDefaultFunctionCall['span']` → `TypedDefaultFunctionCall['span']`.
- **Delete** `expectNoArgs`, `parseIntegerArgument`, `parseStringLiteral`. Keep `NOW_SYNONYMS`, `invalidArgumentDiagnostic`, `executionGenerator`.
- Replace the 7 `lowerX` bodies (use the sqlite `lowerDbgenerated`), add FuncCallSig consts, put `signature` on each entry in `sqliteDefaultFunctionRegistryEntries`.

### 4c. Adapter tests — `…/postgres/test/control-mutation-defaults.test.ts` and `…/sqlite/test/control-mutation-defaults.test.ts`
Both build calls by hand and invoke `handler.lower(...)`. The `lower` input is now `TypedDefaultFunctionCall`, and arity/shape rejections no longer come from `lower`.
- Replace the `makeCall` + `arg` helpers with:
```ts
function makeCall(fn: string, args: Record<string, unknown> = {}) {
  return { fn, span: stubSpan, args };
}
```
  (delete `arg`, and in the postgres file delete `spanlessArg`.)
- **postgres** — keep & migrate these success cases to `makeCall(fn, argsRecord)`:
  - `autoincrement()`→`makeCall('autoincrement')`; `now()`→`makeCall('now')`; `ulid()`→`makeCall('ulid')`; `nanoid()`→`makeCall('nanoid')`
  - `uuid()`→`makeCall('uuid')` (uuidv4); `uuid(7)`→`makeCall('uuid', { version: 7 })`; `uuid(4)`→`makeCall('uuid', { version: 4 })` (uuidv4)
  - `cuid(2)`→`makeCall('cuid', { version: 2 })` (cuid2)
  - `nanoid(16)`→`makeCall('nanoid', { size: 16 })` (params.size 16)
  - `dbgenerated("gen_random_uuid()")`→`makeCall('dbgenerated', { expression: 'gen_random_uuid()' })`
  - keep `contains all builtin default function entries` and everything from `describe('createPostgresMutationDefaultGeneratorDescriptors'…)` onward unchanged.
  - keep the empty-string semantic rejection: `makeCall('dbgenerated', { expression: '' })` → `{ ok: false }`.
  - **Delete** every rejection test that exercised arity/shape via `lower`: cuid()-without-version, dbgenerated()-without-arg, uuid invalid-version, uuid too-many-args, nanoid out-of-range, autoincrement-with-args, cuid invalid-version, cuid too-many-args, nanoid too-many-args, dbgenerated non-string, now-with-args, ulid-with-args, uuid non-numeric, nanoid non-integer, and **all** the `spanlessArg` fallback tests.
- **sqlite** — migrate the dbgenerated canonicalization tests. `str()` already un-quotes, so pass the **un-quoted** value:
  - `makeCall('dbgenerated', { expression: 'CURRENT_TIMESTAMP' })` → `now()`
  - `makeCall('dbgenerated', { expression: 'current_timestamp' })` → `now()`
  - `makeCall('dbgenerated', { expression: "datetime('now')" })` → `now()`
  - `makeCall('dbgenerated', { expression: 'random()' })` → `random()`
  - keep the descriptor/runtime blocks unchanged.

### 4d. Coverage
Deleting the imperative helpers + their tests changes per-file branch coverage for `control-mutation-defaults.ts`. Run each adapter package's coverage and confirm no per-file threshold regression:
- `pnpm --filter @internal/adapter-postgres test` then `pnpm --filter @internal/adapter-postgres test:coverage` (or the package's coverage script — check `package.json` `scripts`).
- `pnpm --filter @internal/adapter-sqlite test` (+ coverage script).
If a surviving branch (e.g. `lowerNanoid`'s `typeof size` false path, `lowerUuid`'s non-7 path, `lowerDbgenerated`'s empty path) is uncovered, the success tests above should cover it — if coverage still dips, add one minimal `lower` test for the missing branch (do NOT re-introduce arity tests).

Gate: `pnpm --filter @internal/adapter-postgres typecheck && test`; `pnpm --filter @internal/adapter-sqlite typecheck && test`.

---

## Scope
**In:** everything in Phases 1-4. **Out:** removing `ParsedDefaultFunctionCall` / `DefaultFunctionRegistryEntry` / `DefaultFunctionLoweringHandler` (leave defined); Mongo `@default`; the language-server autocomplete; ADR 231 edits (the orchestrator updates the ADR + slice spec separately).

## Constraints
No `any`; **no bare `as`** — the only cast is the single justified `blindCast<FuncCallSig, …>` in `buildDefaultSpec`; the `lower` bodies must be cast-free (use `typeof`/literal comparisons on `unknown`). No file-extension imports. Never suppress biome. Tests-first. `git commit -s` (DCO), explicit staging, no `--amend`, **no push** (the orchestrator pushes). Read-only on `projects/**` and `.agents/**`. Do NOT touch GitHub.

## Gates (all must pass, in order)
1. `pnpm --filter @internal/framework-components build && pnpm --filter @internal/framework-components typecheck && pnpm --filter @internal/framework-components test`
2. `pnpm --filter @internal/psl-parser build && pnpm --filter @internal/psl-parser typecheck && pnpm --filter @internal/psl-parser test`
3. `pnpm --filter @internal/sql-contract-psl typecheck && pnpm --filter @internal/sql-contract-psl test`
4. `pnpm --filter @internal/adapter-postgres typecheck && pnpm --filter @internal/adapter-postgres test` (+ its coverage script)
5. `pnpm --filter @internal/adapter-sqlite typecheck && pnpm --filter @internal/adapter-sqlite test` (+ its coverage script)
6. `pnpm fixtures:check` — clean
7. `pnpm lint:framework-vocabulary` (bump the threshold in the linter config to the exact new count ONLY if kit-comment wording moved it; prefer rewording), and `pnpm lint:deps` (must be 0 — this is where a missing `psl-parser` dep on adapter-sqlite would surface).

## Report back
- The final `TypedDefaultFunctionCall` (core) + `TypedFuncCall` (psl-parser) shapes and confirmation `funcCall`'s no-signature path is unchanged.
- The `buildDefaultSpec` diff (the single `blindCast<FuncCallSig>` and the `.entries()` map).
- Confirmation each adapter `lower` is cast-free; the deleted helpers (`expectNoArgs`/`parseIntegerArgument`/`parseStringLiteral`) per file.
- Which test cases you deleted vs migrated in `default-function-registry.test.ts` and the two adapter test files, and the final assertion shape for the `interpreter.defaults.test.ts` block.
- `pnpm lint:deps` result; the `adapter-sqlite` package.json dep addition; vocab threshold (moved or not).
- All gate results and the commit SHA.
- If anything forces a bare `as`, an `any`, a second cast, or a red gate you can't resolve from this brief — STOP and report the blocker with the exact error. Do NOT use the search tool to work around it.
