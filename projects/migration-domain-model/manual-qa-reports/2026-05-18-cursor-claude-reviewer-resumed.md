# Manual QA report — TML-2546 (Migration CLI restructure) — 2026-05-18

> **Script:** `projects/migration-domain-model/manual-qa.md` (commit `2591e1a9f` at run time)
> **Runner:** `cursor-claude-reviewer-resumed` — same LLM session that ran M1–M7 R2 code review, now flipped to runner role. Not strictly fresh-eyes for the system; however, the QA script itself was authored by `drive-qa-plan` after the M7 R2 review and I had not seen it before this run.
> **Environment:**
> - Worktree: `<worktree for `tml-2546-review-migration-cli-commands-and-vocabulary`>/`
> - Branch HEAD at start: `2591e1a9f` (`docs(qa): add manual QA script for migration CLI restructure`)
> - Working tree at start: `M projects/migration-domain-model/plan.md` (orchestrator amendment, intentional uncommitted per M7 R2 reviewer note); untracked `projects/agile-agent-orchestration/` (workspace dir).
> - Node: `v24.13.0` · pnpm: `10.27.0` · macOS (darwin 25.3.0).
> - Shell environment: non-TTY (Cursor agent shell). Per CLI Style Guide § JSON Semantics, `parseGlobalFlags` auto-enables `--json` when `!process.stdout.isTTY`, so every command in this run emitted JSON unless the format-switching logic explicitly handled the case.
> **Started:** 2026-05-18T06:23:00+02:00
> **Finished:** 2026-05-18T07:10:00+02:00
> **Verdict:** ❌ **Fail** — 2 ⚠️ High findings (one about reachability of `migration show` and the wrong-grammar diagnostics it gates; one about a `migration check <m>` per-migration false-negative on PN-005). 5 📝 Follow-ups.

## Summary

The user-facing CLI surface is overwhelmingly correct: all 7 removed-verb redirects fire with the right messages, all 5 split-status verbs have proper See-also cross-references, `migration check` graph-wide catches all PN codes I tested, the docs cross-link cleanly with no working-draft leaks, and the `docs/design/` ports read as natural permanent homes. **But two reachability/correctness gaps surfaced that user-impact more than a docs nit:** (1) the canonical demo's declared-but-unmigrated pgvector extension causes `migration show` (and the AC6 wrong-grammar diagnostics it routes through) to fail with `PN-MIG-5001` for every input shape — a real user inspecting migrations in a fresh demo state never reaches the wrong-grammar diagnostic the spec promised; (2) per-migration `migration check <m>` does NOT detect PN-005 (within-migration snapshot drift) that graph-wide `migration check` correctly catches — a false-negative on a documented integrity check, with no warning to the user that the per-migration mode has reduced coverage. Both have workarounds (run `migrate` to materialise pgvector; use graph-wide `migration check` instead of per-migration) but neither is signposted, and both reduce confidence in the new surface in exactly the diagnostic-quality dimension that AC6 and AC5 were designed to assure.

## Findings

### F-1 — ⚠️ High — `migration show` blocks on aggregate-loader pgvector violation in canonical demo state; wrong-grammar diagnostics (AC6) unreachable

**Scenario:** 3 — Wrong-grammar diagnostics point at the right verb
**Step:** All three of step 1 (ref name), step 2 (`<dir>^`), step 3 (hash prefix)
**Oracle:** Spec § FR5 wrong-grammar diagnostics table. The error must distinguish ref-from-migration in case 1 and call out `^` is contract-grammar syntax in case 2.

**Observed (all three cases produced the same envelope):**
```
$ pnpm exec prisma-next migration show production ; echo "exit=$?"
{
  "ok": false,
  "code": "PN-MIG-5001",
  "domain": "MIG",
  "severity": "error",
  "summary": "Contract-space layout violation detected",
  "why": "The on-disk `migrations/` directory and your `extensionPacks` declaration are not in agreement.\n- [declaredButUnmigrated] pgvector",
  "fix": "Run `prisma-next migrate` to materialise on-disk artefacts for declared extensions, or remove the orphan directory.",
  ...
}
exit=1
```

I also probed with a known-valid migration directory and the same `PN-MIG-5001` fires — so the verb is unreachable in this state for ALL inputs, not just wrong-grammar:
```
$ pnpm exec prisma-next migration show 20260422T0720_initial
{ ... PN-MIG-5001 ... }
exit=1
```

**With the workaround** (temporarily strip pgvector from the demo's `prisma-next.config.ts`'s `extensions: []`), all three Scenario 3 cases produce the spec-promised wrong-grammar diagnostics correctly:
- Case 1: `"production" is a ref name, not a migration` + `fix: Refs point at contracts, not migrations. Use a migration directory name or migration hash.`
- Case 2: `` `^` syntax addresses contracts, not migrations `` + `fix: Pass the migration directory name without ^, or use a contract-accepting flag like --to or --from.`
- Case 3: `Hash matched a contract but not a migration` + `fix: Use a contract-accepting flag like --to or --from to reference contracts by hash. Pass migration show <dir> for a specific migration.`

So the underlying wrong-grammar resolver works as designed. The bug is that `migration show` (an offline, read-only verb in spec FR3) calls `buildContractSpaceAggregate(...)` early in its execution, which enforces extension-layout integrity and fails before reaching `parseMigrationRef`.

**Expected (per script):** Case 1 names ref-vs-migration distinction; Case 2 calls out `^`; Case 3 explicitly distinguishes "matched contract not migration." None of those happen in the canonical state because the aggregate-loader fires first.

**Reproduction:**
- `git rev-parse HEAD` → `2591e1a9f314dfa0f20b1d5c5912161732ec7b96`
- `git status` at failure → clean (modulo intentional `M plan.md` and untracked `projects/agile-agent-orchestration/`).
- Mutated files: none — the failure is in the demo's shipped state, not in any mutation I made.
- Exact commands: as shown above (verbatim copy from shell history).

**Notes:** This is the SAME aggregate-loader path that `migration plan` and `db init` use, and they correctly need that layout check (those verbs require space consistency to plan against). But `migration show` is supposed to be a read-only inspection — requiring `migrate` (which requires a DB) before you can inspect a migration is a UX speed-bump that contradicts the offline-by-design framing in spec FR3. Two possible fixes the implementer could pick: (a) move the aggregate-loader call after `parseMigrationRef` resolution succeeds, so wrong-grammar diagnostics fire first; (b) downgrade the layout check from "fail" to "warn" for read-only verbs. Either fix recovers AC6 reachability in canonical state. Severity ⚠️ High rather than 🛑 Blocker because the verb is not crashed (it produces a structured diagnostic) and a workaround exists (run `migrate` or remove the orphan declaration), but the user-facing AC6 promise is not met for a real-world common state.

### F-2 — ⚠️ High — Per-migration `migration check <m>` does not detect PN-005 (false negative); graph-wide catches the same corruption

**Scenario:** 4 — `migration check` clean graph + planted corruption
**Step:** 4 — per-migration check after planting `end-contract.json` storageHash mutation
**Oracle:** Spec FR6 + glossary `migration check` table. Step 4's "What you should see": "exit 4 again; per-migration mode reports the same PN-005, scoped to the named migration." Failure mode: "Step 4 (per-migration) reports a different result from step 3 (graph-wide)."

**Observed (back-to-back, same corruption in `end-contract.json.storage.storageHash = sha256:dddd...`):**
```
$ pnpm exec prisma-next migration check ; echo "exit=$?"
{
  "ok": false,
  "failures": [
    {
      "pnCode": "PN-MIG-CHECK-005",
      "where": "20260422T0742_migration",
      "why": "Migration \"20260422T0742_migration\" declares to=sha256:5618dcac... but end-contract.json has storageHash=sha256:dddddddd...",
      "fix": "Re-emit the migration package so migration.json and end-contract.json agree."
    }
  ],
  "summary": "1 integrity failure(s)"
}
exit=4

$ pnpm exec prisma-next migration check 20260422T0742_migration ; echo "exit=$?"
{
  "ok": true,
  "failures": [],
  "summary": "All checks passed"
}
exit=0
```

Same on-disk state. Graph-wide catches it, per-migration reports `ok: true`. Confirmed by reading `packages/1-framework/3-tooling/cli/src/commands/migration-check.ts`: the snapshot-consistency check is implemented only in the graph-wide `else` branch (lines ~178-242), not in the per-migration `if (target)` branch (lines ~134-177). The per-migration branch performs PN-001 (`verifyMigrationHash`) and PN-002 (file existence) but never reads `end-contract.json` to compare against `metadata.to`.

**Expected (per script):** Per-migration mode reports the same PN-005.

**Reproduction:**
- `git rev-parse HEAD` → `2591e1a9f314dfa0f20b1d5c5912161732ec7b96`
- `git status` at failure → `M migrations/app/20260422T0742_migration/end-contract.json` (planted corruption; restored after capture).
- Mutated files: `end-contract.json` (recipe: mutate `storage.storageHash` to `sha256:dddd...`); restored via `git checkout --`.
- Per-migration mode DOES correctly detect PN-001 when I separately mutate `migration.json.migrationHash` — so the asymmetry is specifically PN-005 missing from per-migration, not a broader per-migration brokenness.

**Notes:** AC5 strictly requires only graph-wide (`migration check` with no argument) to catch all 5 PN codes, so the strict letter of the AC holds. But the user-facing promise is that `migration check <m>` checks _that migration_; reporting `ok: true` for a known-corrupt migration is a false negative. Easy fix: lift the PN-005 check block from the graph-wide branch into a shared helper and call it from both branches (scoped to the matched package in per-migration mode). Severity ⚠️ High rather than 🛑 Blocker because (a) AC5 graph-wide is intact, (b) the user has a workaround (use graph-wide mode), and (c) no original-bug regression. Worth filing as a follow-up ticket; could realistically land alongside the PN-005 implementation cleanup.

### F-3 — 📝 Follow-up — Top-level verb-family ordering in `prisma-next --help` doesn't match the spec's intended-surface diagram

**Scenario:** 1 — Help enumerates the intended surface
**Step:** 1 — read top-level help

**Observed:**
```
prisma-next Manage your data layer
│ ├─ contract         …
│ ├─ db               …
│ ├─ migration        …
│ ├─ migrate            Apply planned migrations to advance the database
│ ├─ ref              …
│ ├─ init               Initialize a new Prisma Next project
```

Order: `contract, db, migration, migrate, ref, init`.

**Expected (per spec § Intended surface diagram and script "What you should see"):** `init, migrate, contract, db, migration, ref` — verbs (`init`, `migrate`) before subjects (`contract`, `db`, `migration`, `ref`).

**Notes:** Especially jarring: (a) `init` is at the bottom even though it's the first verb a new user runs; (b) `migrate` sits between the `migration` namespace and the `ref` namespace, breaking the subject-grouping rhythm. Minor cosmetic finding — all verbs are present and correct; only the order is off. Script's failure mode list calls this out as "a judgement call worth surfacing."

### F-4 — 📝 Follow-up — `migrate --help`'s `--to` description lists 4 of 5 contract-reference forms (missing `<dir>^` and `./path`)

**Scenario:** 1 — Help enumerates the intended surface
**Step:** 3 — `migrate --help`

**Observed:**
```
│ --to <contract>       Target contract reference (hash, prefix, ref name, or
│                       migration dir name)
```

Lists: hash, prefix, ref name, migration dir name. Missing: `<dir>^` and filesystem path with `./` prefix.

**Expected:** The contract-reference grammar in the glossary and domain doc lists five forms. A user reading `--help` to discover what they can pass to `--to` won't learn that `<dir>^` or `./path` are accepted.

**Notes:** Same applies to other `--to`/`--from`/`--contract` help text on `migration plan`, `migration status`, `db update`, `db sign`, `ref set` — I didn't audit all of them but expect similar trimming. The trade-off is help-text brevity vs grammar completeness; would prefer "hash, prefix, ref name, migration dir, `<dir>^`, or `./path`" — six tokens, still one line.

### F-5 — 📝 Follow-up — Script's Scenario 4 planted-corruption recipe triggers PN-001, not PN-005

**Scenario:** 4 — `migration check` clean graph + planted corruption
**Step:** 2 — plant the corruption (script instructs to mutate `migration.json`'s `to` field)

**Observed:**
- Script's recipe: edit `migration.json` and replace `to` with `sha256:0000...`.
- Resulting check output: PN-001 (HASH_MISMATCH), NOT PN-005 (EDGE_MISMATCH). This is because changing `metadata.to` invalidates the recomputed `migrationHash`, and `loadMigrationPackages` throws on the hash mismatch BEFORE the PN-005 snapshot-consistency check has a chance to run.
- The right recipe to test PN-005 in isolation (which I derived to file F-2 above): mutate `end-contract.json.storage.storageHash`. With that recipe, PN-005 fires cleanly.

**Expected:** The script anticipated this failure mode (its "Failure modes" section lists "PN-001 / HASH_MISMATCH when the corruption is purely within-migration metadata vs snapshot"), so the recipe was wrong from the start.

**Notes:** Script-quality issue, not system regression. The next `drive-qa-plan` revision should update Scenario 4's plant-the-corruption step to mutate `end-contract.json` instead of `migration.json`, so the negative control actually exercises PN-005 as intended.

### F-6 — 📝 Follow-up — Domain doc says hash-prefix minimum is 8 chars; glossary and implementation say 6 chars

**Scenario:** 6 — Docs cross-links resolve and the vocabulary agrees
**Step:** 4 — vocabulary spot-checks

**Observed:**

`docs/design/10-domains/migration/README.md` § Contract reference (`<contract>`):
```
| `<hash>` or `<hash-prefix>` | Bare hex (no `sha256:` prefix). 8+ char prefixes accepted; matched against contract storage hashes. |
```

`docs/glossary.md` § Contract Reference:
```
| `<hash>` or `<hash-prefix>` | Bare hex (6+ chars), matched against contract storage hashes |
```

Implementation: `packages/1-framework/3-tooling/migration/src/refs/types.ts` line 69:
```
const HEX_PREFIX_PATTERN = /^(sha256:)?[0-9a-f]{6,}$/;
```

**Notes:** Three sources, two values. Implementation and glossary agree (6+); domain doc disagrees (8+). M7 R2's `db00396f5` reconciled the filesystem-path form but missed the prefix-length drift. Pick one: either update the domain doc to "6+ chars" (match impl + glossary), or change the impl to 8 and update both other sources. 8 has the better disambiguation property; 6 has the shorter-is-friendlier property. Worth a small design decision.

### F-7 — 📝 Follow-up — `migration graph --dot` returns JSON in non-TTY mode (auto-JSON wins over --dot)

**Scenario:** 8 — Exploratory
**Step:** Probe of `migration graph` output formats

**Observed:**
```
$ pnpm exec prisma-next migration graph --dot ; echo "exit=$?"
{
  "ok": true,
  "nodes": [...],
  "edges": [...],
  "summary": "4 node(s), 3 edge(s)"
}
exit=0
```

Adding `--color` doesn't help. The action handler in `migration-graph.ts` checks `if (flags.json) { ...JSON... } else if (options.dot) { ...DOT... }` — and `parseGlobalFlags` auto-sets `flags.json = true` when `!process.stdout.isTTY`. So a user running `prisma-next migration graph --dot | dot -Tsvg > graph.svg` gets JSON piped into `dot`, which then errors.

**Notes:** The fix is to check `options.dot` before `flags.json` in the action handler (`--dot` is more specific than the auto-JSON default), or alternatively to suppress the non-TTY JSON auto-enable when an output-format flag is explicitly set. The same pattern probably affects any other format-switching flag the CLI adds in future; worth establishing a convention in the Style Guide.

### F-8 — 📝 Follow-up — `where` field format inconsistent across `migration check` PN codes

**Scenario:** 8 — Exploratory
**Step:** Probe of PN-001 (per-migration) corruption diagnostic

**Observed:**
PN-001 `where`:
```
"where": "<worktree for `tml-2546-review-migration-cli-commands-and-vocabulary`>/examples/prisma-8-demo/migrations/app/20260422T0742_migration"
```
PN-005 `where`:
```
"where": "20260422T0742_migration"
```

**Notes:** PN-001 surfaces the full absolute path (via the MigrationToolsError's `details.dir`); PN-005's check sets `where: pkg.dirName` (the bare directory name). Inconsistent shapes for what's nominally the same locator. JSON consumers must handle both. The migration directory name (relative form) is the right level for user-facing output; the implementation should normalise PN-001 to match.

### F-9 — 📝 Follow-up — Pre-flight in script expects fully clean tree, but `M plan.md` + untracked workspace dir are intentional/expected

**Scenario:** Pre-flight
**Step:** 1 — `git status` clean check

**Observed:** Pre-flight says "git status must show a clean tree." Actual tree has `M projects/migration-domain-model/plan.md` (orchestrator amendment, called out as intentional in M7 R1 reviewer note) and `?? projects/agile-agent-orchestration/` (an unrelated worktree project).

**Notes:** Script-quality issue, not system. The pre-flight should either (a) call out the two expected uncommitted items by name, or (b) constrain the cleanliness check to a scope that excludes them. Minor — I proceeded under judgment.

## Per-scenario log

| # | Scenario | Result | Findings |
| - | -------- | ------ | -------- |
| 1 | Help enumerates the intended surface | ✅ pass-with-follow-ups | F-3, F-4 |
| 2 | Removed verbs redirect with a useful `fix:` line | ✅ pass | — |
| 3 | Wrong-grammar diagnostics point at the right verb | ❌ fail (workaround verified) | F-1 |
| 4 | `migration check` clean graph + planted corruption | ❌ fail (script + system both) | F-2, F-5 |
| 5 | `See also` sections cross-link the split verbs | ✅ pass-with-follow-ups | (minor: backticks not used for verb names; not filed) |
| 6 | Docs cross-links resolve and the vocabulary agrees | ✅ pass-with-follow-ups | F-6 |
| 7 | `docs/design/` reads as a natural permanent home | ✅ pass | — |
| 8 | Exploratory: probe the migration CLI surface | (notes; see below) | F-7, F-8 |

## Exploratory notes

Time-budgeted at ~15 minutes (less than the 30-minute charter). Used the budget on probes that complemented earlier findings rather than the full suggested-probes list. Probes attempted:

1. **`db sign` mutex** (positional + `--contract` together) — clean rejection: `Cannot specify both a positional contract argument and --contract flag.` exit 2. Note this is a plain stderr line, not a structured error envelope; if a tool/agent invokes `db sign` with `--json` and accidentally passes both, the consumer won't get a parseable error. Minor; not filed.

2. **Per-migration PN-001 detection** — works correctly (see F-2's investigation rationale). The asymmetry is specifically PN-005, not the per-migration branch generally.

3. **`migration graph --dot`** — F-7 surfaced. Auto-JSON shadows `--dot`.

4. **`migration status --to A --from B`** — both flags accepted, exits 0, mode is "offline" (because `--from` forces offline per M4 R2's wiring). The output's `markerHash` field is set to the `--from` value, which is correct per the implementation but may surprise a `--json` consumer expecting `markerHash` to mean "live DB marker." Could be a 📝 Follow-up but I judged it within the documented semantic of `--from` overriding the marker for offline path computation.

5. **`migrate` no-arg** — clean `PN-CLI-4005 Database connection is required` envelope. Good.

6. **`migration show` with valid migration dir** — same `PN-MIG-5001` failure as F-1's wrong-grammar probes, confirming the aggregate-loader gates ALL `migration show` invocations in the canonical demo state. This is what elevated F-1 from "wrong-grammar diagnostic unreachable" (a narrower problem) to "the entire show verb is unreachable" (broader).

7. **JSON envelope shape consistency** (informal observation; not a finding because the Style Guide doesn't require cross-command error-shape uniformity): `migration check`'s error shape is `{ok, failures: [{pnCode, where, why, fix}], summary}` (custom result shape); most other commands use the CliStructuredError shape `{ok, code, domain, severity, summary, why, fix, meta}`. A `--json` consumer cannot assume `failures[]` is present or that `code` is at the top level. Both shapes carry `ok: boolean` as discriminator, which is the Style Guide's only requirement, so this is consistent with policy but worth noting for tool authors.

Probes I did NOT get to:
- Full-grammar matrix on `migrate --to` / `db update --to` / `db sign --contract` / `ref set` (mostly redundant with M1's unit tests for the resolver).
- `migration check` adversarial PN-002 (deleted manifest) — likely works per the unit test I read; not exercised live.
- `migration check` against `migration plan` output (PN-004 / dangling ref) — likely works; not exercised live.
- Help-text legibility on `db schema` and the less-touched verbs.
- Cross-namespace confusion check (does `prisma-next ref --help` confuse a `git ref`-trained reader?).

These are candidate scenarios for a future QA round if time permits.

## Coverage outcome

| AC ID | Scenario(s) | Result | Notes |
| ----- | ----------- | ------ | ----- |
| AC1 | 1, 2 | ✅ pass-with-follow-ups | All redirects fire; help text legibility nits (F-3 verb ordering, F-4 missing `--to` grammar forms). The user-facing surface IS the intended surface. |
| AC2 | (CI; not manual-QA scope) | N/A | — |
| AC3 | (CI / static reading; not manual-QA scope) | N/A | — |
| AC4 | (CI; not manual-QA scope) | N/A | — |
| AC5 | 4 | ⚠️ partial fail (F-2) | Graph-wide `migration check` catches PN-005 correctly. Per-migration `migration check <m>` does NOT. AC5 strictly named graph-wide so the AC's letter holds; but the per-migration false-negative is a real user-impact bug worth filing. |
| AC6 | 3 | ❌ fail (F-1) | Wrong-grammar diagnostics work as designed under the resolver, but the aggregate-loader gates `migration show` in canonical demo state so a real user never reaches them. AC6 cannot be considered satisfied for the demo's shipped state. |
| AC7 | 2, 5 | ✅ pass-with-follow-ups | Redirects + See-also cross-references both work. Minor: verb names in See-also not in backticks (not filed as separate finding). |
| AC8 | (CI; not manual-QA scope) | N/A | — |
| AC9 | 6, 7 | ✅ pass-with-follow-ups | All cross-links resolve. Vocabulary agrees on PN codes, on `db verify` / `migration check` definitions, on noun/verb split. F-6 is a minor drift on hash-prefix minimum length (6 vs 8 chars). The `docs/design/` ports read as natural permanent homes; no working-draft framing leaked through. |

## Suggested follow-ups

### File these findings as tickets

- **F-1 (⚠️ High) — `migration show` aggregate-loader gating in canonical demo state.** Two possible fixes: (a) defer the layout check until after `parseMigrationRef` succeeds, so wrong-grammar diagnostics fire first; (b) downgrade the layout check to warn for read-only verbs (`migration show`, `migration list`, `migration graph`). Recommend (a) — it keeps the strict layout check for verbs that need it (`plan`, `init`, `update`, `migrate`) and unblocks read-only inspection.
- **F-2 (⚠️ High) — Per-migration `migration check <m>` missing PN-005 detection.** Lift the PN-005 snapshot-consistency check block out of the graph-wide `else` branch into a shared helper and call it from both branches (scoped to the matched package in per-migration mode). Small change; covered by re-running the existing PN-005 unit test with the per-migration code path.

### Script improvements (route to `drive-qa-plan`)

- **F-5 — Scenario 4 plant-the-corruption recipe.** Replace "edit `migration.json`'s `to` field" with "edit `end-contract.json`'s `storage.storageHash` field". The current recipe triggers PN-001 because the hash recomputation gates the snapshot check. The new recipe triggers PN-005 cleanly.
- **F-9 — Pre-flight clean-tree expectation.** Either enumerate the two known-uncommitted items (orchestrator's `plan.md` amendment, the `agile-agent-orchestration/` workspace dir) or constrain the cleanliness check to a scope that excludes them.
- **Scenario 1's intended-surface ordering wording.** If the implementer chose the current `contract, db, migration, migrate, ref, init` order on purpose (subject-cluster then verb-cluster), the spec's intended-surface diagram order may be the actual stale source. Worth a clarification in the spec — F-3 may resolve as "spec is correct, impl needs to match" OR "spec is descriptive, impl chose differently and that's fine."

### Test additions that would close gaps the QA round surfaced

- **F-2 → unit test.** Extend `migration-check.e2e.test.ts` with a per-migration variant of the PN-005 adversarial fixture: same `end-contract.json` corruption, but check via `prisma-next migration check <dir>` instead of `prisma-next migration check`. Should also exit 4 with PN-005. Currently only the graph-wide form has a test, which is why this asymmetry shipped.
- **F-7 → unit test.** Add a journey test for `migration graph --dot` that pipes the output through a DOT validator (or just asserts the output starts with `digraph migrations {`). Currently no test exercises `--dot`, which is why the auto-JSON shadow shipped.
- **F-1 → journey test.** A journey that runs `migration show` (and `migration list`, `migration graph`) against the canonical demo and asserts they succeed in the demo's shipped state. The current journey tests presumably exercise these verbs against fixtures that don't have unmigrated extensions; the demo state is a real-user condition that isn't covered.

### `drive/qa/README.md` candidates (surface to orchestrator; do not edit here)

- **Demo state gotcha**: the `examples/prisma-8-demo` ships with `extensions: [pgvector]` but no `migrations/pgvector/` directory. Several offline read-only commands (`migration show`, anything else that goes through `buildContractSpaceAggregate`) fail with `PN-MIG-5001` until the user runs `migrate` to materialise the extension space. QA scenarios that target those commands should either run `migrate` first OR temporarily strip the extension. Worth a substrate note in `drive/qa/README.md § Substrate locations` and possibly a "Demo state gotcha" subsection under § Known coverage-gate gaps.
- **Non-TTY auto-JSON**: every command run via `pnpm exec` from a non-TTY shell (which includes CI, Cursor agent shell, etc.) auto-enables `--json`. QA scenarios that expect to see human-readable output need either an explicit `--no-json` (if it exists) or a script-and-environment that detect the auto-JSON behavior. Worth a note under § Substrate locations or a new § Output-mode considerations.
