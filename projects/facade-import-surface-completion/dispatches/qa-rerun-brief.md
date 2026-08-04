# QA re-run brief — scenarios 1, 2, 4 post-rebase

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Target HEAD:** the post-rebase-cleanup push (the rebase-cleanup dispatch resolved two reds the orchestrator initially classified as pre-existing — they were actually our own rebase-resolution misses; pre-flight is now fully green).

**Target HEAD sha:** `c5cdb597e`

## Why this re-run exists

The first QA run (`manual-qa-reports/2026-05-21-claude-opus-runner-1.md`) returned `❌ Fail` because of two PR-introduced regressions (F-1 e2e-tests missing `@internal/sqlite` dep; F-2 sql-orm-client emit script wrong `cd` depth). Those were fixed in the tiny-fixes dispatch, and the branch has since been rebased onto `origin/main`, which pulled in TML-2614 (`db.close()` / `[Symbol.asyncDispose]`) — meaning script-scaffolding scenarios can now teardown cleanly with `await using db = ...` instead of hanging. The rebase-cleanup dispatch then resolved two more reds (TML-2520 IR shape in `helpers.ts` + missing `unbound-tables.ts` at integration) that had blocked typecheck.

This re-run validates:

1. **Pre-flight gate is green now** (confirms F-1 and F-2 fixes are real, plus the rebase-cleanup landed without regressions).
2. **Scenarios 1, 2, 4 still pass against the post-rebase tree** (the rebase swept across `package.json`, lockfile, and infrastructure code — re-validate that the slice's user-visible behaviour survived).
3. **Scenarios 1 and 2 (script-scaffolding) exercise `db.close()` / `await using` where applicable** — produce evidence the scripts terminate cleanly (no `<5s wait then SIGINT>` workaround needed for the demo-config db handles).

## Use the existing script

The script lives at `projects/facade-import-surface-completion/manual-qa.md`. Run scenarios **1, 2, and 4** end-to-end as written. **Do not** re-author or restructure — if the script's wayfinding is wrong (e.g. F-4 in the prior report flagged `migrations/<timestamp>_qa-initial/` vs the actual `migrations/app/<timestamp>_qa_initial/`), follow the actual rendered output and file a finding; do not edit the script.

## Pre-flight (mandatory)

Before any scenario:

1. `git rev-parse HEAD` → record sha; must match the `<HEAD-SHA>` value at the top of this brief (else abort).
2. `git status --porcelain` → must be empty (no leftover artefacts from prior runs).
3. `pnpm install --frozen-lockfile` → exits 0.
4. `pnpm typecheck` → **must exit 0** (F-1 oracle).
5. `pnpm test:packages` → exits 0 (or note unrelated flakes).
6. `pnpm fixtures:check` → **must exit 0** (F-2 oracle).
7. `pnpm lint:deps` → exits 0.

If any of (1)–(2) or (4)+(6) are red, **halt and report** — the merge-blocking fixes haven't landed and re-running scenarios is wasted effort. Adapter-postgres / PGlite connection flakes in `test:packages` are a known environmental issue — record but don't block.

## TML-2614 cleanup pattern

For scenarios 1 and 2 (where you scaffold a `prisma-next.config.ts` + author code that opens a db handle), prefer the `await using` form newly available on `main`:

```ts
import { createDb } from '@internal/postgres';  // or /sqlite, /mongo
import config from './prisma-next.config';

await using db = createDb(config);
// ... work with db ...
// db.close() / [Symbol.asyncDispose] fires automatically at end of block
```

In the QA report's run notes for S1 and S2, capture observably:

- Whether your scaffolded scripts terminated cleanly (exit code 0, no hung process) without manual `SIGINT`.
- Whether the `await using` form compiled and ran without complaint against the post-rebase tree.

If the migration-plan CLI invocations don't open db handles (they may not — they could be pure-IR planning), note that S1 and S2 didn't materially exercise `db.close()` and the validation degrades to "script ran clean and renderer output unchanged".

## Scope discipline

- Do not run scenarios 3, 5, 6, 7, or 8. They passed in the prior report and are out of scope for this re-run.
- Do not re-validate the TML-2633 carve-out documentation prose (S4 will exercise the type-inference re-enactment; that's sufficient).
- Do not deviate from the script's "Be the user" framing — the runner is exercising the user-facing surface, not the test harness.

## Out-of-script side checks (cheap; do in passing)

While running, observe and report:

- **(side-S1)** Does the rendered SQLite `migration.ts` from S1 still import only `@internal/sqlite/migration` (no `@internal/target-sqlite/migration`)? AC-2 oracle.
- **(side-S2)** Same for Postgres / AC-1.
- **(side-S4)** Does the in-tree workaround comment text in `test/integration/test/mongo-runtime/query-builder.test.ts` and `test/integration/test/mongo/fixtures/contract.ts` still match the symptom you reproduce? (Per the original S4 oracle.)

## Output

Write the report at:

`projects/facade-import-surface-completion/manual-qa-reports/2026-05-22-post-rebase.md`

Use the same shape as the prior report (`2026-05-21-claude-opus-runner-1.md`). At minimum:

- **Header:** script commit, runner identity, environment (OS, Node version, pnpm version, branch + HEAD sha), start/finish timestamps, verdict (`✅ Pass` / `❌ Fail` / `⚠️ Pass with concerns`).
- **Summary:** one-paragraph verdict-and-why; explicitly state whether F-1 and F-2 are now green; explicitly state whether `db.close()` / `await using` was meaningfully exercised in S1/S2.
- **Pre-flight gate results:** per-step pass/fail.
- **Per-scenario results:** S1, S2, S4 — what you did, what you observed, what the oracle predicted, pass/fail, any findings.
- **Findings:** structured per the prior report's format (`F-N — <severity> — <one-line>` with Scenario, Step, Oracle, Observed, Expected, Reproduction, Notes). Severity classes: `⚠️ High` (merge-blocker), `📝 Follow-up` (ticket-worthy), `ℹ️ Note` (FYI).
- **Disposition recommendation:** one of `🔧 fix-in-PR`, `🎫 ticket`, `❌ accepted-as-is`. The orchestrator confirms the disposition; you propose it.

If S4 reproduces TML-2633 cleanly (verbose form has inference, façade wrap collapses), record that as expected behaviour — TML-2633 deferral is sanctioned scope.

## Artefacts

Save any relevant logs (typecheck output, scenario commands and outputs) under:

`projects/facade-import-surface-completion/manual-qa-reports/artefacts/<finding-id>/`

Follow the prior report's pattern.

## Hard rules

- Read-write outside `projects/` is fine for scenario execution (the script tells you to scaffold worktrees / tmpdirs); leave the repo working tree clean at the end (`git status --porcelain` empty for all in-repo paths outside `projects/facade-import-surface-completion/manual-qa-reports/`).
- No commits. Orchestrator commits the report after review.
- Heartbeat to `wip/heartbeats/qa-rerun.txt` at start, each scenario boundary, and end (5 heartbeats minimum). Format: `<ISO timestamp> | <current scenario or step> | <last result>`.

## Structured report (return at end of dispatch)

```
## Status
COMPLETE

## Verdict
✅ Pass / ⚠️ Pass with concerns / ❌ Fail

## Pre-flight gate
- typecheck: green / red (with one-line summary)
- test:packages: green / unrelated flakes / red
- fixtures:check: green / red
- lint:deps: green / red

## F-1 / F-2 validation
- F-1 (e2e-tests sqlite dep): RESOLVED / STILL RED
- F-2 (sql-orm-client emit cd depth): RESOLVED / STILL RED

## Scenarios run
- S1: <pass/fail> — <one-line note, including db.close()/await using observation>
- S2: <pass/fail> — <one-line note, including db.close()/await using observation>
- S4: <pass/fail> — <one-line note, especially whether the TML-2633 carve-out is still accurate>

## New findings (if any)
- <list with severity>

## Report path
projects/facade-import-surface-completion/manual-qa-reports/2026-05-22-post-rebase.md

## Surfaced for orchestrator attention
- <anything>
```
