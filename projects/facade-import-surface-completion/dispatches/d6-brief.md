# D6 brief — Docs sweep + mongo workaround comments (slice-closing dispatch)

## Context

D1–D5d landed cleanly. D5e was formally deferred to **[TML-2633](https://linear.app/prisma-company/issue/TML-2633/mongo-facade-definecontract-wrap-collapses-inline-model-inference)** (mongo facade `defineContract` wrap collapses inline-model inference). D6 closes the slice by:

1. Flipping every prose / example-code reference to the old `@internal/target-{postgres,sqlite}/migration` specifier across docs, skills, and READMEs.
2. Removing all TML-2526 references outside `projects/`.
3. Adding workaround comments to the two mongo integration test files that deliberately stay on the verbose import form (the in-tree state preserved by spec § A8).
4. Running the final repo-wide lint + test + fixtures pass.

This is purely mechanical: every edit has an explicit file path, and most have explicit line targets.

## Read first

1. `projects/facade-import-surface-completion/dispatches/d6-brief.md` (this file).
2. `projects/facade-import-surface-completion/spec.md` § A7 (extension-pack migration files exempt from the prose flip) and § A8 (mongo workaround state — references TML-2633).
3. `projects/facade-import-surface-completion/slices/facade-completion/plan.md` § "Dispatch 6" (Done-when checklist).
4. The existing mongo workaround comment for style reference: `test/integration/test/mongo/fixtures/contract.ts` L1–3.

## Scope

### Edit 1 — `skills/prisma-next-migrations/SKILL.md` L52–62

Rewrite the paragraph that mentions TML-2526. Drop:
- The "until then" / "while TML-2526 is in flight" framing.
- The TML-2526 reference itself.
- Any example code that still uses `@internal/target-postgres/migration` — flip to `@internal/postgres/migration`.

The skill should now teach the façade form unconditionally (no caveats).

### Edit 2 — `skills/DEVELOPING.md` L86

Same flip as Edit 1: drop TML-2526 reference + any example code using the target specifier. One-line or one-paragraph edit.

### Edit 3 — `packages/1-framework/1-core/ts-render/README.md` L45

Example code in the README uses `@internal/target-postgres/migration`. Flip to `@internal/postgres/migration`.

### Edit 4 — `packages/1-framework/3-tooling/cli/README.md` L1063

Paragraph describing the scaffolded migration's import line. Flip the example specifier to `@internal/postgres/migration` (and `@internal/sqlite/migration` if both are shown).

### Edit 5 — `docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md` L9

Illustrative-code example flips to the façade specifier. **The ADR's decision text stays as-is** — it's historical record. Only the example code at L9 changes.

### Edit 6 — verify the three façade READMEs are current

Read `packages/3-extensions/{postgres,mongo,sqlite}/README.md`. Confirm each reflects its final post-D1/D2/D3 shape (subpaths listed correctly, examples use the right specifiers, BSON / control / migration sections present where applicable). Make minor touch-ups if anything's stale; do NOT rewrite wholesale.

### Edit 7 — `test/integration/test/mongo-runtime/query-builder.test.ts` (workaround comment)

Add a workaround comment at the very top of the file (above the first `import`), in the style of `test/integration/test/mongo/fixtures/contract.ts` L1–3:

```ts
// Intentionally uses verbose mongo-contract-ts import: @internal/mongo/contract-builder's
// defineContract wrap loses inline-model inference precision when consumers use
// mongoQuery<typeof contract> chains (PlanRow row shapes collapse to _id: never / count: never).
// Tracked at https://linear.app/prisma-company/issue/TML-2633 — migrate to the facade form
// once TML-2633 lands.
```

Do NOT change any of the imports or the rest of the file. The comment is the only change.

### Edit 8 — `test/integration/test/mongo/fixtures/contract.ts` (update existing workaround comment)

The existing L1–3 comment describes the symptom but predates TML-2633. Add a TML-2633 reference. Suggested edit:

```ts
// Intentionally uses verbose mongo-contract-ts import: the mongo facade's defineContract
// has a type inference regression for discriminated union contracts with embedded relations
// (the intersection-based return type loses type precision compared to the base overload).
// Tracked at https://linear.app/prisma-company/issue/TML-2633 — migrate to the facade form
// once TML-2633 lands.
```

Just add the two trailing lines that reference TML-2633. Don't restructure the existing comment.

## "Done when"

Per plan § D6:

- [ ] All eight edits above landed.
- [ ] `rg 'TML-2526' -- skills/ docs/ packages/ examples/ test/ projects/` returns hits only inside `projects/facade-import-surface-completion/`.
- [ ] `rg 'TML-2633' test/integration/test/mongo/fixtures/contract.ts test/integration/test/mongo-runtime/query-builder.test.ts` returns one hit in each file.
- [ ] `rg '@internal/target-(postgres|sqlite)/migration' -g '!**/node_modules/**'` returns only the allowed-set listed in plan § D6 Done-when (internal target source + extension-pack hand-authored migrations + cipherstash docstring + pre-existing rendered examples + D1/D3 parity bridge tests).
- [ ] `pnpm lint:deps` clean.
- [ ] `pnpm test:packages` clean.
- [ ] `pnpm test:integration` clean — modulo any pre-existing environmental flakes. If mongo tests fail with `storage.collections must be an object (was missing)`, that's [TML-2631](https://linear.app/prisma-company/issue/TML-2631) (mongo example contract.json validator drift), unrelated to D6 — note in structured return and move on.
- [ ] `pnpm test:e2e` clean (or all failures attributable to pre-existing environmental flakes — note any in structured return).
- [ ] `pnpm fixtures:check` clean.
- [ ] Intent-validation: `git diff <base>..HEAD --stat` covers only docs / skills / README files + the two mongo test-file workaround comments. No source code changes (no `src/` file modifications other than READMEs).

## How to work

1. **Heartbeat** to `wip/heartbeats/implementer.txt` every ~5 min and at commit boundaries. Format: `ts`, `role: implementer`, `agent_id` (your own), `round=D6 R1`, `phase`, `last_progress`, `next_step`.

2. **Suggested commit shape:**
   - Commit 1: prose flips (Edits 1–5 — skill + ADR + READMEs).
   - Commit 2: façade README touch-ups (Edit 6) — only if there ARE touch-ups; if everything's current, skip this commit entirely.
   - Commit 3: mongo workaround comments (Edits 7 + 8 together).
   - (Folding 1+2+3 is fine if the diff is small; keep 3 separate from 1 if you want a clean "docs vs deferred-work-comment" boundary.)

3. **NO source code changes** — only docs / skills / READMEs / the two mongo test-file comments. If you find yourself wanting to fix a typo in a `src/` file, RESIST. File a follow-up note in the structured return instead.

4. **Scope discipline:** D6 is the slice's closing dispatch. Do NOT migrate any additional fixtures. Do NOT touch the mongo facade wrap (that's TML-2633). Do NOT touch postgres / sqlite facades. Do NOT regenerate the mongo example contract.json (that's TML-2631).

5. **If a grep gate in Done-when fails with unexpected hits** (e.g. `rg 'TML-2526'` finds something outside `projects/` that you don't recognize), heartbeat with `phase: investigating-grep-gap` and describe before mass-editing.

## Begin

Heartbeat with `phase: orienting`, read the brief + spec § A7/A8 + the existing workaround comment for style. Then execute the eight edits sequentially.

## Structured return at end

- Verdict (DONE / NEEDS-FOLLOWUP).
- Commit SHAs + one-liners.
- Per-edit confirmation: each of the eight edits with a 1-line "what changed" summary.
- Gate command outputs (exit codes + test counts for the package / integration / e2e suites).
- Any TML-2631 mongo `storage.collections must be an object` failures noted as pre-existing (not D6 regressions).
- Anything noteworthy — especially any unexpected grep-gate hits during the cleanup.
