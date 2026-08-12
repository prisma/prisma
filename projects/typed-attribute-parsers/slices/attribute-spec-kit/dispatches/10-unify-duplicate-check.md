# Brief: D10 — unify the engine's duplicate-argument check (PR #891 review)

> On the slice-1 PR branch `tml-2956-typed-attribute-parsers`. Operator review comments on `interpret.ts`. Do NOT push or touch GitHub.

## Context
`packages/1-framework/2-authoring/psl-parser/src/attribute-spec/interpret.ts` — the single-pass `interpretAttribute`. It currently has **two separate `seen` checks** (one in the positional branch ~L53, one in the named branch ~L86) and tracks an `Origin` (`'positional' | 'named'`) so `duplicateDiagnostic` can vary its message/span by how each side was bound.

Operator comments:
- **`interpret.ts:86`** — "Can't you check this once at the start of the loop instead of doing separate check for named and positional args? `const key = param.key ?? arg.name(); if (seen.has(key)) { … }`"
- **`interpret.ts:92`** — "Why does it matter if the argument is named?" (i.e. drop the named-vs-positional distinction in the duplicate handling).

## Task
Refactor the loop so the duplicate check happens **once**, uniformly:
- Per iteration, resolve `(key, param)` in the two entry branches, keeping their necessary bailouts:
  - **Positional** (`arg.name()` undefined): take `spec.positional[positionalSlot]`; if none, emit the "too many positional arguments" diagnostic (still once, flag-guarded) and `continue`; else `key = posParam.key`, `param = posParam.type`, advance `positionalSlot`.
  - **Named**: look up `spec.named[name]`; if unknown, emit the "unknown argument" diagnostic and `continue`; else `key = name`, `param = that`.
- **Then a single** `if (seen.has(key))` → emit **one uniform** duplicate diagnostic **anchored to the current arg node** (`nodePslSpan(arg.syntax, ctx.sourceFile)`), and `continue`. Otherwise `seen.add(key)` and parse the value into `output[key]`.
- **Drop the `Origin` type**, make `seen` a `Set<string>`, and **delete `duplicateDiagnostic`'s two-branch logic** — replace with one message (e.g. `Attribute "<name>" received duplicate argument "<key>"`). The named-vs-positional distinction goes away entirely (answers comment :92: it doesn't matter).

## Parity / test impact (verify + update intentionally)
- **Repeated named key** (`name: "A", name: "B"`): still arg-node span, "duplicate argument" message — unchanged.
- **Positional+named alias collision** (e.g. `@relation("Foo", name: "Bar")`): was anchored to the **whole attribute** with a "both positionally and by name" message; now anchors to the **offending arg node** (narrower → within the "spans no-coarser" bar) with the uniform message (messages may change). Update any unit test / interpreter test / fixture assertion for this case intentionally, and confirm `@relation`'s positional-or-named `name` still works and a real conflict still produces exactly one diagnostic with code `PSL_INVALID_RELATION_ATTRIBUTE`.

## Out of scope
- The `interpretRelationAttribute` wrapper (`psl-relation-resolution.ts:192`): its original complaint (renaming `map`→`constraintName`) was already removed in an earlier dispatch — it now returns `SqlRelationOutput` directly and only assembles the `InterpretCtx` + threads diagnostics. **Leave it** (it's necessary glue, not renaming). Do not remove it.
- Everything else (other attributes, Mongo, the rest of the kit).

## Completed when
- [ ] One `seen` check in the loop; `Origin` gone; `seen` is a `Set<string>`; `duplicateDiagnostic`'s branching removed (one uniform duplicate diagnostic anchored to the arg node).
- [ ] `rg "Origin\b" packages/1-framework/2-authoring/psl-parser/src/attribute-spec/interpret.ts` → zero (the removed type).
- [ ] Gates: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test`; `pnpm fixtures:check`; after `pnpm --filter @internal/psl-parser build`, workspace `pnpm typecheck`.

## Constraints
No `any`; no bare `as` (keep the existing justified `blindCast` on the output object); no file-ext imports; tests-first for the changed behaviour. Explicit-staging commit with sign-off, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Transient-ID scan on the `+` diff. Do NOT post to GitHub.

## Operational metadata
- **Model tier:** mid (bounded engine refactor with test updates).
- **Halt conditions:** unifying the span breaks a case that can't stay within the "spans no-coarser" bar (surface it); a fixture's contract output (not just diagnostics) changes.

Return the structured report: the unified-loop shape you landed, which test assertions changed (alias case), confirmation `@relation` still validates, and commit SHA.
