# Handover: databases declare how they may change

Written 2026-10-23 by the agent eowyn-52, ahead of a rate limit. Delete this file at project close-out.

## Read these first

1. **This conversation's transcript** (the whole design session with Will Madden, 2026-10-15 to 2026-10-23):
   `/Users/will/.claude/projects/-Users-will-Projects-prisma-orm--claude-worktrees-agents-db-reset-design-2a94d6/a02116db-9e86-47d5-848d-e0501dfe2e70.jsonl`
   Will's own messages are the rulings. To list them: `jq -r 'select(.type=="user" and (.message.content|type)=="string") | .message.content' <file>`.
2. **The implementer subagent's transcript**, for slice 1's code:
   `/Users/will/.claude/projects/-Users-will-Projects-prisma-orm--claude-worktrees-agents-db-reset-design-2a94d6/a02116db-9e86-47d5-848d-e0501dfe2e70/subagents/agent-a18f6dc49fff15489.jsonl`
3. [`spec.md`](spec.md): the authoritative design. [`design.md`](design.md): the reasoning, scenarios, prior art and rejected alternatives. [`plan.md`](plan.md): the five slices. [`slices/1-off-graph-error/spec.md`](slices/1-off-graph-error/spec.md): slice 1's contract, with the exact error content.

## Where the work is

- **Branch:** `tml-3725-off-graph-error` in prisma/orm, pushed to the `bot` remote (`git@github-wmadden-electric:prisma/orm.git`). No pull request is open yet.
- **Linear:** project [P-TML-1165](https://linear.app/prisma-company/project/databases-declare-how-they-may-change-a870e49c25a5). Slices: TML-3725 (slice 1, In Progress), TML-3726, TML-3727, TML-3728, TML-3729.
- **Commits on the branch:**
  - the project documents (spec, design, plan);
  - slice 1's documentation and skill changes, written by the orchestrator and complete;
  - slice 1's code, committed as `WIP:` by the implementer when the session stopped. Its message says what is done and what remains.
- **Composer:** a clone was made at `wip/composer` (gitignored, not pushed). Re-clone `git@github-wmadden-electric:prisma/composer.git` into your worktree's `wip/` when you reach slices 2 and 5. The deploy step is `packages/1-prisma-cloud/1-extensions/target/src/orm-migrate.ts`.

## What the project is

On 2026-10-15 an agent deploying `prisma/asks` to its shared development environment with Prisma Composer hit `MIGRATION_PATH_NOT_FOUND`. A branch's migration had been applied there, then planned again, so the database's marker named a hash no committed migration starts from. The agent decided `db update` was only for local databases and proposed resetting the database. Will's rule: **never reset a database; it can always be moved with migrations or `db update`.**

The design, settled with Will:

- **Change policy:** the strategies a database may be changed by, `migrate` (walk the migration graph) and `reconcile` (`db update`: plan, apply, sign). `db sign` counts as `reconcile`.
- **Data protection policy:** `dataLoss` and `accessWidening`, each `-forbidden`, `-with-consent` (the default, today's behaviour) or `-permitted`. Will chose these level names.
- **Refs declare the desired policies; the marker records the policies in force**, under `meta.policies`. The database must be readable on its own, without the repository.
- **A ref and its database must agree before a deploy runs.** If they differ, the deploy fails (`MIGRATION.POLICY_MISMATCH`) unless given `--permit-policy-change`. With the flag, the policies are written first and the migrations run under them. A missing declaration never changes a policy. No error ever suggests the flag.
- **The off-graph error** (`MIGRATION.MARKER_MISMATCH`, raised by the control API so Composer shows it too) explains the cause from the ledger, and gives the recovery the database's change policy permits.
- **Compatibility policy and permitted change operations** are deferred, as are a one-step rejoin command, a privileged role for writing policies, and `prisma postgres connection delete --project`. These are Linear follow-ups at close-out.

## Slice 1's code at the `WIP:` commit (`4cccb06da6`)

**Already true on `main` before this branch:** the control API's `migrate` already fails with `CliStructuredError`, and `MigrateFailure`, `MigrateFailureCode` and `mapMigrateFailure` no longer exist (since TML-3622). The slice spec's first section is out of date on this; update it.

**Done:**
- **One shared builder,** `errorMarkerMismatch`, in `packages/1-framework/3-tooling/cli/src/utils/marker-mismatch.ts`. It builds the summary, the `why` from the ledger, the five next actions and `meta`.
- **`readLedgerQuietly`** tolerates a ledger read that fails.
- **The old `errorMarkerMismatch` is deleted from `cli-errors.ts`,** and with it the recoveries that could not work.
- **`refuseMarkerOutsideGraph` in `graph-queries.ts` is now async.** It is used by the pre-DDL check in `db migrate`, by `db migrate --show`, and by `executeMigrate`'s no-path branch (every space). That branch returns `MARKER_MISMATCH` for a marker that isn't a graph node, and `PATH_UNREACHABLE` otherwise.
- **Unit tests:** `test/utils/marker-mismatch.test.ts` and `test/control-api/migrate-no-path.test.ts` are new. `graph-queries.test.ts`, `cli-errors.test.ts` and `migrate-show.test.ts` are updated. These 5 files pass, 61 tests.
- **Builds:** `pnpm build` passes. A fresh worktree needs `pnpm install` first.

**Differences from the spec, accepted:**
- Printed commands follow `cliCommand`, so `--db <url>` comes last and appears only when the CLI was given `--db`. Composer passes `dbGiven: true`.
- Hashes print in full.
- `ExecuteMigrateShowPlanOptions` gained an optional `invocation`.

**Left:**
- **The Postgres integration test** that replays the incident with a whole-envelope assertion, in `test/integration/test/cli.migrate-drift-check.e2e.test.ts`. That file still asserts the old recoveries (`/migration plan/`, `/ref set db/`) and `meta.reachableHashes`, around lines 84 to 89 and 142, and will fail until it is updated.
- **The `MIGRATION.MARKER_MISMATCH` entry in `docs/reference/error-reference.md`:** its new meta, and its new producing sites, `db migrate` and the control API.
- **A sweep of CLI error text** for any advice to reset or drop a database, or wording that scopes `db update` to local databases.
- **Gates not yet run:** package `lint`, the CLI package's full tests, the test typecheck, `pnpm lint:deps`, and the error-reference check.

## Next steps

1. **Finish slice 1** (TML-3725) from the `WIP:` commit: the items under "Left" above. Until slice 3, the error lists both recoveries, each labelled with the kind of database it is for.
2. **Manually check the skill's migration-only recovery.** It's in `skills/prisma-8/references/migrations.md`, section "A database whose marker is not in the migration graph":
   - restore the snapshot from git history;
   - run `migration plan --from <last graph hash> --to <marker hash>`;
   - then run `migration plan --from <marker hash> --to <target>`.

   Nobody has run it yet. If `--to` can't resolve a hash that is only in the snapshot store, fix the section.
3. **Before opening the pull request:**
   - run `/drive-code-review`, without the walkthrough, and fix what it finds;
   - run the pre-push checks that match CI: per-package lint, typecheck, tests, `lint:deps`, the error-reference check, and the integration files you touched (never the full integration suite locally).
4. **Open the pull request** for slice 1. Then turn on Auto-fix (`mcp__ccd_pr__set_monitor` with `auto_fix: true`), and start a background wait for merge, close or a failed check. Will's instructions on pull requests are in `~/.claude/CLAUDE.md`.
5. **Then the remaining slices,** in the plan's order:
   - slice 3 (orm), policies and change-policy enforcement;
   - slice 4 (orm), data protection;
   - slice 2 (composer), after an ORM release containing slice 1;
   - slice 5 (composer), after a release containing slice 3.

## Rulings from Will to keep

- Never propose or document resetting or dropping a database. The CLI has no reset operation.
- `db update` is for databases whose migration history does not need to be kept: local, development, staging and preview, shared or not. A database that changes only through migrations, such as production, is moved with migrations. Never describe `db update` as "dev-only", "solo" or "local".
- Policies live in the marker as well as on the ref, because the database must be readable in isolation. The Rails model, where the database stores only a pointer, was rejected.
- `migrate` and `db update` never change a policy without explicit consent.
- CI/CD can only deploy what is committed. Don't design steps a pipeline would have to run separately.
- Don't invent problems that the agreed rules already solve. Will was angry when a list of "remaining problems" turned out to be answered by rules already settled.
- Read the design docs (the architecture overview, the relevant ADRs in full, the glossary, the migration domain docs) before offering any design opinion, and say what you read.
- Write to Will briefly, in plain English sentences, with no invented terms. Ask each question as a concrete scenario. Lead with the decision; put alternatives last.
- Name yourself at session start (see `~/.claude/CLAUDE.md`) and put `Agent: <name>` in pull request descriptions.
