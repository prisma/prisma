# Brief: D13 — full revision of comments added in this PR

> On the slice-1 PR branch `tml-2956-typed-attribute-parsers`. Comment-only revision — change no code/behaviour. Do NOT push or touch GitHub.

## Operator direction (verbatim intent)
The "why" comments kept so far are written as **JSDoc doc-comments** (above the function/type), often with **opaque jargon** and sometimes explaining *another* symbol's behaviour. Do a **full revision of every comment this PR added**:
1. A genuine, non-obvious **"why" belongs as a terse inline comment at the specific line that implements that behaviour** — not as a doc-header on the whole function/type.
2. **Plain language, no unexplained jargon.** Kill "pinned-only", "open form", "Result-pure", etc. — either explain the mechanism in ordinary words or drop it.
3. A comment must not document a *different* symbol's behaviour (e.g. `oneOf`'s rationale living on `identifier`).
4. Remaining doc-headers that merely narrate/restate get removed (as in the earlier pruning pass) — this pass additionally *relocates* the survivors inline.

Operator's three explicit complaints (address these exactly):
- `identifier.ts` — "Wtf is pinned only? Wtf is open form? Why is doc for `oneOf` in the `identifier` method?"
- `field-ref.ts` — the function doc-comment "does not belong to a doc comment".
- `one-of.ts` — "wtf is result-pure?"

## Per-file target relocations (apply this, then sweep the rest of the added comments the same way)

**`combinators/identifier.ts`** — delete the header doc. The only non-obvious thing is the `const N` type param; put a short inline comment on the signature line, e.g.:
`// `const N` keeps each name's literal type, so `oneOf(identifier('a'), identifier('b'))` infers `'a' | 'b'`.`

**`combinators/field-ref.ts`** — delete the header doc; delete the `FieldRefScope` doc (its purpose is obvious from `scope === 'self' ? ctx.selfModel : ctx.resolveReferencedModel()`). Put the real why **inline at the `if (model !== undefined && …)` existence check**, plain, e.g.:
`// A cross-space target can't be resolved here (resolveReferencedModel returns undefined); skip the existence check — it runs where the target model is known.`

**`combinators/one-of.ts`** — delete the header doc. Put a plain inline comment at the fallthrough `return notOk([… aggregate …])` (and/or the loop) explaining the mechanism without "Result-pure", e.g.:
`// Each alternative returns its own diagnostics rather than writing to a shared list, so failed attempts leave nothing behind; if none match we report a single aggregate error.`

**`attribute-spec/types.ts`** — this file is mostly type declarations; relocate the survivors and drop the rest:
- `ArgType` header ("Parsing is pure…"): drop the header; if worth keeping, a short inline note on the `parse(...)` line — "returns diagnostics rather than pushing to a shared list, so `oneOf` can discard a failed branch". Plain.
- `kind` field: reduce to a terse inline "discriminant for print/completion dispatch" or drop.
- `_out` field: keep terse inline "phantom carrier for `T`; never read at runtime" (it explains a genuinely puzzling unused field).
- `InterpretCtx` "Deliberately lean…" header: **drop** — it defends an absence (future fields), not a why about existing code.
- `diagnosticCode` field doc: move the why to **`interpret.ts`** at the `const leafCtx = { ...ctx, diagnosticCode: code }` line — "stamp the spec's code onto ctx so leaf diagnostics carry the attribute's code, not a generic one". Leave the field itself with at most a terse note.
- `OptionalArgType` "Because it extends ArgType…" header: reduce to a terse inline note on the `optional: true` marker, or drop (the engine's `'optional' in param` check makes it clear).
- `AttributeSpec.diagnosticCode` doc ("Defaults to…"): drop or reduce to terse; the default lives in `interpret.ts` (`spec.diagnosticCode ?? DEFAULT_STRUCTURAL_CODE`).
- `InferAttr` header (the contravariance why): this **is** a why about that exact line — move it inline onto the `export type InferAttr<S> = …` line, condensed + plain, e.g.:
  `// S is unconstrained on purpose: refine makes Out contravariant, so `S extends AttributeSpec<unknown>` would reject every spec that uses refine.`

**`combinators/diagnostic.ts`** — reduce `leafDiagnostic`'s doc to a terse note (or inline at the stamping line): it stamps `ctx.diagnosticCode` so every leaf diagnostic carries the attribute's code.

**Sweep everything else** added by this PR (`git --no-pager diff origin/main...HEAD -- 'packages/**/*.ts'`, plus `psl-relation-resolution.ts`'s `relationInvariants` / `normalizeReferentialAction` notes): apply the same rule — inline terse why at the implementing line, plain language, or remove.

## Constraints & gotchas
- **Comment-only.** No code, signature, or behaviour change. (Cast-reason strings inside `blindCast<T, '…'>` are code arguments, not comments — leave them.)
- **Re-run the vocabulary ratchet.** The ratchet counts *file lines* containing forbidden tokens, so editing comments can change the count. After the revision run `pnpm lint:framework-vocabulary`; if `count` changed, set `threshold` in `scripts/lint-framework-vocabulary.config.json` to the new count (the `allow: ["SymbolTable"]` entry stays). Report the old→new threshold.
- Explicit-staging commit with sign-off, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Completed when
- [ ] Every added comment reviewed; non-obvious whys are terse **inline** comments at their implementing line in plain language; no `pinned-only`/`open form`/`Result-pure`-style jargon remains; no comment documents another symbol's behaviour.
- [ ] `pnpm lint:framework-vocabulary` passes (threshold updated if the count moved).
- [ ] Gates (prove no code changed): `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test`; `pnpm fixtures:check`; workspace `pnpm typecheck` after psl-parser build.

## Operational metadata
- **Model tier:** thorough (judgment per comment + placement).
- **Halt conditions:** a relocation would require a code change to make sense (surface it); the ratchet can't be satisfied by a threshold update matching the new count.

Return a per-file summary: what moved inline (before doc → after inline, with the line it now sits on), what was dropped, the ratchet old→new threshold, gate results, and commit SHA.
