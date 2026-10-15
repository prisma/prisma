# Evidence behind the plan

One entry per row of [plan.md](plan.md): the pull requests, tickets and dates that justify the status there. Read the plan first; come here when you need to click through.

States were last checked against GitHub and Linear on 2026-10-15.

## Stream 1: Foundations and breaking changes

**Row 1, finish ADR 254.** Design finished 2026-09-29. Merged 2026-10-06: data types declare their names and parameters (TML-3386, prisma/orm#30547), and contract columns store a data type id with an upgrade script (TML-3388, prisma/orm#30576). In progress: TML-3531, a data type owns its values and a codec converts them; dates, times and bytes are written with tags; SQLite gets `sqlite/datetime` and `sqlite/json`. Backlog: TML-3387 (verify and infer read types from the declarations) and TML-3389 (the cast rule checks function arguments, enum values and discriminator values). The plan PR (prisma/orm#30518) was closed; its documents landed with slice 1. Open since 2026-10-08, not yet reviewed: prisma/orm#30656, a rewrite of ADR 254 in which a data type owns its values and a codec converts them, with the plan for the slice that builds it. It takes in the date and time default work (TML-3404, TML-3405).

**Row 2, one CLI and one config file.** Composer's config is the `composer` section of `prisma.config.ts` (prisma/composer#328, merged 2026-10-01). The `prisma-composer` binary is gone, nothing names it, and a lint keeps it out (prisma/composer#331, merged 2026-10-05). `prisma` hosts that release from 8.0.0-rc.20 (prisma/prisma-cli#330). `prisma` gets no `destroy` or `log` command, by the project's decision: they stay operations on `@prisma/composer/control`, and a command-line form is separate work. The public docs (prisma/web#8387) and the ORM-side shaping PR (prisma/orm#30536) merged on 2026-10-08, and the project was closed out in prisma/orm#30654 (TML-3340).

**Row 3, early MySQL attempt.** No ticket, no branch.

**Row 4, SQL expression literals.** Merged: the `sql` tag writes the data type `sql/expression` (TML-3296, prisma/orm#30534), raw SQL ending in a line comment renders valid DDL (TML-3287, prisma/orm#30546), and migration files write SQL holding both quote kinds (TML-3290, prisma/orm#30554). Those tickets were closed on 2026-10-07. Also merged: attribute arguments declare their data type (TML-3367, prisma/orm#30539, 2026-10-07), and index, check and policy SQL written as `sql` literals (TML-3288, prisma/orm#30550, 2026-10-08). Then merged: the TypeScript builder takes `sql` values (TML-3289, prisma/orm#30558, 2026-10-09), and the stretch goal, generated migration files write SQL as `sql` values (TML-3297, prisma/orm#30677, 2026-10-12). Closed out in prisma/orm#30690 on 2026-10-12. Follow-up: TML-3554.

**Row 5, PSL mixins.** TML-3055. Serhii takes it (Will, 2026-10-05). Project `projects/psl-mixins/`, built by Steven, five slices. Merged: parse and format mixin declarations (prisma/orm#30675, 2026-10-12), with binder groundwork in prisma/orm#30674 and prisma/orm#30659. Then merged: inclusion in models, types, enums and extension blocks (prisma/orm#30694, 2026-10-13), language-server navigation, hover, rename and colour (prisma/orm#30679, 2026-10-13), and completion with ADR 269 (prisma/orm#30681, 2026-10-14). Closed out in prisma/orm#30718 on 2026-10-14. Removing type aliases and field presets has no ticket.

**Row 6, remove `@noCheck`.** No ticket. Replacements decided, see [decisions.md](decisions.md). Unblocked: nullable list elements merged on 2026-10-01 (prisma/orm#30051).

**Row 7, migration statements.** Shaped 2026-10-05 (prisma/orm#30604, Linear project "Destructive changes need stated intent"). The shaping PR closed as superseded; the project folder `projects/migration-statements/` landed on main with slice 1. Merged 2026-10-08: slice 1, `--rename` for models and fields (TML-3475, prisma/orm#30638), and slice 2, `migration plan` and `db update` refuse data loss until each drop is answered with `--delete` or `--rename` (TML-3476, prisma/orm#30648). Slice 2 is the breaking change. The CLI engine side of slice 2 merged in prisma/prisma-cli#337. The rest was re-planned on 2026-10-12 into five slices (prisma/orm#30666): 3a, `--convert` and `--backfill` on Postgres and SQLite (TML-3477, prisma/orm#30695, merged 2026-10-14); 4a, renames and deletes on MongoDB (TML-3478, prisma/orm#30691, merged 2026-10-13); 4p, TypeScript MongoDB contracts get the PSL validator (TML-3553, in progress, spec approved 2026-10-15); 3b, the remaining renames and deletes on Postgres and SQLite (TML-3537); 4b, convert, backfill and value object renames on MongoDB (TML-3538). Defects found on the way, in backlog: TML-3563, TML-3564, TML-3565. Replaces `@hint`, shelved on 2026-10-05; its drafts prisma/orm#30557 and prisma/orm#30570 are still open.

## Stream 2: Upgrade path from Prisma 7

**Row 1, close every urgent and high upgrade issue.** Linear projects "Prisma 7 contract source: gaps and defects" and "Contract print and Prisma 7 source follow-ups". Done since 2026-09-28: TML-3252, TML-3256, TML-3260, TML-3278, TML-3358, and TML-3250 (fix merged in prisma/orm#30520 on 2026-09-30, ticket closed 2026-10-09). Open: TML-3267 and TML-3268 (high: `@updatedAt` with `@default(now())`, and generated values on optional fields; both backlog), and TML-3322, TML-3323, TML-3326 (high, `contract print`; all backlog). The high issues from the migration handover are in row 2.

**Row 2, Prisma 8 owns migrations in a Prisma 7 project.** Proven 2026-10-05 in prisma/orm#30601. No baseline command is needed. Merged 2026-10-07: adding `autoincrement()` to an existing column (TML-3466) and keeping Prisma 7's constraint names (TML-3452, high), both in prisma/orm#30606. The project docs on main dropped the baseline step in prisma/orm#30605, merged 2026-10-08. TML-3462 (removing `@ignore` after the handover) was settled by row 3 and closed 2026-10-09. Open gaps: the planner refuses enum value changes (TML-3456, high), referential action changes (TML-3457, high) and primary key changes (TML-3458); TML-3460 (the datasource's extensions list); TML-3461 (`prisma migrate dev` and the other Prisma 7 commands answer with their replacements).

**Row 3, storage a model does not map.** Design settled with Will on 2026-10-07 and recorded as ADR 267 in design PR prisma/orm#30641, open. The number clash with the activity-tree design was settled when that design merged as ADR 271. The earlier "unexposed storage" attempt (prisma/orm#30631, closed) described the concept as fields the ORM hides; the settled design declares storage as storage, with `columns` in a model's `.sql({ ... })` and a `table(...)` declaration beside models, entering the contract at the assemble step of a split lowering. Linear project P-TML-1151. Merged 2026-10-09: a contract definition holds columns and tables no model maps (TML-3468, prisma/orm#30665); the SQL ORM reads and writes only mapped columns (TML-3532, prisma/orm#30667); the Prisma 7 reader keeps `@ignore` columns and tables (TML-3467, prisma/orm#30672); Prisma 7's `_prisma_migrations` is left out of introspection, so strict verify passes (TML-3453, prisma/orm#30671). Merged 2026-10-13: ADR 267 (prisma/orm#30641); a model with no fields has no keys in TypeScript (TML-3536, prisma/orm#30705); the close-out (prisma/orm#30704). Settles TML-3453 (`_prisma_migrations` is not declared in the contract; the Postgres adapter leaves it out of introspection, so `db verify --strict` passes after the handover), TML-3467 (adding `@ignore` after the handover dropped the column without asking) and the reverse case in TML-3462. No column-level control policy was built: under ADR 267 a column takes its table's policy, so that part of the 2026-09-30 notes stays with row 6. Follow-ups: TML-3570 to TML-3574, TML-3280; TML-3569 was checked and cancelled. Prisma 8 syntax for unmapped storage is row 11.

**Row 4, upgrade guide rewrite.** TML-3540, backlog. The guide already drops the baseline commands (prisma/web#8291, merged 2026-09-17). It still tells `prisma7Schema` users to switch to a printed contract file before Prisma 8 takes over migrations, which prisma/orm#30601 showed is unnecessary.

**Row 5, codecs.** TML-3270, backlog.

**Row 6, columns whose type has no codec.** Proposed 2026-09-30 as an `unknown` type. The column-level `@control(external)` proposed that day was not built in row 3, where a column takes its table's control policy, so it stays here. Also here is a column the contract cannot type, because every storage column carries a storage type id. Not designed.

**Row 7, enum membership check on adoption.** Not designed. Rejected: marking the contract as not managed during side-by-side running (see [decisions.md](decisions.md)).

**Rows 8 to 10.** Medium and low upgrade issues: the same two Linear projects. `money` codec: part of TML-3270. Views: TML-3269.

**Row 11, Prisma 8 syntax for unmapped storage.** TML-3469, backlog. Until it exists, `contract print` refuses a Prisma 7 schema with `@ignore` fields or `@@ignore` models, because Prisma 8 has no syntax yet for a column no field maps or a table with no model. Such a project keeps its Prisma 7 schema as the contract source. Will placed it after GA on 2026-10-13.

## Stream 3: Editor and tools

**Row 1, emulator controls in the CLI.** Not tracked. Raised to the top of the stream by Will on 2026-09-30. Will takes it (2026-10-05). No PR found in prisma/orm, prisma/composer or prisma/prisma-cli.

**Row 2, VS Code extension.** Language server, all merged: hover (prisma/orm#30569), hover on arguments (prisma/orm#30591), go to definition (prisma/orm#30578), find references (prisma/orm#30621), multi-file schemas (prisma/orm#30456), and resolution on the new binder (prisma/orm#30545, prisma/orm#30563). Rename symbol merged 2026-10-08 (prisma/orm#30633), closed out in prisma/orm#30724. Mixin support merged 2026-10-14 with stream 1 row 5. Open: file watching without client notifications (prisma/orm#30535; its ADR number clashes with ADR 256 on main since prisma/orm#30619). The formatter without the CLI was not checked.

**Row 3, extension and Prisma Postgres instances.** Not started.

**Row 4, multi-file PSL.** Last part merged 2026-09-30 (prisma/orm#30456).

## Stream 4: Query features

**Row 1, transaction options.** Split from nested transactions on 2026-10-05. A draft adds an isolation level option (prisma/orm#30333, draft since 2026-09-17).

**Row 1b, nested transactions.** Its own project since 2026-10-05.

**Row 2, nested writes on relations.** TML-2781. Project `projects/nested-mutations/`. Slice 1 in review: `updateAll` and `deleteAll` on a filtered set of related rows, and several operations from one relation callback (prisma/orm#30634, with engine tests in prisma/orm#30642). `upsert`, `set` and `connectOrCreate` not started. Every write method now runs through one mutation graph, the first step of replacing the nested-write executor: `update` and `delete` (prisma/orm#30680, merged 2026-10-14), then `create`, `createAll`, `createAndCount` and `upsert` (prisma/orm#30726, merged 2026-10-15).

**Row 3, replacement for `omit`.** Design done (Will, 2026-10-07).

**Row 4, expressions in updates.** `update` takes plain values only today.

**Row 5, a query that fails when nothing matches.** Collections gained `firstOrThrow`, which reads one row with `LIMIT 1` and rejects when nothing matches, in the SQL and Mongo ORMs (prisma/orm#30644, merged 2026-10-08). Serhii's `whereUnique()` followed as its own project (`projects/where-unique/`): slice 1 of 4 merged 2026-10-12 (prisma/orm#30670), making many-record calls compile errors after it. Related: prisma/orm#30362 (TML-3093) makes single-row `update()` and `delete()` require a unique `where()`, open since 2026-09-21.

**Row 6, JSON and list filters.** prisma/orm#29834, stalled since 2026-07-28.

**Unranked: row locking on a select.** Linear project "Row locking clauses on a select". The typed SQL builder merged 2026-10-06 (TML-3402, prisma/orm#30549). The ADR (ADR 261, prisma/orm#30542) and the ORM client (TML-3415, prisma/orm#30555) merged on 2026-10-07, and the project was closed out in prisma/orm#30643.

**Unranked: collection classes and scopes.** A collection keeps its class through the chain, merged 2026-10-06 (TML-3403, prisma/orm#30560, ADR 265), with its design and the query-fragments ADR 259 (prisma/orm#30543). Scopes merged 2026-10-07 (TML-3436, prisma/orm#30564). On 2026-10-08 a reusable piece of a query became a query fragment, and a scope is a fragment that only filters (TML-3512, prisma/orm#30647; TML-3519, prisma/orm#30652). Merged 2026-10-09: row locks keep the collection's class (TML-3543, prisma/orm#30673). Merged 2026-10-12: `where` and `orderBy` callbacks get the query builder's functions and the model's indexes, so a query searches a weighted full-text index by name (TML-3544, prisma/orm#30676). Approved, not merged: packages contribute collection methods computed from a model (TML-3549, prisma/orm#30717, rebuilt under ADR 272; it replaced prisma/orm#30693, closed). The design for queries using the query builder's functions and indexes is ADR 270 (prisma/orm#30428, open).

**Unranked: `variant()`.** Merged 2026-10-06 (prisma/orm#30577).

**Unranked: the Postgres driver returns text.** Merged 2026-10-06 (TML-3443, prisma/orm#30597).

**Unranked: cache middleware.** Invalidation and pluggable keys merged (TML-3398, prisma/orm#30530), the design record merged as ADR 266 (prisma/orm#30600), and every query has an `afterTransaction` stage, merged 2026-10-06 (TML-3399, prisma/orm#30614, ADR 260). Invalidation after commit is TML-3400, now a slice of the activity-tree project.

**Unranked: middleware sees a tree of activities.** Linear project "Runtime middleware sees a tree of activities". The design merged as ADR 271 on 2026-10-12 (prisma/orm#30653). Merged 2026-10-13: the plan (prisma/orm#30692) and slice 1, statements and transactions as activities (TML-3559, prisma/orm#30703). In review: slice 2, clients start their own activities (TML-3560, prisma/orm#30706). Backlog: TML-3561 (each ORM call is an activity, and the cache caches whole calls), TML-3400 (the cache invalidates after a write is finalized).

## Stream 5: Docs and the new user's first hour

**Row 1, stop naming `prisma-composer`.** TML-3340. Done in prisma/composer#331 (merged 2026-10-05), which removes every mention and adds a lint against it. The public docs fix prisma/web#8387 merged on 2026-10-08, and TML-3340 was closed out in prisma/orm#30654.

**Row 2, correct the skill's query reference.** Not tracked as one task. Related tickets: TML-3440 (the skill tells users to import `@internal/*` packages), TML-3346 (back-references), TML-3365 (an undeclared alias in an example). Open PRs: prisma/orm#30483 (back-references, no review), prisma/orm#30495 (TML-3364, data transforms, approved).

**Row 3, docs gaps found by the eval.** Listed in [eval-friction-2026-09-28.md](eval-friction-2026-09-28.md). Not re-checked item by item. Related: prisma/web#8389 (prerequisites up front, one skill-install command), merged 2026-10-06.

**Row 4, ORM scenario for the eval.** Will's decision.

**Row 5, docs restructure.** prisma/web#8243, draft, last updated 2026-09-30.

**Row 6, cursor pagination note.** For the upgrade guide and "Coming from Prisma ORM 7". Not tracked.

**Row 7, records that contradict the code.** Listed in [query-feature-gaps.md](query-feature-gaps.md).

## Beside the streams

**Manifesto.** prisma/prisma-orm-messaging#17, open, last updated 2026-10-01.

**One lowering for PSL and the TypeScript contract builder.** WhyAsh (prisma-idb) spiked translating PSL into `defineContract` input so both authoring surfaces share one implementation. Serhii takes over the topic with WhyAsh (Will, 2026-10-05). Spike: [prisma-idb plan](https://github.com/prisma-idb/prisma-idb/blob/ad0914f94ba2321e79904a4d3e34305867533659/packages/prisma-orm/plans/PLAN_SPIKE_psl_via_ts_dsl.md), [Discord thread](https://discord.com/channels/937751382725886062/1501983204381298732/1555550194664214608).
