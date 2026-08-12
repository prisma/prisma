# Reviewer resume — D5b R1

## Resume — `facade-import-surface-completion`, D5b R1

> You retain your prior transcript through D5a R1. Two new orchestrator-context items this round: (a) the implementer surfaced TWO new architectural cycles analogous to the pgvector one (mongo-runtime and a related mongo discriminated-union type regression); the orchestrator has confirmed-with-user that the architectural fix is the correct path forward and will be dispatched as D5c immediately after your verdict. (b) The D5a A7 extension I asked you to bless is being **reverted** because we're fixing the cycle properly rather than working around it.

## What changed since the last review

**New commits this round (2 commits):**

- `a602bcc57` — `fix(@internal/postgres): accept PostgresEnumStorageEntry in defineContract TypesConstraint` — surfaced during D5b's pattern-verify phase. The wrapped `defineContract`'s `TypesConstraint` was narrower than the base — rejected `PostgresEnumStorageEntry` that the base accepts. Implementer widened it to `Record<string, StorageTypeInstance | PostgresEnumStorageEntry>`. Technically a facade source change in a test-fixture dispatch; orchestrator accepted in-flight because it was blocking otherwise-valid migrations and the alternative was halting D5b for a one-line fix.
- `c09030abf` — `feat(test-fixtures): migrate verbose defineContract form to facade contract-builders` — 97-file mechanical migration. Per implementer's structured return: ~38 CLI-journey + ~15 parity + ~7 top-level + 3 e2e framework + 2 CLI recordings + 1 sql-orm-client + Tier 2 judgments (~31 inline-construct test files migrated where intent allowed; ~6 left verbose-with-comment).

**Pull diff:** `git diff 243e297d8..c09030abf` is the substantive D5b code change (the brief commit + the lockfile realignment are orchestrator-side).

## Items to triage

- **97 files vs ~60 brief estimate.** Implementer didn't trigger `scope-escalation` — they judged 97 was within range (Tier 1 turned out larger than orchestrator's grep estimated, plus many Tier 2 inline-construct test files were straightforward to migrate). Spot-check the Tier 2 judgments listed in the implementer's structured return (5+ files marked LEFT-VERBOSE-WITH-COMMENT) — verify each has a one-line comment explaining the reason.

- **Pattern consistency.** Sample 5-10 files across categories (CLI-journey, parity, top-level integration fixture, mongo fixture). Pattern should be: drop `import sqlFamily from '@internal/family-sql/pack'` + `import postgresPack from '@internal/target-postgres/pack'`, change `import { defineContract } from '@internal/sql-contract-ts/contract-builder'` to `from '@internal/{postgres,sqlite,mongo}/contract-builder'`, drop `family:` + `target:` from the `defineContract` call. If you spot drift between SQL and Mongo variants, file it.

- **The `TypesConstraint` widening fix (`a602bcc57`).** Verify the widened type is `Record<string, StorageTypeInstance | PostgresEnumStorageEntry>` (or whatever the implementer landed). Check that the corresponding Sqlite/Mongo facade types don't have the same gap (if they do, file as a follow-up — D5b doesn't need to fix them but reviewer should flag).

- **Integration test failure analysis.** Implementer reports 33 files fail in full-suite, **all 33 verified as environmental flakes** (PGlite ECONNRESET under parallelism). Their evidence: ran 5 representative files in isolation, all pass. Cross-check by running one yourself (`pnpm test:integration test/integration/test/family/schema-verify.basic.test.ts` or similar) — if it passes in isolation, accept the implementer's analysis. If it fails in isolation, the failure is real and orchestrator needs to know.

- **Tier 2 "leave-verbose-with-comment" file list.** Implementer's structured return enumerates them with rationale. Spot-check 2-3: are the comments present and meaningful?

- **`packages/2-mongo-family/7-runtime/test/query-builder.test.ts` left verbose due to cycle.** The implementer found this is the same kind of architectural cycle as the pgvector one (adding `@internal/mongo` as a devDep would cycle). Accept the verbose-with-comment decision for this dispatch — D5c will fix the underlying layering, after which the file should migrate. Verify the comment in the file points at D5c / the layering fix.

- **`test/integration/test/mongo/fixtures/contract.ts` left verbose due to Mongo facade type regression.** Implementer reports the Mongo facade's `defineContract` wrap loses type precision for discriminated unions with embedded relations (`tasks[0].comments[0].createdAt` infers as `never`). Verify the comment in the file documents this. **File this as a follow-up finding (not a must-fix for D5b):** the Mongo facade type regression is a real bug that needs its own dispatch; D5b's verbose-with-comment is the right interim move.

- **Stale `.tmp` directory cleanup.** Implementer reports removing `test/integration/.tmp/skills-clone-*` from a prior CLI init run. Verify it's actually gone (not just `git status` clean, but the directory itself).

## Acceptance bar for SATISFIED (D5b)

- **FR9 PASS (fully):** Combined with D5a's example sweep, FR9 is now fully satisfied. Mark FR9 PASS on the scoreboard.
- "Done when" checklist per plan § D5b, with these adjusted expectations:
  - Grep gate clean — except for the documented exemptions (A7 pgvector/postgis contracts AND the 6-ish Tier 2 verbose-with-comment files including mongo-runtime test + mongo fixture + interpretPslDocument callers).
  - `pnpm test:integration` failures verified environmental (your independent isolation-test check).
  - `pnpm lint:deps` clean.
  - Intent-validation: diff covers test-fixture migration + the `TypesConstraint` fix; no other source change.

## New findings to file (orchestrator pre-flagged)

- **Mongo facade type regression for discriminated unions with embedded relations.** Severity: should-fix (not must-fix for D5b). Affects `test/integration/test/mongo/fixtures/contract.ts`. Implementer documented in structured return. File as a finding for follow-up (potentially a new dispatch or new project).
- **Sqlite + Mongo `TypesConstraint` parity check.** If Sqlite + Mongo facades have analogous TypesConstraint narrowness gaps that the Postgres fix (`a602bcc57`) revealed, file as a follow-up finding. Orchestrator suspects they might — same wrap pattern.

## Anything that has changed in your operating context

- **A7 extension for extension-pack contracts is being REVERTED.** Orchestrator informed user about the cycle workaround; user pushed back on the architectural anti-pattern (extension packs being pulled into sql-builder via test fixtures), said "delete the dependencies that violate the architectural layering". D5c will dispatch immediately after your D5b verdict to remove `sql-builder` + `sql-orm-client` devDeps on `@internal/extension-pgvector`, move the test fixtures that use pgvector to `test/integration/`, then in a follow-up dispatch migrate pgvector + postgis (and possibly mongo-runtime test) contracts to the facade form per the original D5 intent.
- **The mongo-runtime cycle the implementer just surfaced is the SAME pattern.** D5c's scope will include it.

## Reminders (terse)

- Findings must be addressable in this PR (the Mongo type regression isn't; file as follow-up, not must-fix).
- F-numbers durable.
- Three-line-plus-heading round entry.

Begin.
