# Brief: D6 — dynamic enum `@default` spec (`oneOf(identifier(member)…)`)

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default` (PR #938). Do NOT push or touch GitHub. ONE signed commit.

## ⛔ TOOLING RULE (operator standing order)
**NEVER call the regex/codebase-search MCP tool — it HANGS and deadlocks the run.** SEARCH-FREE brief: every path/line/snippet inline. `rg`/`grep` in the **terminal** only if needed; reading a named file is fine. Can't proceed without searching → STOP and report "brief under-specified."

## Context
Evolve the enum `@default` path to build its spec dynamically from the enum's members, folding member-validity into the grammar (operator: Option A — the old semantic `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` becomes a `PSL_INVALID_ATTRIBUTE_SYNTAX` grammar failure). Non-enum path (D5) is done; don't touch it.

## Part A — `buildEnumDefaultSpec` (`packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts`)
Replace the static `enumDefaultSpec` (currently lines 172–174: `export const enumDefaultSpec = fieldAttribute('default', { positional: [{ key: 'member', type: bareIdentifier() }] });`) with:
```ts
export function buildEnumDefaultSpec(memberNames: readonly string[]) {
  const [first, ...rest] = memberNames.map((name) => identifier(name));
  // memberNames is non-empty for any real enum; guard defensively.
  const arms: readonly [ArgType<string>, ...ArgType<string>[]] = first === undefined ? [identifier('')] : [first, ...rest];
  return fieldAttribute('default', { positional: [{ key: 'member', type: oneOf(...arms) }] });
}
```
`identifier` is already imported (used by `controlModelSpec`). `oneOf`'s non-empty-tuple constraint is satisfied by the `[first, ...rest]` tuple annotation (same pattern D5 used for `buildDefaultSpec`; no casts). Remove the static `enumDefaultSpec` and, if now unused in this file, drop `bareIdentifier` from the imports (do NOT delete the `bare-identifier.ts` combinator yet — that's D7).
- **Edge:** a real enum always has ≥1 member; the `first === undefined` guard keeps typing total for the degenerate empty case (it produces a spec that matches nothing meaningful — acceptable, empty enums can't have a valid default anyway).
- **Verify (terminal `rg`):** no enum **list** default (`SomeEnum[] @default([...])`) is exercised today — the current `lowerEnumDefaultForField` is member-only. If none exists, keep the spec member-only (no `list` arm). If one does, STOP and report.

## Part B — rewire `lowerEnumDefaultForField` (`packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts`, lines 45–91)
- Build the spec from the enum's member names: `const spec = buildEnumDefaultSpec(enumHandle.enumMembers.map((m) => m.name));` and pass it to `interpretFieldAttribute` instead of the static `enumDefaultSpec` (update the `./sql-attribute-specs` import: `buildEnumDefaultSpec` in, `enumDefaultSpec` out).
- After a successful interpret, `interpreted.member` is guaranteed to be one of the enum's member names (the grammar enforced it), so `enumHandle.enumMembers.find((m) => m.name === interpreted.member)` always resolves. **Delete** the `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` diagnostic branch (lines ~71–80) — an unknown member is now a grammar failure. Keep a defensive `if (!match) return {};` (no diagnostic) if the type-narrowing needs it, then return the member value via the existing single `blindCast` (unchanged).
- `nodePslSpan` may become unused here — drop the import if so.

## Test edits (`packages/2-sql/2-authoring/contract-psl/test/interpreter.enum.test.ts`)
- The `@default(Critical)` (non-member) test (~line 903, asserting `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` at ~line 918): `Critical` is no longer a spec arm → `oneOf` fails → `PSL_INVALID_ATTRIBUTE_SYNTAX`. Change the asserted `code`; relax/drop the `message` matches on `Critical`/`Priority` (the kit message is `Expected one of: Low | High`). Update the test title/comment.
- The two enum shape tests already shifted in D3 (`@default("low")` / `@default(uuid())` → `PSL_INVALID_ATTRIBUTE_SYNTAX`) stay as-is.
- If `rg` finds any other `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` assertion, update it the same way.

## Constraints
No `any`; keep only the one pre-existing `blindCast` for the enum member value; no other bare `as`; no file-ext imports; never suppress biome. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `.agents/**`. Do NOT touch GitHub. Do NOT touch the non-enum path or `bare-identifier.ts` (D7).

## Gates (all must pass, in order)
1. `pnpm --filter @internal/psl-parser build`
2. `pnpm --filter @internal/psl-parser typecheck` and `pnpm --filter @internal/psl-parser test`
3. `pnpm --filter @internal/sql-contract-psl typecheck` and `pnpm --filter @internal/sql-contract-psl test`
4. `pnpm fixtures:check` — clean
5. `pnpm lint:framework-vocabulary`; `pnpm lint:deps`

Report: the `buildEnumDefaultSpec` shape + typing approach; the rewired `lowerEnumDefaultForField` (branch removed); the enum test shift; confirmation no enum-list default exists (or STOP); all gate results; and the commit SHA. If anything isn't covered here, STOP and report — no non-terminal search tool.
