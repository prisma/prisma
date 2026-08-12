# Brief: D4 — address PR #891 review round 1

> Fresh implementer (session resume unavailable). Read the committed kit + the commented files first. This addresses a review round on the open slice-1 PR; changes land on branch `tml-2956-typed-attribute-parsers` and update the PR. **Do NOT post to GitHub or resolve review threads** — only push commits.

## Context
- PR #891 (slice 1). Reviewers: CodeRabbit (bot) + the operator (SevInf). Files: `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/` (engine + combinators), `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` (the `sqlRelation` spec), `interpreter.ts`.
- Slice spec + the project parity bar: `projects/typed-attribute-parsers/slices/attribute-spec-kit/spec.md`, `projects/typed-attribute-parsers/spec.md` (codes byte-identical; spans no-coarser; messages may change; stricter rejection of malformed input is allowed).

## Tasks (address each; commit coherently)

### T1 — Reject duplicate arguments unconditionally (interpret.ts)
- The named-argument loop (`if (namedSeen.has(key)) continue;`, ~line 55) currently **silently drops** a duplicate named key. Change it to emit a structural diagnostic (code `ctx`/`spec.diagnosticCode`, anchored to the duplicate arg's span via `nodePslSpan(arg.syntax, ctx.sourceFile)`) and not count the duplicate as a successful parse.
- The positional-vs-named alias merge in `resolveKey` (~lines 107-123) currently only emits a conflict when the two values **differ** (`!argValuesEqual(...)`). Per the operator: a key supplied **both** positionally and by name is a duplicate — reject it **regardless of value equality**. Emit the conflict/duplicate diagnostic whenever `fromPositional && fromNamed`. 
- **Remove the now-dead `argValuesEqual` + `isPlainRecord` helpers** (they existed only for the value-equality escape hatch).
- Add/adjust unit tests: `name: "A", name: "B"` and `name: "A", name: "A"` both rejected; `@rel("Foo", name: "Foo")` (positional + named, equal) rejected.

### T2 — `unique: true` on relation lists (psl-relation-resolution.ts, the `sqlRelation` spec)
- Change `fields: optional(list(fieldRef('self'), { nonEmpty: true }))` → add `unique: true`; same for `references`. So duplicate FK column names can't reach `foreignKeyNodes`.

### T3 — Drop the unnecessary list copy (list.ts:27)
- `const elements = [...arg.elements()]` copies the iterable. If `ArrayLiteralAst.elements()` already returns an array, iterate it directly (drop the spread). If it's a generator and you only need it for the `nonEmpty` length check, track an element count in the existing parse loop instead of materialising a second array. Keep behaviour identical; just remove the redundant allocation.

### T4 — Use `enumOf` for referential actions; delete `identifierName` (operator question identifier-name.ts:13)
- The operator's point: a referential action (`onDelete: Cascade`) is a bare-identifier enum and should go through `enumOf`, not a bespoke `identifierName` leaf. **Extend `enumOf`** to also accept a bare `IdentifierAst` whose text matches a **string** member (in addition to the existing `StringLiteralExprAst`/`NumberLiteralExprAst` handling) — additive, must not regress existing `enumOf` tests.
- In `sqlRelation`, change `onDelete`/`onUpdate` to `optional(enumOf('NoAction', 'Restrict', 'Cascade', 'SetNull', 'SetDefault'))`. Map the validated action to the `ReferentialAction` via the existing `REFERENTIAL_ACTION_MAP` (keep `normalizeReferentialAction` as the pure token→action mapper, or inline the map — your call; do not keep a redundant second validation path).
- **Delete `identifierName` + its tests + its export.**
- **Parity flag (report this):** a bad referential action now errors at parse via `enumOf` with the attribute's code (`PSL_INVALID_RELATION_ATTRIBUTE`) instead of downstream `PSL_UNSUPPORTED_REFERENTIAL_ACTION`. If any test/fixture asserts `PSL_UNSUPPORTED_REFERENTIAL_ACTION`, update it intentionally and **report the exact count + files** so the orchestrator can relay to the operator. If that code turns out to be load-bearing elsewhere (non-`@relation`), **halt and surface** instead of deleting its only producer.

### T5 — `fieldRef` resolves via the symbol table (operator question field-ref.ts:30)
- The operator wants `fieldRef` to actually resolve the field against the symbol table it has in `ctx` (`selfModel` for `'self'`, `resolveReferencedModel()` for `'referenced'`), not treat the name as opaque. Implement resolution: look the field up on the scoped model; **if it doesn't resolve, emit the field-existence diagnostic here** (code = `ctx.diagnosticCode`, span = the identifier's span).
- **Reconcile downstream to avoid double diagnostics:** the SQL interpreter currently validates relation `fields`/`references` existence downstream (the `localColumns`/`referencedColumns` resolution in `interpreter.ts`). With `fieldRef` now validating, remove/skip that **duplicate** existence check **for the relation `@relation` path only**, so a missing field yields exactly one diagnostic. Keep the column-name mapping (the resolved field still maps to its column).
- Preserve diagnostic **code + span** parity for the missing-field case (verify against `interpreter.relations.test.ts` / `interpreter.diagnostics.test.ts`); if the diagnostic's code/span/source must shift, update assertions intentionally and report.
- **Halt and surface if** this reconciliation requires large interpreter surgery, touches non-relation field resolution, or can't preserve the cross-space/referenced-model resolution the interpreter already does. Better to surface than to sprawl.
- Keep `fieldRef`'s parsed value as the **name string** (so the `ParsedRelationAttribute` mapping is unchanged); resolution drives validation, not the return shape.

## Scope
**In:** the five tasks above (psl-parser engine + `list`/`enumOf`/`field-ref` combinators, delete `identifier-name`; the `sqlRelation` spec + the relation call-site existence-check reconciliation in `interpreter.ts`). Tests for each.
**Out:** other attributes (slices 2–3); the rest of ADR 231's alphabet; Mongo; `@db.*`. Do not migrate a second attribute.

## Completed when
- [ ] T1–T5 done; `identifierName` fully removed (`rg identifierName` zero).
- [ ] `rg "argValuesEqual"` zero (helper removed).
- [ ] Unit tests updated/added for T1, T3, T4 (enumOf bare-identifier), T5 (fieldRef resolution: resolves a real field; emits one diagnostic for a missing field).
- [ ] Gates green: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test` (or the package's real name — confirm); `pnpm fixtures:check`; after `pnpm --filter @internal/psl-parser build`, workspace `pnpm typecheck`.
- [ ] Report: the T4 parity flag (code change + any updated assertions/fixtures, with counts) and the T5 reconciliation (what downstream check was removed, diagnostic parity result).

## Standing instruction
Stay focused on the goal; control scope. Halt + surface (don't sprawl) if T5's downstream reconciliation balloons or T4's code change hits load-bearing non-relation uses.

## Constraints
No `any`; no bare `as` (narrow `blindCast`/`castAs` with reason, or types that avoid it); no file-ext imports; no reexport outside `exports/`; tests-first for new behaviour. Explicit-staging commits, no amend, **no push** (the orchestrator pushes). Read-only on `projects/**/reviews/**`, `spec.md`, plan files. Run the transient-ID scan on your `+` diff. Do NOT post to GitHub or touch review threads.

## Operational metadata
- **Model tier:** thorough (parity-sensitive, cross-package, two design changes).
- **Halt conditions:** T5 downstream reconciliation requires large surgery / touches non-relation paths; T4 reveals `PSL_UNSUPPORTED_REFERENTIAL_ACTION` is load-bearing elsewhere; any fixture's contract output (not just diagnostics) changes.

Return the structured report per § Return shape, with explicit per-task results (T1–T5), the parity flags, and commit SHAs.
