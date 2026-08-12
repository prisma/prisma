# Brief: D9 — prune added comments on PR #891

> On the slice-1 PR branch `tml-2956-typed-attribute-parsers`. **Comment-deletion only — do not change any code, types, or behaviour.** Do NOT push or touch GitHub.

## Task
Go through **every comment ADDED by this branch** and remove the ones that don't earn their place. Get the added comments with:
`git --no-pager diff origin/main...HEAD --diff-filter=d -- 'packages/**/*.ts'` (source + test `.ts` under `packages/**`). Work file-by-file through the added `//` and `/** */` comments.

### Remove a comment if it does any of these (the operator's criteria):
1. **Narrates what a function/method body does** (step-by-step of the implementation).
2. **Restates information already obvious from the signature or type** (name, params, return type).
3. **Enumerates the usages** of an internal type/function.
4. **Refers to transient artifacts** — specs, Linear issues, review comments, dispatch/project docs, operator decisions.
5. **Refers to removed code or an overruled decision** — e.g. "the previous engine", "was X before", "no longer …".

### Keep a comment ONLY if it answers **why** a specific line/function exists **and that why is not obvious**.
- If a comment is **mixed** (some narration + a real non-obvious why), **trim it to just the why** rather than deleting wholesale.
- When in doubt between keep and remove, **remove** — the operator wants a lean result.

## Calibration (from this diff — apply the same judgment everywhere)

**REMOVE (narration / restatement):**
- `str.ts`: "Parses a quoted string-literal argument into its decoded value." (restates `str(): ArgType<string>`).
- `list.ts` JSDoc: "Lifts an element combinator over a […] array literal into T[], threading each element through `of` and enforcing the optional surface constraints. Element errors are collected and propagated; nonEmpty and unique add their own diagnostics…" (narrates the body).
- `interpret.ts` `interpretAttribute` JSDoc: the paragraph narrating the single-pass algorithm ("A positional argument binds to the next unconsumed slot… After the pass, optional defaults fill…") — body narration.
- `field-attribute.ts`: "Builds a field-level AttributeSpec. The output type is inferred from the positional and named parameters…" (restates signature).
- `types.ts` field docs that restate: "Human-readable label, for 'expected …' diagnostics", "Identifier of the source… stamped onto diagnostics", "The output key this slot writes into", "The declaring model; the resolution target for a self-scoped field reference" (restate the field name/type).
- `utils/src/types.ts`: "Flattens an intersection of mapped types into a single readable object type." / "Collapses a union into the intersection of its members." (WHAT, not WHY).

**KEEP (non-obvious why):**
- `types.ts` `_out` field: "Phantom carrier for T; never read at runtime." (explains why an unused field exists).
- `types.ts` `InterpretCtx` "Deliberately lean: codec-lookup / default-function-registry handles are added only once a combinator needs them, so the kit does not pull those dependencies into the parser layer before they are used." (why the ctx is minimal).
- `types.ts` `diagnosticCode` field: "…so a combinator emits with the attribute's code rather than a hard-coded generic." (why the field is threaded).
- `types.ts` `InferAttr`: "The parameter is intentionally unconstrained: Out sits contravariantly in refine, so a constraint would reject every spec that uses a cross-argument refine." (non-obvious type why).
- `field-ref.ts`: the note that a cross-space referenced model is out of scope so existence is carried through unchecked (non-obvious why the miss is silent) — trim any body-narration around it, keep the why.

**TRIM (mixed):**
- `interpret.ts` `duplicateDiagnostic` JSDoc: "…keeping each error path's span no coarser than the previous engine." — "the previous engine" is a removed-code reference (criterion 5). Keep the *why* the span anchoring differs (repeated-named → arg node; alias collision → whole attribute) only if non-obvious; drop the "previous engine" reference. If what remains is just narration, remove it.
- `one-of.ts` JSDoc: mostly narrates "tries each in order, first wins". Trim to the one non-obvious point (Result-pure leaves ⇒ a discarded branch leaves no stray diagnostics) if you judge it non-obvious; otherwise remove.

## Constraints
- **Only delete/trim comments.** No code, type, signature, or behaviour change. A JSDoc that's the only thing above an export may be removed entirely — that's fine.
- Don't touch comments that existed before this branch (only ones ADDED by `origin/main...HEAD`).
- Explicit-staging commit(s) with sign-off (`git commit -s`), no push. Read-only on `projects/**`, `spec.md`, plan files (this task is about `packages/**` code comments, not the project docs).

## Completed when
- [ ] Every added comment reviewed against the criteria; narration/restatement/enumeration/transient-ref/removed-ref comments removed; mixed ones trimmed to the why; only non-obvious why-comments remain.
- [ ] Gates green (proving no code was accidentally deleted): `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl typecheck && test`; `pnpm --filter @internal/utils typecheck`.

## Report
Return a per-file summary: which comments you REMOVED, which you TRIMMED (before→after gist), and which you KEPT with the one-line why each survived. Commit SHA(s). Flag any comment you were genuinely torn on for the orchestrator's call. Model tier: thorough (judgment per comment).
