# Plan: Prisma 8 GA

**Goal:** ship Prisma 8 GA at the end of October 2026. November is the fallback.

This page lists the projects in priority order, by stream. Work the streams in parallel. Inside a stream, work from the top. The reasons behind each decision are in [decisions.md](decisions.md). The pull requests and tickets behind each status are in [evidence.md](evidence.md), one entry per row.

**GA column:** **Must** means GA does not ship without it. **Aim** means wanted at GA, but it can ship just after. **Later** means after GA. **Not decided** means Will has not placed it yet.

**Owner column:** who answers for the row. Streams 1, 2 and 5 are Will's and streams 3 and 4 are Serhii's, except where a row says otherwise (Will, 2026-10-07).

**Progress column:** one symbol, then done/total where the row has countable units. ✅ done · 🟡 code done, waiting on review or docs · 🔄 in progress · ⏳ not started · ❓ needs a decision from Will. The units are the slices, pull requests, tickets or items the Status column names; a row with no units yet has no count.

States were last checked against GitHub and Linear on 2026-10-16.

## How far from GA

Counts the projects marked Must in each stream. A project counts as done only when every part of it has merged. "Not started" includes the one project waiting on a decision. Recount on every refresh.

| Stream | Done | Bar | In progress | Not started |
| --- | --- | --- | --- | --- |
| Foundations and breaking changes | 2 of 7 (29%) | `███░░░░░░░` | 4 | 1 |
| Upgrade path from Prisma 7 | 1 of 7 (14%) | `█░░░░░░░░░` | 3 | 3 |
| Editor and tools | 1 of 4 (25%) | `██░░░░░░░░` | 2 | 1 |
| Query features | 1 of 3 (33%) | `███░░░░░░░` | 0 | 2 |
| Docs and the new user's first hour | 1 of 4 (25%) | `██░░░░░░░░` | 2 | 1 |
| **All streams** | **6 of 25 (24%)** | `██░░░░░░░░` | **11** | **8** |

## Stream 1: Foundations and breaking changes

**GA readiness:** 2 of 7 Must projects done (29%). 4 in progress, 1 not started.

GA is the last chance to make breaking changes, so this stream decides the date.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔄 3/6 | Finish ADR 254: data types own column types | Must | Will | 3 of 6 tickets merged; the new one, `contract infer` reads types from data types, merged 2026-10-15. Slice 3, a data type owns its values, is being built; its design now goes in the slice PR, not yet open | Review the slice 3 PR when it opens |
| 2 | ✅ 2/2 | One CLI and one config file | Must | Will | Done 2026-10-08 |  |
| 3 | ⏳ | Early MySQL attempt, to find shared code that assumes PostgreSQL | Must | Will | Not started, no ticket |  |
| 4 | ✅ 6/6 | SQL expression literals | Must | Will | Done 2026-10-12 |  |
| 5 | 🔄 4/5 | PSL mixins, then remove type aliases and field presets | Must | Serhii | Mixins done 2026-10-14. Removing type aliases and field presets not started |  |
| 6 | 🟡 0/1 | Remove `@noCheck` and `.noCheck()` | Must | Will | PR approved 2026-10-16, not yet queued | Queue the PR |
| 7 | 🔄 4/7 | Migration statements: the planner refuses data loss, the user states renames, deletes, conversions and backfills | Must | Will | 4 of 7 slices merged. The TypeScript MongoDB validator slice: PR 1 of 2 approved | Merge PR 1, build PR 2 of TML-3553, then the remaining Postgres and SQLite renames (TML-3537) |

## Stream 2: Upgrade path from Prisma 7

**GA readiness:** 1 of 7 Must projects done (14%). 3 in progress, 3 not started.

Test: an existing Prisma 7 database can be signed by Prisma 8.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔄 6/11 | Close every urgent and high upgrade issue | Must | Will | 6 closed, 5 open. One PR closes 3 of the 5; it is in review | Review the generated-values PR (TML-3267, TML-3268, TML-3322). Then the `contract print` issues TML-3323 and TML-3326 |
| 2 | 🔄 3/7 | Prisma 8 owns migrations in a Prisma 7 project that still reads `schema.prisma` | Must | Will | Proven. Follow-ups: 1 PR merged, 1 gap cancelled, 4 gaps open | One PR for the planner gaps: referential action changes (TML-3457, high), primary key changes (TML-3458), and Prisma 7 commands answered with their replacements (TML-3461) |
| 3 | ✅ 7/7 | Storage a model does not map: a table may hold columns its model does not map, and a table may have no model | Must | Will | Done 2026-10-13: 4 slices, ADR 267, the fix for a model with no fields, and the close-out merged |  |
| 4 | ⏳ | Upgrade guide rewrite | Must | Will | Ticket in backlog. One known error in the guide |  |
| 5 | ⏳ 0/5 | Codecs for `citext`, `bit`, `varbit`, `xml`, `oid` | Must | Will | Backlog |  |
| 6 | 🔄 0/2 | Columns whose type has no codec | Must | Will | Designed: ADR 273 merged 2026-10-15. Such a column is a raw column. Slice 1 built and reviewed, not pushed. The column-level control policy is still not designed | Open the slice 1 PR (TML-3585), then slice 2 (TML-3596) |
| 7 | ⏳ | Adopt a Prisma 7 database without changing it: the enum membership check | Must | Will | Not designed |  |
| 8 | ⏳ | Medium and low upgrade issues | Later | Will | Backlog | |
| 9 | ⏳ | `money` codec | Later | Will | Backlog | |
| 10 | ⏳ | Views | Later | Will | Backlog | |
| 11 | ⏳ | Prisma 8 syntax for columns and tables no model maps, so `contract print` can convert a Prisma 7 schema that uses `@ignore` | Later | Will | TML-3469, backlog. Needs a syntax design | |

## Stream 3: Editor and tools

**GA readiness:** 1 of 4 Must projects done (25%). 2 in progress, 1 not started.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔄 3/5 | Emulator controls in the `prisma` CLI: start, stop, list, reset | Must, urgent | Will | 3 of 5 slices merged 2026-10-15. Composer has `prisma dev --detach`, `prisma dev stop`, `prisma dev url` and `prisma emulator list`. The `prisma` CLI does not mount them yet. Reset is not in this project | Release Composer 0.31.0 (PR approved), mount the commands in `prisma`, then the docs. Decide whether reset is still needed |
| 2 | 🔄 2/4 | VS Code extension: formatter without the CLI, go-to-definition, multi-file PSL, emulator controls | Must | Serhii | Go-to-definition and multi-file PSL done. Rename merged. File watching in review. Formatter without the CLI unverified. Emulator controls wait on row 1 | Review the file-watching PR. Verify the formatter works without the CLI |
| 3 | ⏳ | Make the extension's handling of local and remote Prisma Postgres match the CLI and its emulators | Must | Serhii | Not started |  |
| 4 | ✅ 1/1 | Multi-file PSL | Must | Serhii | Done 2026-09-30 | |

## Stream 4: Query features

**GA readiness:** 1 of 3 Must projects done (33%). 0 in progress, 2 not started.

Everything here is additive, so nothing here can block a breaking change.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ⏳ | Transaction options: isolation levels and timeouts | Must | Serhii | Not designed. A stale draft exists |  |
| 1b | ⏳ | Nested transactions | Must | Serhii | Not designed |  |
| 2 | 🔄 0/5 | Nested writes on relations: `update`, `delete`, `upsert`, `set`, `connectOrCreate` | Aim | Serhii | Every top-level write runs through one mutation graph. A PR moving nested writes onto it, and removing the old executor, is in review. Slice 1 (`update` and `delete` on a filtered set) in review since 2026-10-09 | Review the slice 1 PR |
| 3 | ✅ 1/1 | Design the replacement for `omit` | Must (design only) | Will | Design done (Will, 2026-10-07) |  |
| 4 | ⏳ | Expressions in updates (what `increment` and `decrement` did in Prisma 7) | When there is time | Serhii | Not designed | |
| 5 | ✅ 1/1 | A query that fails when nothing matches (what `firstOrThrow` did in Prisma 7) | When there is time | Serhii | `firstOrThrow` on collections merged 2026-10-08 |  |
| 6 | ⏳ | JSON filters and list filters | Later | Serhii | PR stalled since July | |

In progress but not ranked here:

| Progress | Work | Owner | Status | Next |
| --- | --- | --- | --- | --- |
| ✅ 3/3 | Row locking on a select | Will | Done 2026-10-07 | |
| ✅ 4/4 | Collection classes, query fragments and indexes | Will | Done 2026-10-15. Closed out 2026-10-16 | |
| ✅ 1/1 | `variant()` selects by discriminator value | Serhii | Merged 2026-10-06 | |
| ✅ 1/1 | The Postgres driver returns every column as text | Will | Merged 2026-10-06 | |
| 🔄 3/4 | Cache middleware | Will | Invalidation, keys and the after-transaction stage merged. Invalidation after commit waits on the activity tree | |
| 🔄 3/5 | Middleware sees a tree of activities | Will | ADR 271 and slices 1 and 2 merged. Slice 3 built, not pushed. It waits on one question to Will | Answer: should the cache store a call's raw rows, keyed by the call, instead of the decoded result? |

## Stream 5: Docs and the new user's first hour

**GA readiness:** 1 of 4 Must projects done (25%). 2 in progress, 1 not started.

Test: the getting-started eval passes, in few steps and with no workarounds.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ✅ 2/2 | Docs and the shipped skill stop naming `prisma-composer` | Must, urgent | Will | Done 2026-10-08 |  |
| 2 | 🔄 0/3 | Correct the query reference in the shipped skill, which promises features that do not exist | Must, urgent | Will | 1 PR approved, 1 PR open, 3 tickets open | Merge the approved data-transforms PR, then review the back-references PR |
| 3 | 🔄 1/11 | Docs gaps found by the eval: 11 items, 5 high | Must | Will | 1 of 11 merged. The rest not re-checked | Re-check the 11 items against prisma/web |
| 4 | ❓ | ORM scenario for the eval: decide the project, then build it | Must | Will | Not decided | Decide the project |
| 5 | 🔄 | Docs restructure | Aim | Will | Draft since 2026-09-30 | |
| 6 | ⏳ | Document that cursor pagination starts after the cursor row | Aim | Will | Not tracked | |
| 7 | ⏳ | Update the records that contradict the code | Aim | Will | Not started |  |

## Databases

| Database | At GA |
| --- | --- |
| PostgreSQL | Ready |
| SQLite, MongoDB, MySQL/MariaDB | Can finish after GA. Labelled release candidate or early access until ready. They start once stream 1 has stopped changing what targets build on. |

## Beside the streams

| Progress | Item | Owner | Status | Priority |
| --- | --- | --- | --- | --- |
| 🔄 | Manifesto | Will | PR open, last updated 2026-10-01 | Publish. Was due the week of 2026-09-29 |
| 🔄 | One lowering for PSL and the TypeScript contract builder | Serhii | Serhii and WhyAsh (prisma-idb) | Not a GA item unless Will says so |
| 🔄 | Asks | Will | Ongoing | Lower, in parallel with GA |
| 🔄 | Eval harness | Will | Ongoing | Lower, in parallel with GA |
| ⏳ | Platform faults found by the eval | Will, as platform lead | Not started | Not an ORM priority unless they delay GA |

## After GA

Query linting, querying across contract spaces, performance work, migration runner service, the BetterAuth flow, referential actions on MongoDB. `@hint(was: oldName)` was listed here; migration statements replace it (stream 1, row 7).

## Never

`$extends`, the fluent relation API, `P2002`-style error codes, `Prisma.skip`, `omit` under that name, automatic batching, relation load strategy, `relationMode = "prisma"`, splitting large `IN` lists, soft delete, validation rules, lifecycle hooks, read replicas.
