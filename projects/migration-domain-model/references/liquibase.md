# Liquibase

> Schema-oriented database change management: versioned **changelogs** of **changesets** are applied in file order (with filters), while the database remembers what ran via **tracking tables**, optional **tags** anchor rollbacks, and **checksums** detect edits to already-deployed definitions.

## Mental model

Liquibase is **file-ordered and DB-tracked**, not graph-based: a root **changelog** is parsed top-to-bottom; **include** / **includeAll** compose a tree of files, but execution follows that composed sequence. The **unit of change** is the **changeset** (typically one logical operation); the **unit of identity** for “has this run?” is the composite **id**, **author**, and changelog **filename** (path), optionally stabilized with **logicalFilePath**. The system is **imperative at the changeset level** (each changeset names a **change type** or raw SQL) with **declarative-ish** change types on XML/YAML/JSON that expand to vendor SQL. **Update** applies pending changesets; **rollback** walks the deployment ledger backwards by tag, count, or timestamp. **Contexts** and **labels** (and CLI **context-filter** / **label-filter**) gate which changesets participate in a run. **Preconditions** gate execution based on database state. Drift and baselining are first-class adjacent concerns (**diff**, **generate-changelog**, **changelog-sync**).

## Vocabulary

### Nouns

- **Changelog**: Text-based ledger (SQL, XML, YAML, JSON, or formatted variants) listing database changes; versioned in source control; referenced as `--changelog-file`.
- **Root changelog**: Entry changelog passed to the CLI; may **include** other changelogs.
- **Changeset**: Atomic unit of change inside a changelog; contains **change types** and/or SQL; tagged with **author** and **id**.
- **Change type**: Named operation (createTable, addColumn, etc.) in structured changelogs; Liquibase translates to database-specific SQL; contrast with raw SQL in formatted SQL changelogs.
- **Author**: Required changeset attribute; part of uniqueness with **id** and file path.
- **Id**: Required changeset identifier; docs stress it does not define execution order (order is changelog sequence).
- **Comment**: Optional human note on a changeset; stored in tracking tables.
- **Precondition**: Condition evaluated before running changelog or changeset content; failures can halt with an error.
- **Context**: Attribute on changelog header or changeset used to include/exclude work for a given run; matched by CLI **context-filter** (older **contexts** flag).
- **Label**: Parallel mechanism to contexts for filtering changesets; matched by **label-filter**.
- **DATABASECHANGELOG (DBCL)**: Table of applied changesets; created if missing; default name overridable via **database-changelog-table-name**.
- **DATABASECHANGELOGLOCK (DBCL lock table)**: Coordinates concurrent Liquibase usage against the same database (see **list-locks** / **release-locks**).
- **DATABASECHANGELOGHISTORY (DBCLH)**: Optional Secure feature (4.27.0+) retaining append-only history of Liquibase operations including rollbacks; distinct from DBCL rows being removed on rollback.
- **MD5SUM / checksum**: Fingerprint of a changeset at execution time; compared on later runs to detect unexpected edits; dedicated checksum utilities exist.
- **EXECTYPE**: How a row was recorded (`EXECUTED`, `FAILED`, `SKIPPED`, `RERAN`, `MARK_RAN`).
- **DATEEXECUTED** / **ORDEREXECUTED**: Timestamps and ordering columns supporting rollback ordering and forensic ordering.
- **DEPLOYMENT_ID**: Shared identifier for all changesets applied in one operation.
- **Tag**: Named marker of database state for rollback targeting; stored in DBCL **TAG** column when **tag** command runs.
- **Drift**: Divergence between expected schema (changelog / reference DB) and a target database; surfaced by **diff** and related commands.
- **Snapshot**: Captured database state artifact for comparisons over time or across databases.
- **Reference database**: Source side of **diff** / **diff-changelog** via `--reference-url`.
- **Target database**: Database identified by `--url` where commands execute.
- **Search path / filename**: Path contributing to changeset identity; docs recommend relative paths for stable identity.
- **logicalFilePath**: Changelog or changeset attribute overriding file path in the unique identifier when files move or rename.
- **Flow file**: Declarative orchestration artifact (Liquibase Secure positioning) for repeatable compliant command sequences.
- **Policy checks**: Automated governance checks (Liquibase Secure) applied before promotion.
- **Update report**: Optional summarized output for **update** (Secure 4.25.1+ noted in command docs).
- **ChangeExecListener**: Extension hook class for observing changeset execution.
- **Properties file / defaults file**: `liquibase.properties` carrying parameters; alternative to CLI flags / env vars / `JAVA_OPTS`.
- **Hub / commercial packaging**: Distribution detail: **init project** documentation references bundled commercial JAR placement.

### Verbs

- **Update**: Apply pending changesets to the target database and append DBCL rows.
- **Rollback**: Remove DBCL rows for reverted changesets and execute inverse or scripted SQL back to a tag, datetime, or count.
- **Deploy** (colloquial in docs): Often synonymous with running **update** against an environment.
- **Parse**: Read changelog format (extension + header) and expand includes.
- **Validate**: Statically check changelog for issues that could break **update**.
- **Sync (changelog-sync)**: Mark changesets as executed without running their change SQL—baseline / hand-alignment.
- **Mark ran**: Record a changeset as executed (`mark-next-changeset-ran`, `MARK_RAN` exec type conceptually).
- **Tag**: Attach a release label to current DBCL position for future **rollback**.
- **Diff**: Compare schemas or snapshots to detect missing/unexpected objects.
- **Generate-changelog**: Reverse-engineer a changelog from an existing database schema.
- **Snapshot / snapshot-reference**: Capture current state of target or reference DB.
- **Execute-sql**: Run ad hoc SQL or a SQL file outside normal changeset deployment.
- **Drop-all**: Drop managed objects in the target database (destructive utility).
- **Calculate-checksum / clear-checksums**: Inspect or reset stored checksums when reconciling definition changes.
- **List-locks / release-locks**: Inspect or clear DBCL lock rows after interrupted runs.
- **Db-doc**: Emit schema documentation summarizing actions against the database.
- **Set-contexts / set-labels** (Secure): Mutate attributes on changesets from the CLI.
- **Connect** (Secure): Verify JDBC connectivity configuration.
- **Dbcl-history** (Secure): Print **DATABASECHANGELOGHISTORY** contents.

### Events / lifecycle states

- **Pending / undeployed changeset**: Present in changelog, absent (or not yet matched) in DBCL for the target—what **status** lists.
- **Deployed / executed changeset**: Row exists in DBCL with `EXECTYPE` commonly `EXECUTED`.
- **Skipped**: Changeset excluded by contexts/labels or preconditions for this run.
- **Failed**: Execution halted; `EXECTYPE` may record `FAILED` depending on path; **failOnError** attribute influences whether a failure aborts the batch.
- **RERAN**: Changeset executed again under controlled circumstances (e.g., **runAlways** / **runOnChange** flows).
- **Rollback removal**: Successful rollback deletes corresponding DBCL rows (contrasts with DBCLH retention).
- **runOnChange**: Reapply when definition checksum changes while retaining identity.
- **runAlways**: Reapply on every migration run regardless of prior execution.
- **runInTransaction**: Controls transactional boundaries per changeset (default single transaction).

### Identities / addressing

- How are migrations identified? Primarily by **author** + **id** + changelog **filename** (path), with **logicalFilePath** able to substitute a stable logical path; ordering is by changelog sequence, not by **id** format (timestamps are optional convention). **MD5SUM** fingerprints the definition at run time to detect post-deploy edits.
- How are environments / branches addressed? Separate JDBC **url** (and credentials) per target; optional **contexts** / **labels** on changesets filtered at runtime via **context-filter** / **label-filter**; **reference-url** pairs with **url** for diff-oriented workflows. Branching is a VCS concern layered on top—Liquibase does not assign branch IDs to changesets.
- How does the database track which migrations have run? Rows in **DATABASECHANGELOG** (custom name supported); cooperative locking in **DATABASECHANGELOGLOCK**; optional **DATABASECHANGELOGHISTORY** (Liquibase Secure, 4.27.0+) records a broader event stream including rollbacks and sync operations. **DEPLOYMENT_ID** ties rows from one CLI run; **EXECTYPE** records execution disposition (`EXECUTED`, `FAILED`, `SKIPPED`, `RERAN`, `MARK_RAN`).

## CLI command surface

**Create / scaffold**

- **`init project`**: Scaffold project folder with starter changelog and properties (distribution requirements per docs).
- **`init start-h2`**: Launch bundled H2 for local experimentation.
- **`generate-changelog`**: Reverse-engineer a changelog from live target schema.
- **`diff-changelog`**: Emit a deployable changelog that would reconcile target vs reference differences.

**Apply**

- **`update`**: Run pending changesets and append DBCL rows.
- **`update-sql`**: Preview SQL that **`update`** would execute.
- **`execute-sql`**: Run arbitrary SQL or script against the database.
- **`changelog-sync`**: Mark all undeployed changesets executed without running their changes.
- **`changelog-sync-sql`**: Preview SQL for **`changelog-sync`** bookkeeping.
- **`changelog-sync-to-tag`**: Mark executed up to a tag boundary without running intervening changes.
- **`changelog-sync-to-tag-sql`**: Preview SQL for **`changelog-sync-to-tag`**.
- **`mark-next-changeset-ran`**: Mark only the next pending changeset as executed.
- **`mark-next-changeset-ran-sql`**: Preview SQL for **`mark-next-changeset-ran`**.
- **`drop-all`**: Remove database objects wholesale (utility, destructive).

**Inspect**

- **`diff`**: Compare reference vs target schemas or snapshots over time.
- **`diff` JSON** (Secure): Machine-readable drift output for automation.
- **`snapshot`**: Capture target database state artifact.
- **`snapshot-reference`**: Capture reference database state.
- **`validate`**: Lint changelog structure/attributes before deployment.
- **`db-doc`**: Generate HTML/Javadoc-style database documentation of recorded actions.
- **`calculate-checksum`**: Compute checksum for a specific changeset definition.
- **`list-locks`**: Show active Liquibase lock records (host/IP/timestamp).
- **`release-locks`**: Clear stale lock rows after interruptions.

**Rollback**

- **`rollback`**: Revert deployed changes back to a named **tag**; removes DBCL rows for rolled-back changesets.
- **`rollback-sql`**: Preview SQL for **`rollback`**.
- **`rollback-to-date`**: Revert to a specific timestamp state.
- **`rollback-to-date-sql`**: Preview SQL for **`rollback-to-date`**.
- **`rollback-count`**: Revert the last N deployed changesets.
- **`rollback-count-sql`**: Preview SQL for **`rollback-count`**.
- **`future-rollback-sql`**: Preview rollback SQL for not-yet-deployed tail of changelog.
- **`future-rollback-from-tag-sql`**: Preview hypothetical rollback bounded by a future tag.
- **`future-rollback-count-sql`**: Preview hypothetical rollback for N future changesets.
- **`rollback-one-changeset`** (Secure): Revert an isolated changeset without disturbing neighbors.
- **`rollback-one-changeset-sql`** (Secure): Preview SQL for **`rollback-one-changeset`**.
- **`rollback-one-update`** (Secure): Revert an entire deployment identified by **DEPLOYMENT_ID**.
- **`rollback-one-update-sql`** (Secure): Preview SQL for **`rollback-one-update`**.

**Status**

- **`status`**: List undeployed changesets (pending work) for the changelog against the target DB.
- **`unexpected-changesets`**: Count DB rows for changesets not present in the current changelog (footprint vs source divergence).
- **`history`**: List deployed changesets (docs positioning relative to DBCL/DBCLH depending on edition/features).
- **`dbcl-history`** (Secure): Render **DATABASECHANGELOGHISTORY** rows (e.g., JSON) for deep audit timelines.
- **`connect`** (Secure): Non-destructive connectivity check.

## Distinctive vocabulary choices

- **Changeset vs migration**: Liquibase never centers the word “migration” as the atomic noun—the persisted, addressable unit is a **changeset** with explicit **author:id** plus file identity.
- **Changelog as ledger**: The versioned file is a sequential ledger, not merely a bundle; compositional **include** / **includeAll** still linearizes into an ordered stream at runtime.
- **Change types as semantic operations**: Cross-vendor abstractions (`createTable`, …) sit alongside escape hatches (`sql`, `sqlFile`)—two authoring modes (structured vs raw SQL) share one runtime model.
- **logicalFilePath**: First-class re-homing story for identity stability when files move—avoids rewriting historical ids.
- **Checksum enforcement + runOnChange/runAlways**: Strong “immutable deployed definition” default with explicit escape valves for iterative objects (views, procs) and exceptional re-run semantics.
- **Contexts and labels**: Dual tagging dimensions orthogonal to file order, selected at CLI via **context-filter** / **label-filter** (renamed from legacy **contexts** flag in newer versions).
- **Preconditions**: First-class gating separate from filters—assert DB state before irreversible operations.
- **Tag-driven rollback**: Release markers are both human workflow objects and mechanical rollback stop points (`rollback` command).
- **changelog-sync family**: Vocabulary for “make DBCL match reality without executing SQL”—distinct from **update** and from **rollback**.
- **DATABASECHANGELOG vs DATABASECHANGELOGHISTORY**: Split between “current applied footprint” (rows deleted on rollback) and optional “full operational narrative” including rollbacks and sync events (Secure).
- **SQL preview siblings**: Parallel `*-sql` commands for update/rollback/sync/mark operations encode “plan then execute” as part of the command naming scheme.
- **Deployment ID**: Groups all rows written in one invocation—supports targeted rollback of a blast radius (**rollback-one-update**).

## What this system's vocabulary makes easy / hard

- **Easy**: Expressing gated, sequential schema edits with strong identity and audit columns; pairing forward deploy (**update**) with multiple rollback strategies (tag, count, timestamp) and explicit SQL previews; capturing drift and generating follow-on changelogs (**diff**, **generate-changelog**, **diff-changelog**).
- **Hard**: Modeling divergent long-lived branches purely in-domain—ordering is file-global, reconciliation relies on VCS discipline plus contexts/labels; rollback fidelity depends on per-changeset rollback definitions or auto-rollback coverage, so not every forward change has an equally safe mechanical reverse.
