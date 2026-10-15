# Handover: setDefault and every postcheck that lets the runner skip unfinished work

From aphrodite-50, 2026-10-15. Previous owner before that: gulliver-86. Work follows the Drive process (`/drive-process`) as an orphan slice (no Linear project yet). Every implementer and reviewer subagent runs on Opus (`model: "opus"`).

You own the whole project, not just the next step. Read this file, then the original bug report next to it (`original-brief.md`), then skim the transcripts.

## Where everything is

- **Code branch:** `setdefault-no-postcheck` on the `bot` remote (`git@github-wmadden-electric:prisma/prisma.git`). Tip is `a101e1d586`, a merge of `origin/main` as of 2026-10-08. No pull request yet.
- **Handover branch:** `setdefault-no-postcheck-handover` on the `bot` remote. It holds this file, `original-brief.md` (the bug report that defines the project, with the reproduction script) and `prior-subagent-reports.md` (the first owner's reviewer and implementer reports), under `handover/setdefault-postcheck/`. Never merge this branch.
- **Transcripts:**
  - aphrodite-50 (this session): `/Users/wmadden/.claude/projects/-Users-wmadden-Projects-prisma-orm--claude-worktrees-setdefault-postcheck-skip-55f624/aa4d71b9-9410-4987-8f47-7e936e8cf659.jsonl`
  - gulliver-86 (first owner): `/Users/will/.claude/projects/-Users-will-Projects-prisma-orm--claude-worktrees-setdefault-operationclass-skip-cd188c/85d4ff52-5680-4f6d-af9a-40e6df6ced14.jsonl`
  - Will's own messages settle the design. Search for `"type":"user"` lines without `tool_result`.

## Start-up

1. Fresh worktree from `bot/setdefault-no-postcheck`.
2. Merge `origin/main` again. Main moves fast, and the last merge is a week old. Use new merge commits only; never rebase, amend or force-push.
3. `mise exec -- pnpm install`, then `mise exec -- pnpm build`. Run node, pnpm and commits through `mise exec --`.
4. Note: the merge commit `a101e1d586` was made with `--no-verify` and has never been built or typechecked. The commit before it, `4f8dadda4d`, is a WIP commit that fails typecheck (see "Revert" below).

## The bug

Postgres migration runner, `packages/3-targets/3-targets/postgres/src/core/migrations/runner.ts`. Before each operation it runs the operation's postchecks. If they all hold, it records a `postcheck_pre_satisfied` skip and does not run the operation. After the last operation it introspects the database and verifies it against the end contract (`runner.ts:135`, `MIGRATION.SCHEMA_VERIFY_FAILED`).

`setDefault` (in `operations/columns.ts`) carried the postcheck "the column has a default" when its operation class was `additive`. A column that already has a different default, such as `'open'`, satisfies that. So a hand-written `this.setDefault(...)` that changes `'open'` to `'closed'` was skipped, and `db migrate` then failed the final verification. Hand-written calls were `additive` because `this.setDefault`'s `operationClass` option defaulted to `additive`. The planner labels a changed default `widening`, which had no postcheck, so planned migrations worked.

The bug is still on main, which has released 8.0.0-rc.17.

## Design decisions Will has made

1. **setDefault carries no postcheck**, whatever its class. A check that compared the value would need the text Postgres stores for the default predicted at plan time, which is fragile. The final schema verification compares the value. Document the empty postcheck thoroughly.
2. **`this.setDefault` has no `operationClass` option.** It derives the class from the migration's start contract: `widening` when the start column has a default, `additive` otherwise. Will: "We don't really want people writing operationClass by hand."
3. **Running postchecks first is correct.** It is how the runner detects an operation that is already applied. ADR 038 says the opposite (prechecks first, postchecks only when a precheck fails) and must be rewritten to match the runner.
4. **The rule for every postcheck:** before the operation runs, its postchecks may all hold only when the operation's full effect is already in place. Will treats this as self-evident ("WHAT THE FUCK ELSE WOULD IT BE FOR"). Do not ask him about it again.

## Scope aphrodite-50 proposed, waiting for Will's "build it"

Will has not yet said "build it". Present this scope (short) and wait for an explicit go. Agreement or a follow-up question is not a go.

1. **ADR 038.** Rewrite "Runner behavior" and the conflict matrix to say postchecks run first to detect an applied operation, then prechecks, execute, postchecks. State the rule above. Move the `setDefault` explanation out of ADR 044 (which is marked Superseded at its top) into ADR 038, and remove the branch's additions to ADR 044 or reduce them to a pointer. In `docs/architecture docs/subsystems/7. Migration System.md`: add the rule to the Idempotency paragraph (around line 336), and fix "Post-apply schema verification (MongoDB)" / "Mongo only" (around lines 341 to 348), because Postgres verifies too (`runner.ts:135`). Also record that `this.setDefault` derives its class from the start contract, which narrows ADR 195's "only the planner has origin context" (a migration carries its start contract, ADR 232).
2. **Audit every postcheck against the rule** in Postgres, SQLite and Mongo. Each runner has the same skip (`sqlite/src/core/migrations/runner.ts` too). Known suspects: postchecks that only check that an object with a name exists, such as `verify index "<name>" exists`, `verify constraint "<name>" exists`, `verify FK ... exists`, `verify RLS policy ... exists` in `postgres/src/core/migrations/operations/{constraints,indexes,rls}.ts`. A hand-written call that reuses a name with a new definition is skipped, and the final verification then fails. For each one that breaks the rule: check the full definition where that can be done reliably, otherwise carry no postcheck. Every change needs a test that fails before the fix. SQLite has no `setDefault` operation.
3. **`this.setDefault` and renames.** It currently looks the column up in the start contract only (`columnHasDefaultInStartContract` in `postgres-migration.ts`), so a table renamed earlier in the same migration reads as `additive`. Main now tracks renames inside a migration (`#renames`, `schemaAfterRenames`, `createWorkingSchema` in `postgres-migration.ts`). Use that.
4. **Revert the optional `schema` work.** Revert WIP commit `4f8dadda4d` (17 methods take `schema?: string`) and the optional `schema` on `setDefault` from `41ec609511`, with new commits. `setDefault` then requires `schema` like the other methods; its tests for the unbound namespace pass `'__unbound__'` explicitly. Keep the type test `test/migrations/postgres-migration-schema-required.test-d.ts`.
5. **Upgrade text.** `upgrade-instructions/pending/setdefault-derives-operation-class/{app,extension}/instructions.md` says rc.15 or rc.16; make it rc.15 to rc.17. Add entries for any operation whose postcheck the audit changes (an unapplied `ops.json` keeps the old postcheck). Release tooling writes the changelog; do not add a changelog line.
6. **File a Linear ticket** (search Linear first) for the separate schema bug: for a table in the unbound namespace, the planner's TypeScript renderer leaves `schema` out of every call (`*Call.renderTypeScript` in `op-factory-call.ts`), but most `PostgresMigration` methods require `schema` and pass it through, so re-running the file writes `"undefined"."user"` into the SQL. Applying `ops.json` is unaffected. On Postgres the unbound namespace only comes from an explicit `namespace unbound { }` (ADR 223); a model with no schema goes into `public`. Recommended approach for the ticket: an omitted `schema` is resolved by looking the table up in the migration's contracts, refusing when ambiguous, as main's `renameTable` already does (`resolveTableRenameAgainst`). ADR 238 says Postgres call sites always name the namespace, so the ticket must reconcile with it. The 18-operation round-trip test in `render-typescript.roundtrip.test.ts` from `4f8dadda4d` is the ticket's failing test; it proves the bug for 18 operation kinds.
7. **Possible follow-up ticket, not this PR:** Postgres `alterColumnType` and Mongo `dropIndex`, `setValidation`, `collMod` still take `operationClass` from the author. There the class only labels the operation for policy (`alterColumnType` defaults to `destructive`) and does not change what runs.

## What the branch already has (commits `dd217be1d7` to `2be62515f9`, reviewed)

- `setDefault` in `operations/columns.ts` returns `postcheck: []`, with a doc comment saying why.
- `this.setDefault` derives its class via `columnHasDefaultInStartContract`. `SetDefaultCall` no longer renders `operationClass`, and its constructor requires the class.
- `emissionSchemaForNamespace` moved to `resolve-ddl-schema.ts`.
- ADR 038 notes and an ADR 044 subsection (to be reworked per scope item 1).
- Upgrade entry `setdefault-derives-operation-class` with two change ids, `setdefault-operation-class-derived` and `setdefault-has-no-postcheck`.
- Tests: unit tests for each way the class is derived (`test/postgres-migration-op-builders.test.ts`), a lowering test, a runner integration test `it.each(['additive','widening'])` that changes `'open'` to `'closed'` (`packages/3-targets/6-adapters/postgres/test/migrations/runner.idempotency.integration.test.ts`, red before the fix), and round-trip tests for `public` and the unbound namespace.
- Reviewers passed all of it except `2be62515f9` (upgrade detection regex fix), which nobody has reviewed.

## Merge conflict notes (2026-10-08 merge)

Three files conflicted. Resolution: took main's `planner.ts` and `table-rename-calls.ts`, removed main's local `emissionSchemaForNamespace` from `table-rename-calls.ts` and imported it from `resolve-ddl-schema.ts`. In `postgres-migration.ts`, kept main's imports plus `emissionSchemaForNamespace`, and kept main's `#renames.push(call)` in `renameConstraint` and `renameIndex` with the WIP `schemaOrDefaultNamespace(...)`. Reverting the WIP commit (scope item 4) changes those two lines back to main's form.

## Validation for the implementer

- Build, typecheck, test and lint `@internal/target-postgres` (and the SQLite and Mongo target packages if the audit touches them). Run `pnpm test --coverage` in every touched package before pushing.
- Typecheck and lint `@internal/adapter-postgres`, then run only its touched test files.
- `pnpm --filter integration-tests test test/authoring/defaults-on-existing-tables.integration.test.ts`
- CLI journey `test/integration/test/cli-journeys/migration-ts-column-defaults.e2e.test.ts`
- `pnpm fixtures:check`, `pnpm check:upgrade-coverage`, `pnpm lint:throws`, `pnpm lint:deps`.
- Never run `pnpm test:integration`, `pnpm test:e2e` or `pnpm test:all` in full locally. Put this rule in every implementer brief.
- No AI attribution lines in commits or PRs from subagents; commits are signed off as `git commit -s --trailer "Signed-off-by: Will Madden <madden@prisma.io>"`.

## After the build

1. `/drive-code-review` with Opus reviewers on everything since `00bb24ed31` that has not been reviewed, then fix what it finds.
2. Manual QA: the reproduction in `original-brief.md` (`repro.sh planned` and `repro.sh hand-written`), against packages built from this branch after merging main and rebuilding (see `drive/qa/README.md`). Expected: `db migrate` exits 0 and the column ends up `'closed'::text`. For an orphan slice the QA script goes in the PR description. Add a QA case for one audited operation (for example a hand-written index that reuses a name).
3. PR: title "TML-NNNN: sentence" if a ticket exists, never a conventional-commit prefix. The description opens with a concrete example and states the decision first, alternatives last. Put `Agent: <your name>` above the attribution line. Push via the `bot` remote. Turn on the app's CI monitor and auto-fix.
4. Bring the PR to Will for final verification.

## Working with Will

- Plain English, short. No invented jargon. Never use "load-bearing", "smoking gun", "belt and suspenders", "gate".
- Do not use the question UI. Do not ask him things the code can answer. Take a position.
- Do not build until he says "build it". After that, do not interrupt him for engineering decisions.
- Core defects are fixed now, not filed as follow-ups. Fix the whole class of a defect in one PR.
- Never write files to `/tmp`; keep them in the worktree (`wip/` is gitignored).
