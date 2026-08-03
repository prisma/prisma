# Brief: D12 — add a proper allowlist to the framework-vocabulary ratchet

> On the slice-1 PR branch `tml-2956-typed-attribute-parsers`. Operator-authorised change to main's PR #918 tooling. Replaces the earlier `threshold` bump (a blunt +1) with a real allowlist so framework-neutral compounds like `SymbolTable` stop being false-positive "table" hits. Do NOT push or touch GitHub.

## Background
`scripts/lint-framework-vocabulary.mjs` counts distinct lines in `packages/1-framework` where a forbidden term's token sequence appears (tokenizer splits camelCase + non-alphanumerics, lowercases). `SymbolTable` and the module path `symbol-table` both tokenize to `['symbol','table']`, so they match the forbidden term `table` even though `SymbolTable` is a framework-neutral PSL parser type, not SQL-family vocabulary. Today the only knob is `threshold`; an earlier dispatch bumped it `967→968` to absorb one such false positive. The operator wants a proper allowlist instead.

## Tasks

### T1 — Add allowlist support to the script (backward-compatible)
In `scripts/lint-framework-vocabulary.mjs`, add support for an optional per-scope `allow: string[]` of framework-neutral **compound terms**. Semantics:
- An `allow` term tokenizes the same way as a forbidden term (reuse `termTokens`).
- On each line, compute the token ranges covered by any `allow` term occurrence (consecutive-subsequence match, same matcher as forbidden).
- A forbidden-term match counts **only if its matched token range is NOT fully contained within an allowed range**. A line counts if it has ≥1 such uncovered forbidden match.
- So `allow: ["SymbolTable"]` (tokens `['symbol','table']`) shields the `table` token wherever it is immediately preceded by `symbol` (covering both the `SymbolTable` identifier and the `symbol-table` module path), while a bare `table` (real SQL vocabulary) elsewhere still counts.
- Absent/empty `allow` ⇒ current behaviour exactly (backward-compatible). Keep all existing exports and their signatures; `findMatchingLines(content, scope)` already receives `scope`, so read `scope.allow` there.

### T2 — Add the allowlist to the config + recompute the threshold
In `scripts/lint-framework-vocabulary.config.json`:
- Add `"allow": ["SymbolTable"]` to the `packages/1-framework` scope. (Only add entries that are genuine framework-neutral false positives; `SymbolTable` is the known one. Do not allow bare forbidden terms.)
- Run `node scripts/lint-framework-vocabulary.mjs --list`, get the new accurate `count` (it will drop — every `SymbolTable`/`symbol-table` line across framework, pre-existing + ours, is now shielded), and set `"threshold"` to that new count. This **replaces** the earlier `967→968` bump with the accurate lower number. Report the old and new threshold + how many lines the allowlist shielded.

### T3 — Extend the ratchet's own test
`scripts/lint-framework-vocabulary.test.mjs` covers the script. Add a focused test for the allow behaviour: a line containing an allowed compound (`SymbolTable` / `symbol-table`) does NOT count, while a line with the bare forbidden term (`table`) still does. Keep existing tests passing.

## Do NOT
- Do not revert the earlier honest cleanups (the removed dead `InterpretCtx.symbols` field stays removed; the "type bound" comment reword stays). The allowlist is about the ratchet's accuracy, not undoing those.
- Do not allow-list bare forbidden terms or anything that would mask genuine family-vocabulary leakage.
- Do not rename any shared module or type.

## Completed when
- [ ] `scripts/lint-framework-vocabulary.mjs` supports `scope.allow` with the range-shielding semantics above; absent `allow` = unchanged behaviour.
- [ ] Config has `"allow": ["SymbolTable"]` and a `threshold` recomputed to the new accurate count.
- [ ] `node scripts/lint-framework-vocabulary.test.mjs` (however the repo runs it — check `package.json` / how #918 wired it; likely `node --test` or a vitest) passes, including the new allow test.
- [ ] `pnpm lint:framework-vocabulary` passes (count === threshold).
- [ ] Gates unaffected: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test`; `pnpm fixtures:check`; workspace `pnpm typecheck` (after psl-parser build).

## Constraints
No `any` in the script beyond its existing style (it's plain JS/ESM — match the file's conventions). Explicit-staging commit(s) with sign-off, no amend, **no push**. Read-only on `projects/**`, `spec.md`, plan files. Do NOT touch GitHub.

## Operational metadata
- **Model tier:** thorough (touches shared tooling + its test; correctness of the shielding logic matters).
- **Halt conditions:** the allow-shielding would mask a genuine forbidden-term line (i.e. `SymbolTable` allow accidentally hides a real `table` violation) — surface it; the ratchet's test harness can't be run/extended cleanly.

Return: the shielding logic you implemented, the old→new threshold + shielded-line count, the new test, all gate results, and commit SHA(s).
