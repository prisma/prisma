# Slice 1: the off-graph error, and no more reset advice — spec

Linear: [TML-3725](https://linear.app/prisma-company/issue/TML-3725). Project spec: [`../../spec.md`](../../spec.md), section *Errors*. Branch: `tml-3725-off-graph-error`.

## At a glance

A Composer deploy or `prisma db migrate` against a database whose marker is not in the migration graph fails with:

```text
✖ The database is at a contract that is not in the migration graph (MIGRATION.MARKER_MISMATCH)
  why  The database's marker names contract 267755c4…, and no migration in migrations/app starts or ends there.
       This usually means a migration this database applied was later planned again or deleted, for example a
       branch that was deployed and then rebased. The database last applied 9f1e02ab…, then
       20261013T0910_request_description, which is no longer on disk. The database does not need to be reset or dropped.
  next If this database's migration history does not need to be kept (a local, development, staging or preview database):
         prisma db update --db <url> --to 4b1c…e09a --dry-run
         prisma db update --db <url> --to 4b1c…e09a
         then deploy again
       If this database changes only through migrations, as production should: author a migration from 9f1e02ab… to
       the database's current contract, then one from there to 4b1c…e09a, commit them, and deploy again.
```

## Chosen design

### The control API's `migrate` returns structured envelopes

`executeMigrate` in `packages/1-framework/3-tooling/cli/src/control-api/operations/migrate.ts` today returns `MigrateFailure` with its own codes, `MIGRATION_PATH_NOT_FOUND` and `RUNNER_FAILED` (`MigrateFailureCode` in `control-api/types.ts`). The CLI maps them in `utils/migrate-failure.ts`. That mapping is the boundary rewrite the structured-errors decision record (ADR 245) forbids, and it is why Composer never sees the CLI's next actions.

After this slice, the control API's `migrate` result's failure is a `CliStructuredError` built where the failure is detected, with the same code, `why`, `nextActions` and `meta` the CLI prints today, or better. `MigrateFailure`, `MigrateFailureCode` and `mapMigrateFailure` are deleted; the CLI renders the envelope it receives. Runner failures keep their current CLI code and content (`MIGRATION.RUNNER_FAILED` with `migrateFix`'s advice), now built inside the control API. The no-migrations-on-disk case (`buildNeverPlannedFailure`) keeps its current CLI code and content.

### Two causes, two codes

When `migrate` finds no path from the database to the target, it distinguishes:

1. **The marker's storage hash is not a node of the space's migration graph** → `MIGRATION.MARKER_MISMATCH`, with the content below. This applies per contract space: the application space and each extension space.
2. **The marker is a graph node, but the target is not reachable from it** → `MIGRATION.PATH_UNREACHABLE`, with its current content (plan `--from <marker> --to <target>`, then apply).

An empty database (no marker) is never case 1.

### `MIGRATION.MARKER_MISMATCH` content

- **summary:** `The database is at a contract that is not in the migration graph`
- **why:** as in the example above, built from:
  - the marker's storage hash;
  - the space's migrations directory, relative to the project, as printed elsewhere in migrate errors;
  - **the last graph hash and the missing migrations, from the database's ledger.** Read the space's ledger (`readLedger`), newest entry first. The first entry whose `to` is a graph node gives the last graph hash; the entries newer than it, oldest first, give the missing migrations by `migrationName`. If no entry's `to` is a graph node, leave out the sentence naming the last graph hash and list nothing. If the ledger cannot be read, leave both out; never fail the error for it.
  - the closing sentence, always: `The database does not need to be reset or dropped.`
- **nextActions**, in order:
  1. `user-choice`: `If this database's migration history does not need to be kept (a local, development, staging or preview database), reconcile it to the target:`
  2. `run-command`, label `Preview the changes`: `{bin} db update --db <url> --to <target hash> --dry-run`
  3. `run-command`, label `Reconcile the database`: `{bin} db update --db <url> --to <target hash>`
  4. `user-choice`: `Then deploy again.`
  5. `user-choice`: `If this database changes only through migrations, as production should: author a migration from <last graph hash> to the database's current contract, then one from there to <target hash>, commit them, and deploy again.` When there is no last graph hash, say `from the nearest contract in the migration graph` instead.
- **meta:** `spaceId`, `markerHash`, `targetHash`, `lastGraphHash` (or absent), `missingMigrations` (array of names, possibly empty).

`{bin}` and `--db <url>` follow the existing printed-command conventions (`utils/printed-command.ts`): commands print with the `--config` and `--db` the CLI was given. For a caller that is not the CLI, such as Composer, the control API prints `--db <url>` literally.

The CLI's existing pre-DDL check (`control-api/operations/graph-queries.ts`, `errorMarkerMismatch` in `utils/cli-errors.ts`) raises the same envelope, so both paths produce identical output. Its current recoveries, `migration plan --from <graph tip>` and `migration ref set db <marker hash>`, are removed: neither brings the database back onto the graph.

No error in this slice suggests `contract infer`, a reset, or dropping the database.

## Coherence rationale

One reviewer can hold this in one sitting: one failure type is replaced by envelopes, one error gains a ledger-built explanation, and the skill and docs change to match. Splitting the docs off would ship an error whose guidance the skill contradicts.

## Scope

**In:**
- the control API `migrate` failure type and its producers;
- the CLI's `db migrate` rendering;
- `errorMarkerMismatch` and the pre-DDL check;
- the ledger read;
- `docs/reference/error-reference.md` entries for `MIGRATION.MARKER_MISMATCH` (new producing site and meta shape) and any code whose producing site moves;
- tests;
- the `prisma-8` skill (`SKILL.md` rule and triggers, `references/migrations.md` new section and the `db update` wording, `references/debug.md` table, `references/migration-review.md` and `references/migration-model.md` where they describe these recoveries);
- the migration domain docs (`docs/design/10-domains/migration/README.md`, `user-journeys.md`): replace "dev-only" and "tears down and rebuilds" for `db update`;
- ADR 123: amend to remove "reset and reapply" as a recovery and "auto-reset" as development policy;
- the Migration System doc's recovery table.

**Out:**
- policies of any kind (slice 3);
- Composer (slice 2);
- `migration plan` and `migration ref set` errors other than the ones above.

## Pre-investigated edge cases

| Case | Expected |
|---|---|
| The incident: marker at a hash whose migration was deleted; ledger shows a graph hash, then the deleted migration | `MARKER_MISMATCH` naming both, with all five next actions |
| Marker off the graph, ledger empty or every `to` off the graph | `MARKER_MISMATCH` without the last-graph-hash sentence; the migration next action says "from the nearest contract in the migration graph" |
| Marker in the graph, target not reachable | `PATH_UNREACHABLE`, unchanged content |
| No marker (empty database) and no path | Not `MARKER_MISMATCH`; the existing no-path or never-planned error |
| Extension space off its graph | `MARKER_MISMATCH` for that space, naming its migrations directory |
| A runner failure | `MIGRATION.RUNNER_FAILED`, same content as today |

## Slice-specific done conditions

- Integration test on Postgres replays the incident through `db migrate` and asserts the whole envelope (code, summary, why, nextActions, meta).
- No text under `skills/`, `docs/` or CLI error strings recommends resetting or dropping a database to fix a migration problem, or scopes `db update` to local, solo or dev-only databases.
