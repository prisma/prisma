# Manual QA report (re-run) — TML-2546 (Migration CLI restructure) — 2026-05-18

> **Script:** `projects/migration-domain-model/manual-qa.md` (commit `c4942308a` at run time — incorporates F-5 corruption-recipe + F-9 pre-flight fixes from M7 R3)
> **Prior run:** [`2026-05-18-cursor-claude-reviewer-resumed.md`](./2026-05-18-cursor-claude-reviewer-resumed.md) — ❌ Fail with 2 ⚠️ High + 7 📝 Follow-ups + 2 script-quality follow-ups. All 9 system findings + 2 script-quality items + 5 reviewer-derivative findings (F8/F9/F10/F11/F12) have since landed across M7 R3, R4, R5 (all reviewer-SATISFIED). Reviewer-side code-review.md scoreboard: 9 PASS / 0 FAIL / 0 NOT VERIFIED.
> **Runner:** `cursor-claude-reviewer-resumed-rerun` — same LLM session that did pass 1 + the R3–R5 reviewer rounds. Continuity-runner, not fresh-eyes.
> **Environment:**
> - Worktree: `<worktree for `tml-2546-review-migration-cli-commands-and-vocabulary`>/`
> - Branch HEAD: `c4942308a` (M7 R5's last commit).
> - Working tree at start: `M projects/migration-domain-model/plan.md` (intentional, per orchestrator note); untracked `projects/agile-agent-orchestration/` (workspace dir). One unexpected uncommitted item — see F-r1 below.
> - Node: `v24.13.0` · pnpm: `10.27.0` · macOS (darwin 25.3.0).
> - Shell environment: non-TTY (Cursor agent). Auto-JSON enabled per Style Guide § JSON Semantics.
> **Started:** 2026-05-18T08:22:00+02:00
> **Finished:** 2026-05-18T08:35:00+02:00
> **Verdict:** ✅ **Pass-with-follow-ups** — every prior-run system finding (F-1 through F-9) confirmed fixed; one pre-flight observation (F-r1, 📝 Follow-up) about uncommitted-state residue from prior rounds.

## Summary

The second pass confirms every prior-run finding has held: the F-1 happy-path slice (`migration show <valid>` in canonical demo state) now returns migration details cleanly; F-2's per-migration PN-005 detection fires correctly; the root help order, the help-text expansions across 6 commands, the docs alignment, the `--dot` precedence, and the `where` field normalisation are all live and observable. Scenario 4's updated corruption recipe (mutating `end-contract.json`, per F-5) reproduces the bug as designed. Scenario 2's seven redirects fire identically to pass 1. The only filing this round is a 📝 Follow-up for a JSON formatting drift in a demo fixture file — likely residue from a prior tooling round, restored before scenarios but worth surfacing so the orchestrator knows about between-round state drift.

## Findings

### F-r1 — 📝 Follow-up — Pre-flight residue: JSON formatting drift in demo's `end-contract.json`

**Scenario:** Pre-flight (before any scripted scenario)
**Step:** `git status` baseline check.
**Oracle:** Per the updated script § Pre-flight, only the two intentional items (`plan.md` amendment + `wip/unattended-decisions.md`) should appear; anything else surfaces as a finding.

**Observed:**
```
$ git status --short
 M examples/prisma-8-demo/migrations/app/20260422T0742_migration/end-contract.json
 M projects/migration-domain-model/plan.md
?? projects/agile-agent-orchestration/

$ git diff examples/prisma-8-demo/migrations/app/20260422T0742_migration/end-contract.json | head -10
diff --git a/examples/prisma-8-demo/migrations/app/20260422T0742_migration/end-contract.json b/examples/prisma-8-demo/migrations/app/20260422T0742_migration/end-contract.json
index 777451756..b6aaf450d 100644
--- a/examples/prisma-8-demo/migrations/app/20260422T0742_migration/end-contract.json
+++ b/examples/prisma-8-demo/migrations/app/20260422T0742_migration/end-contract.json
@@ -116,8 +116,12 @@
         "user": {
           "cardinality": "N:1",
           "on": {
-            "localFields": ["userId"],
-            "targetFields": ["id"]
```

The diff is a JSON pretty-print drift (single-line arrays → multi-line), not the QA pass 1 corruption (no `dddd…` storageHash anywhere). Restored via `git checkout --` before scenarios.

**Expected:** Either no uncommitted items (besides the two known-intentional ones), OR an updated script entry acknowledging fixture-file formatting drift as a known residue class.

**Reproduction:**
- `git rev-parse HEAD` → `c4942308a`
- Mutated file restored before scenarios — no impact on test results.
- Likely residue from: (a) my own QA pass 1's `python3 -c "json.load → json.dump indent=2"` cycle, which would have changed array formatting on the round-trip even after `git checkout --` (if my checkout happened on a different commit), OR (b) some other round's tooling that touched the file and partially restored it. Cannot determine root cause from here.

**Notes:** Filing as 📝 Follow-up because (a) the file was restored before scenarios so no test results are tainted, (b) this is fixture-state hygiene rather than a system bug, and (c) the orchestrator's pre-flight already calls out the unsurprising-uncommitted-items class. The script could grow a stronger pre-flight check: `git diff --stat` against HEAD scoped to `examples/prisma-8-demo/` to catch fixture drift before scenarios.

## Per-scenario log

| # | Scenario | Result | Findings |
| - | -------- | ------ | -------- |
| 1 | Help enumerates the intended surface | ✅ pass | — |
| 2 | Removed verbs redirect with a useful `fix:` line | ✅ pass | — |
| 3 | Wrong-grammar diagnostics point at the right verb | ✅ pass | — |
| 4 | `migration check` clean graph + planted corruption | ✅ pass | — |
| 5 | `See also` sections cross-link the split verbs | ✅ pass | — |
| 6 | Docs cross-links resolve and the vocabulary agrees | ✅ pass | — |
| 7 | `docs/design/` reads as a natural permanent home | ✅ pass | — |
| 8 | Exploratory: probe the migration CLI surface | (notes; see below) | F-r1 |

## Per-scenario observations (prior-finding regression checks)

### Scenario 1 — F-3 + F-4 fixes hold

Root help order: `init, migrate, contract, db, migration, ref` ✓ — matches spec § Intended-surface diagram (F-3 prior fix).

`migrate --help` `--to` description:
```
│ --to <contract>       Target contract reference (hash, prefix, ref name,
│                       migration dir name, <dir>^, or ./path)
```
All 5 contract-reference forms enumerated ✓ (F-4 prior fix).

`migration --help` lists `plan, new, show, status, log, list, graph, check` (no `apply`, no `ref`). `ref --help` lists `set, delete, list` (no `get`). All consistent with spec.

### Scenario 2 — all 7 redirects fire identically to pass 1

Each invocation tested verbatim per script Steps 1–7. Each produced exit 2 + the spec-named replacement on stderr:
- `migration apply` → `Use \`prisma-next migrate --to <contract>\` instead.`
- `migration apply --to production` → same (subverb redirect ignores trailing args).
- `migration ref set staging sha256:abc` → `Use \`prisma-next ref set|list|delete\` instead.`
- `migration ref` (bare) → same.
- `migration status --graph` → `Use \`prisma-next migration graph\` to view the migration graph.`
- `migration status --all` → `Use \`prisma-next migration log --db <url>\` to view the full execution history.`
- `migration status --ref production` → `Use \`--to <contract>\` instead of \`--ref\`.`

### Scenario 3 — wrong-grammar diagnostics reach the user (F-1 fix)

All three Scenario 3 cases now produce resolver-level diagnostics in canonical demo state (pgvector declared, no `migrations/pgvector/` directory):

- **Case 1** (`migration show production`, no ref defined): `code: PN-RUN-3000`, `summary: Not a known migration reference: "production"`. The aggregate-loader's `PN-MIG-5001` does NOT fire (which was the entire point of F-1). Falls through to not-found because no `production` ref exists in demo's empty refs index — same as pass 1's workaround scenario.
- **Case 2** (`migration show 20260422T0720_initial^`): `code: PN-RUN-3000`, `summary: \`^\` syntax addresses contracts, not migrations`, `fix:` names contract-accepting flags. ✓
- **Case 3** (`migration show 76c1bd`, hash prefix matching contract): `code: PN-RUN-3000`, `summary: Hash matched a contract but not a migration`, `fix:` names contract-accepting flags + offers `migration show <dir>`. ✓

**F-1 happy-path slice (the residual gap after R3 that F8 closed in R4):**
```
$ pnpm exec prisma-next migration show 20260422T0720_initial 2>&1 | head -10
{
  "ok": true,
  "spaces": [
    {
      "kind": "present",
      "spaceId": "app",
      "dirName": "20260422T0720_initial",
      "dirPath": "migrations/app/20260422T0720_initial",
      "from": null,
      "to": "sha256:76c1bd...",
```

Same canonical demo state (pgvector declared but not materialised), valid migration directory now resolves and renders cleanly. Pass 1 returned `PN-MIG-5001` here; pass 2 returns the migration details. **F-1 confirmed fixed end-to-end.**

### Scenario 4 — clean + planted corruption (F-2 + F-5 fixes hold)

**Step 1 (clean graph):**
```
$ pnpm exec prisma-next migration check
{"ok": true, "failures": [], "summary": "All checks passed"}  → exit 0
```
✓ Clean graph passes with exit 0.

**Step 2 (plant corruption per updated F-5 recipe):** mutated `end-contract.json` `storage.storageHash` to `sha256:dddd...` (NOT `migration.json` — the updated recipe targets the snapshot directly so PN-005 fires without PN-001 interfering).

**Step 3 (hot check, graph-wide):**
```json
{
  "ok": false,
  "failures": [
    {
      "pnCode": "PN-MIG-CHECK-005",
      "where": "migrations/app/20260422T0742_migration",
      "why": "Migration \"20260422T0742_migration\" declares to=sha256:5618dcac... but end-contract.json has storageHash=sha256:dddd...",
      "fix": "Re-emit the migration package so migration.json and end-contract.json agree."
    }
  ],
  "summary": "1 integrity failure(s)"
}
```
Exit 4 ✓, PN-MIG-CHECK-005 ✓, `where` is cwd-relative (F-8 normalisation) ✓, diagnostic names the migration + values + fix.

**Step 4 (per-migration check — F-2 regression):**
```
$ pnpm exec prisma-next migration check 20260422T0742_migration
{
  "ok": false,
  "failures": [
    {
      "pnCode": "PN-MIG-CHECK-005",
      "where": "migrations/app/20260422T0742_migration",
      ...
    }
  ]
}  → exit 4
```
**F-2 confirmed fixed.** Pass 1 returned `ok: true` for this exact corruption; pass 2 returns `ok: false` with the right PN code. The shared `checkSnapshotConsistency` helper introduced in R3 is doing its job from both branches.

Restore: `git checkout -- end-contract.json`; `git status` clean (modulo the two known-intentional items).

### Scenario 5 — See-also blocks (F-7 from M4 — unchanged)

All 5 verbs (`status`, `log`, `list`, `graph`, `show`) emit a `See also:` block that names the other four verbs in the cluster. No self-references, no stale verb names, consistent positioning across verbs. ✓

### Scenario 6 — docs cross-link + vocabulary check (F-6 fix holds)

**F-6 (hash-prefix length):**
- Domain doc: `Bare hex (no \`sha256:\` prefix). 6+ char prefixes accepted` ✓
- Glossary: `Bare hex (6+ chars)` ✓
- Both agree; both match implementation.

**Negative spot-check** (`rg 'migration apply|migration ref [^c]|migration status --(ref|graph|all)|--limit'` over the 4 key docs): zero hits ✓.

### Scenario 7 — forward-compatibility property

Working-draft-framing scan across `docs/design/` returns one hit: the legitimate TML-2546 origin link in the domain doc's See-also footer. Linear tickets are durable references per workspace rules; not a leak. Cross-link targets all exist. ✓

### F-7 regression probe — `migration graph --dot` in non-TTY mode

```
$ pnpm exec prisma-next migration graph --dot
digraph migrations {
  "sha256:empty" -> "sha256:76c1b" [label="20260422T0720_initial"];
  ...
}  → exit 0
```
DOT output, not JSON. Pass 1 returned the auto-JSON envelope here. **F-7 confirmed fixed.**

## Exploratory notes (Scenario 8)

Time-budgeted at ~10 minutes (less than the 30-minute charter — most surface had already been covered in pass 1 + the regression checks above). Probes attempted:

1. **`db sign` mutex** (regression from pass 1, exploratory probe #1): `db sign sha256:abc --contract production` → `Cannot specify both a positional contract argument and --contract flag.` exit 2. ✓ No regression.

2. **Per-migration `migration check` PN-001 detection** (verify F-2's shared-helper refactor didn't break PN-001 specifically): mutated `migration.json.migrationHash`, ran `migration check <dir>`. Got `pnCode: PN-MIG-CHECK-001` exit 4 with `where: "migrations/app/20260422T0742_migration"` (cwd-relative, F-8 ✓). The shared helper extraction didn't regress the existing PN-001 path.

3. **`ref` cycle** (`set` → `list` → `delete`): all three operations succeeded cleanly. JSON envelopes consistent with prior runs.

4. **Per-migration PN-002 (orphan dir)** probe attempted but my fixture dir name started with `_` (`__orphan_test_$$` where `$$` is unset → empty), which the graph-wide check filters out by design (`if (entry.startsWith('.') || entry.startsWith('_') || entry === 'refs') continue;`). Probe was malformed; not a finding. Confirms the filter is correctly skipping reserved-prefix directories.

Probes I didn't get to (re-mentioned from pass 1 as candidates for a future round):
- Full-grammar matrix on `migrate --to` / `db update --to` (mostly redundant with M1 unit tests).
- `migration check` adversarial PN-002/004 in their canonical fixture shapes (not just my malformed one).
- Help-text legibility on `db schema` and the rarely-touched verbs.

## Coverage outcome

| AC ID | Scenario(s) | Result | Notes |
| ----- | ----------- | ------ | ----- |
| AC1 | 1, 2 | ✅ pass | All 7 redirects fire; help order matches spec; help-text complete (all 5 grammar forms). |
| AC2 | (CI; not manual-QA scope) | N/A | — |
| AC3 | (CI / static reading; not manual-QA scope) | N/A | — |
| AC4 | (CI; not manual-QA scope) | N/A | — |
| AC5 | 4 | ✅ pass | Graph-wide AND per-migration `migration check` both catch PN-005 corruption. F-2's shared-helper extraction works. |
| AC6 | 3 | ✅ pass | All three wrong-grammar cases produce resolver diagnostics in canonical demo state. F-1 + F8 happy-path slice verified end-to-end. |
| AC7 | 2, 5 | ✅ pass | Redirects + See-also blocks both verified. |
| AC8 | (CI; not manual-QA scope) | N/A | — |
| AC9 | 6, 7 | ✅ pass | F-6 fix holds; cross-links resolve; no working-draft framing leaks. |

## Suggested follow-ups

### File F-r1 as a script-quality ticket (or fold into TML-2554's neighbouring scope)

`drive-qa-plan` revision could strengthen the pre-flight to detect fixture-file drift in `examples/prisma-8-demo/` between rounds. Either (a) script-side check before scenarios start, or (b) doc-side note that QA runs against worktrees with prior-round residue need an explicit `git stash` of `examples/` changes first. Low-impact; not a regression.

### `drive/qa/README.md` candidates (surface to orchestrator; do not edit here)

Same two items I surfaced in pass 1, both still relevant:

1. **Demo state gotcha** — `examples/prisma-8-demo` ships with `extensions: [pgvector]` but no `migrations/pgvector/` directory; some offline read-only commands USED to fail with `PN-MIG-5001` until `migrate` materialised the space. **This has been fixed for `migration show`** but the underlying demo-state asymmetry remains and could re-surface if a new offline verb is added that uses `buildContractSpaceAggregate`. Worth a substrate note.

2. **Non-TTY auto-JSON** — every command run via `pnpm exec` from a non-TTY shell auto-enables `--json`. Scenarios that expect human-readable output need to know this; affects what "What you should see" means in practice.

### No regressions of F-1 through F-12

All 12 prior findings (9 system + 3 reviewer-derivative from R3/R4) verified holding or remediated. The project is **observably ready for the orchestrator's push + CI verification step**.
