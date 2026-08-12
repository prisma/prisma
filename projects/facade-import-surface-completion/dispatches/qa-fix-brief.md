# Brief: QA-fix dispatch (F-1 + F-2 from 2026-05-21 QA run)

**Dispatch type:** post-QA regression fix. Two single-file edits surfaced as 🔧 fix-in-PR findings by the QA runner. Both block merge of PR #557 until the pre-flight gate (`pnpm typecheck && pnpm test:packages && pnpm fixtures:check`) is green.

**Source:** [`projects/facade-import-surface-completion/manual-qa-reports/2026-05-21-claude-opus-runner-1.md`](../manual-qa-reports/2026-05-21-claude-opus-runner-1.md) findings F-1 + F-2.

---

## Fix 1 — F-1 — `test/e2e/framework/package.json` missing `@internal/sqlite`

**Symptom:** `pnpm typecheck` fails. `test/e2e/framework/test/sqlite/fixtures/contract.ts` and `test/e2e/framework/test/sqlite/migrations/harness.ts` import from `@internal/sqlite/contract-builder`, but `test/e2e/framework/package.json` does not list `@internal/sqlite` in `dependencies`.

**Exact edit:** add this line to `test/e2e/framework/package.json` `dependencies` (alphabetical position, between `@internal/sql-runtime` and `@internal/target-postgres`):

```json
    "@internal/sqlite": "workspace:0.9.0",
```

**Then run:** `pnpm install` (from repo root) to update `pnpm-lock.yaml`. Per the workspace's `no-direct-lockfile-edits` rule, do NOT edit the lockfile by hand.

**Do not:** touch `harness.ts` or any other file in `test/e2e/framework/`. The runner's "may surface secondary cleanups" suggestion was speculative; verify it with `pnpm typecheck` and only act if typecheck is still red after the dep addition.

## Fix 2 — F-2 — `packages/3-extensions/sql-orm-client/package.json` wrong `cd` depth in `emit` script

**Symptom:** `pnpm fixtures:check` fails. The `emit` script uses `cd ../../../../test/integration` (4 levels up), but `sql-orm-client` is at `packages/3-extensions/sql-orm-client/` (only 3 levels deep from repo root). The cd lands above the repo and the script fails.

**Exact edit:** in `packages/3-extensions/sql-orm-client/package.json` `scripts.emit`, change `cd ../../../../test/integration` to `cd ../../../test/integration` (drop one `../`).

The `cp` source and destination paths in the same script are CORRECT as-is (the runner suggested adjusting them too — that suggestion was over-cautious; the cwd after the fixed cd is `<repo>/test/integration/`, and the existing `test/sql-orm-client/fixtures/generated/contract.json` source + `../../packages/3-extensions/sql-orm-client/test/fixtures/generated/` destination both resolve correctly from there).

**Reference for sanity-check:** `packages/2-sql/4-lanes/sql-builder/package.json`'s `emit` script (which works) uses `cd ../../../../test/integration` because `sql-builder` is at `packages/2-sql/4-lanes/sql-builder/` — 4 levels deep — so 4-up is correct for it. The lesson: the cd depth must match the package's depth from repo root.

## Validation gates (the order matters)

After both edits land:

```bash
pnpm install                      # picks up F-1's new dep
pnpm typecheck                    # must be GREEN (was red on F-1)
pnpm fixtures:check               # must be GREEN (was red on F-2)
pnpm test:packages                # the third leg of the pre-QA gate per drive/qa/README.md
pnpm lint:deps                    # adding a workspace dep can shift architecture-layering signal
```

All five must pass. If `pnpm test:packages` was already passing before, it should stay green; flag any new red as a finding back to the orchestrator (do not "fix" it yourself).

## Commit shape (one commit per fix; concise messages)

```
fix(test/e2e/framework): add @internal/sqlite dep (post-D5a)

D5a (commit 308873659) migrated e2e SQLite fixtures to import from
@internal/sqlite/contract-builder but did not add the matching
workspace dep, breaking pnpm typecheck. Addresses F-1 from
projects/facade-import-surface-completion/manual-qa-reports/
2026-05-21-claude-opus-runner-1.md.

Signed-off-by: Will Madden <madden@prisma.io>
```

```
fix(@internal/sql-orm-client): correct emit script cd depth (post-D5c)

D5c (commit 7d9116a3b) wrote a 4-level cd in the relocated emit script,
but sql-orm-client sits 3 levels deep -- the cd landed above the repo
root and pnpm fixtures:check failed. Addresses F-2 from
projects/facade-import-surface-completion/manual-qa-reports/
2026-05-21-claude-opus-runner-1.md.

Signed-off-by: Will Madden <madden@prisma.io>
```

## Hard constraints

- Edit ONLY `test/e2e/framework/package.json` and `packages/3-extensions/sql-orm-client/package.json`.
- `pnpm-lock.yaml` updates via `pnpm install`, NEVER by hand-editing.
- Both commits carry `Signed-off-by:` trailers (the PR's DCO check enforces this).
- Do NOT touch anything else, even if you notice adjacent issues. File adjacent issues as a final-report bullet to the orchestrator; the orchestrator decides whether they enter scope.
- Do NOT run the full QA script — that's a separate dispatch (and only if the orchestrator decides to re-run).

## Heartbeats + final report

- Write a heartbeat to `wip/heartbeats/qa-fix.txt` every ~5 min. Format: `timestamp | current step | elapsed | blockers`.
- On completion, your final message to the orchestrator must include:
  - Both commit SHAs.
  - Output (exit code + last line of output) for each of the five validation gates.
  - Any adjacent issues noticed but not fixed (one-line each).

## Done-when gates

- [ ] Two commits landed, each addressing exactly one finding.
- [ ] `pnpm install` ran; lockfile updated; no hand-edits to `pnpm-lock.yaml`.
- [ ] All five validation gates pass.
- [ ] Both commits signed off.
- [ ] No files modified outside the two named package.json files (plus the lockfile via pnpm install).
