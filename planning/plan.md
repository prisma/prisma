# Plan: Prisma 8 GA

**Goal:** ship Prisma 8 GA at the end of October 2026. November is the fallback.

This page lists the projects in priority order, by stream. Work the streams in parallel. Inside a stream, work from the top. The reasons behind each decision are in [decisions.md](decisions.md). The pull requests and tickets behind each status are in [evidence.md](evidence.md), one entry per row.

**GA column:** **Must** means GA does not ship without it. **Aim** means wanted at GA, but it can ship just after. **Later** means after GA. **Not decided** means Will has not placed it yet. A project that has started is Must, whatever it was placed as before (Will, 2026-10-16).

**Owner column:** who answers for the row. Streams 1, 2 and 5 are Will's and streams 3 and 4 are Serhii's, except where a row says otherwise (Will, 2026-10-07).

**Progress column:** one symbol, then done/total where the row has countable units. ✅ done · 🟡 code done, waiting on review or docs · 🔄 in progress · ⏳ not started · ❓ needs a decision from Will. The units are the slices, pull requests, tickets or items the Status column names; a row with no units yet has no count.

States were last checked against GitHub and Linear on 2026-10-21.

## How far from GA

Counts the projects marked Must in each stream. A project counts as done only when every part of it has merged. "Not started" includes the one project waiting on a decision. Recount on every refresh.

| Stream | Done | Bar | In progress | Not started |
| --- | --- | --- | --- | --- |
| Foundations and breaking changes | 5 of 8 (63%) | `██████░░░░` | 2 | 1 |
| Upgrade path from Prisma 7 | 2 of 7 (29%) | `███░░░░░░░` | 2 | 3 |
| Editor and tools | 2 of 6 (33%) | `███░░░░░░░` | 2 | 2 |
| Query features | 8 of 11 (73%) | `███████░░░` | 1 | 2 |
| Docs and the new user's first hour | 1 of 5 (20%) | `██░░░░░░░░` | 3 | 1 |
| **All streams** | **18 of 37 (49%)** | `█████░░░░░` | **10** | **9** |

## Stream 1: Foundations and breaking changes

**GA readiness:** 5 of 8 Must projects done (63%). 2 in progress, 1 not started.

GA is the last chance to make breaking changes, so this stream decides the date.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ✅ 6/6 | Finish ADR 254: data types own column types | Must | Will | Done 2026-10-20. The cast rule (TML-3389) merged last. Bugs found along the way stay in the project's backlog |  |
| 2 | ✅ 2/2 | One CLI and one config file | Must | Will | Done 2026-10-08 |  |
| 3 | ⏳ | Early MySQL attempt, to find shared code that assumes PostgreSQL | Must | Will | Not started, no ticket |  |
| 4 | ✅ 6/6 | SQL expression literals | Must | Will | Done 2026-10-12 |  |
| 5 | 🔄 3/5 | PSL mixins, then remove field presets; generated values become `@onCreate` and `@onUpdate`, and type aliases become an authoring shorthand | Must | Serhii (mixins), Will (TML-3607) | Mixins done 2026-10-14. ADR 275 merged 2026-10-19. TML-3607 has 3 slices: slice 1, `@onCreate` and `@onUpdate`, merged 2026-10-20 | Slice 2 (type aliases expand into each column), then slice 3 (presets removed) |
| 6 | ✅ 1/1 | Remove `@noCheck` and `.noCheck()` | Must | Will | Done 2026-10-16 |  |
| 7 | 🔄 5/7 | Migration statements: the planner refuses data loss, the user states renames, deletes, conversions and backfills | Must | Will | 5 of 7 slices merged. The TypeScript MongoDB validator slice merged 2026-10-20, with a MongoDB field keeping its own name in code. Left: renames and deletes of enum values, namespaces, value object fields and variants on Postgres and SQLite (TML-3537), and convert and backfill on MongoDB (TML-3538), both in backlog | Build TML-3537 |
| 8 | ✅ 4/4 | Client surfaces: a client takes a typed contract value, custom collections on every client and transaction | Must | Will | Slice 1 merged 2026-10-19; it is breaking: `postgres<Contract>({ contractJson })` became `postgres({ contract: contractFromJson<Contract>(json) })`. Slice 2, custom collections on every SQL client, merged 2026-10-20. Slice 3, a transaction offers the client's query members, merged 2026-10-20. Slice 4, a client loads without a database and renders plans as SQL, merged 2026-10-21. Done 2026-10-21 (Will); the close-out is in progress |  |
| 9 | ⏳ | Remove the `unbound` / `__unbound__` namespace alias, keeping one name | Not decided | Serhii | Serhii proposed it in a docs PR to the RC plan, not merged. Not started | |

## Stream 2: Upgrade path from Prisma 7

**GA readiness:** 2 of 7 Must projects done (29%). 2 in progress, 3 not started.

Test: an existing Prisma 7 database can be signed by Prisma 8.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔄 9/11 | Close every urgent and high upgrade issue | Must | Will | 9 closed, 2 open. The generated-values PR merged 2026-10-19 and closed 3 | The `contract print` issues TML-3323 (ADR first) and TML-3326 |
| 2 | 🔄 3/7 | Prisma 8 owns migrations in a Prisma 7 project that still reads `schema.prisma` | Must | Will | Proven. Follow-ups: 1 PR merged, 1 gap cancelled, 4 gaps open. The PR for 3 of them is in review | Review the PR for referential action changes (TML-3457, high), primary key changes (TML-3458), and Prisma 7 commands answered with their replacements (TML-3461) |
| 3 | ✅ 7/7 | Storage a model does not map: a table may hold columns its model does not map, and a table may have no model | Must | Will | Done 2026-10-13: 4 slices, ADR 267, the fix for a model with no fields, and the close-out merged |  |
| 4 | ⏳ | Upgrade guide rewrite | Must | Will | Ticket in backlog. One known error in the guide |  |
| 5 | ⏳ 0/5 | Codecs for `citext`, `bit`, `varbit`, `xml`, `oid` | Must | Will | Backlog |  |
| 6 | ✅ 3/3 | Columns whose type has no codec | Must | Will | Done 2026-10-21 (Will). ADR 273: such a column is a raw column, `Raw("...")` in a Prisma 8 schema, and a Prisma 7 `Unsupported(...)` field is read as one. The close-out is in progress |  |
| 7 | ⏳ | Adopt a Prisma 7 database without changing it: the enum membership check | Must | Will | Not designed |  |
| 8 | ⏳ | Medium and low upgrade issues | Later | Will | Backlog | |
| 9 | ⏳ | `money` codec | Later | Will | Backlog | |
| 10 | ⏳ | Views | Later | Will | Backlog | |
| 11 | ⏳ | Prisma 8 syntax for columns and tables no model maps, so `contract print` can convert a Prisma 7 schema that uses `@ignore` | Later | Will | TML-3469, backlog. Needs a syntax design | |

## Stream 3: Editor and tools

**GA readiness:** 2 of 6 Must projects done (33%). 2 in progress, 2 not started.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔄 4/5 | Emulator controls in the `prisma` CLI: start, stop, list, reset | Must, urgent | Will | 4 of 5 slices merged. `prisma` has `prisma dev --detach`, `prisma dev stop`, `prisma dev url` and `prisma emulator list` since 2026-10-19. The docs slice is left. Reset is not in this project | The docs slice: Composer's pages stop hard-coding ports. Decide whether reset is still needed |
| 1b | ⏳ | A Prisma Studio command in the `prisma` CLI | Must, urgent | Serhii | Not started, no ticket. Prisma 8's `prisma` has no Studio command; Prisma 7's `prisma studio` has no replacement |  |
| 2 | 🔄 2/4 | VS Code extension: formatter without the CLI, go-to-definition, multi-file PSL, emulator controls | Must | Serhii | Go-to-definition and multi-file PSL done. Rename merged. File watching approved, not merged; a fix to removing a file watcher merged 2026-10-20. Formatter without the CLI unverified. Emulator controls wait on row 1 | Merge the file-watching PR. Verify the formatter works without the CLI |
| 3 | ⏳ | Make the extension's handling of local and remote Prisma Postgres match the CLI and its emulators | Must | Serhii | Not started |  |
| 4 | ✅ 1/1 | Multi-file PSL | Must | Serhii | Done 2026-09-30 | |
| 5 | ✅ 1/1 | Several `types` blocks in a schema, so type aliases can sit beside the models that use them | Must | Serhii | Done 2026-10-16. It already worked; a PR added the tests and docs |  |

## Stream 4: Query features

**GA readiness:** 8 of 11 Must projects done (73%). 1 in progress, 2 not started.

Everything here is additive, so nothing here can block a breaking change.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ⏳ | Transaction options: isolation levels and timeouts | Must | Serhii | Not designed. A stale draft exists |  |
| 1b | ⏳ | Nested transactions | Must | Serhii | Not designed |  |
| 2 | 🔄 0/5 | Nested writes on relations: `update`, `delete`, `upsert`, `set`, `connectOrCreate` | Must | Serhii | Every top-level write runs through one mutation graph. A PR moving nested writes onto it, and removing the old executor, is in review. Slice 1 (`update` and `delete` on a filtered set) in review since 2026-10-09 | Review the slice 1 PR |
| 3 | ✅ 1/1 | Design the replacement for `omit` | Must (design only) | Will | Design done (Will, 2026-10-07) |  |
| 4 | ⏳ | Expressions in updates (what `increment` and `decrement` did in Prisma 7) | When there is time | Serhii | Not designed | |
| 5 | ✅ 1/1 | A query that fails when nothing matches (what `firstOrThrow` did in Prisma 7) | Must | Serhii | `firstOrThrow` on collections merged 2026-10-08 |  |
| 6 | ⏳ | JSON filters and list filters | Later | Serhii | PR stalled since July | |
| 7 | ✅ 5/5 | Middleware sees a tree of activities | Must | Will | Done 2026-10-20. Slice 4 and the close-out merged together | |
| 8 | ✅ 4/4 | Cache middleware | Must | Will | Done 2026-10-20. Invalidation after commit merged with row 7's slice 4 | |
| 9 | ✅ 3/3 | Row locking on a select | Must | Will | Done 2026-10-07 | |
| 10 | ✅ 4/4 | Collection classes, query fragments and indexes | Must | Will | Done 2026-10-15. Closed out 2026-10-16 | |
| 11 | ✅ 1/1 | `variant()` selects by discriminator value | Must | Serhii | Merged 2026-10-06 | |
| 12 | ✅ 1/1 | The Postgres driver returns every column as text | Must | Will | Merged 2026-10-06 | |


## Stream 5: Docs and the new user's first hour

**GA readiness:** 1 of 5 Must projects done (20%). 3 in progress, 1 not started.

Test: the getting-started eval passes, in few steps and with no workarounds.

| # | Progress | Project | GA | Owner | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ✅ 2/2 | Docs and the shipped skill stop naming `prisma-composer` | Must, urgent | Will | Done 2026-10-08 |  |
| 2 | 🔄 0/3 | Correct the query reference in the shipped skill, which promises features that do not exist | Must, urgent | Will | 1 PR approved, 1 PR open, 3 tickets open | Merge the approved data-transforms PR, then review the back-references PR |
| 3 | 🔄 1/11 | Docs gaps found by the eval: 11 items, 5 high | Must | Will | 1 of 11 merged. The rest not re-checked | Re-check the 11 items against prisma/web |
| 4 | ❓ | ORM scenario for the eval: decide the project, then build it | Must | Will | Not decided | Decide the project |
| 5 | 🔄 | Docs restructure | Must | Will | Draft since 2026-09-30 | |
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
| ✅ | Manifesto | Will | Published | |
| 🔄 | One lowering for PSL and the TypeScript contract builder | Serhii | Serhii and WhyAsh (prisma-idb) | Not a GA item unless Will says so |
| 🔄 | Asks | Will | Ongoing | Lower, in parallel with GA |
| 🔄 | Eval harness | Will | Ongoing | Lower, in parallel with GA |
| ⏳ | Platform faults found by the eval | Will, as platform lead | Not started | Not an ORM priority unless they delay GA |

## After GA

Query linting, querying across contract spaces, performance work, migration runner service, the BetterAuth flow, referential actions on MongoDB. `@hint(was: oldName)` was listed here; migration statements replace it (stream 1, row 7).

## Never

`$extends`, the fluent relation API, `P2002`-style error codes, `Prisma.skip`, `omit` under that name, automatic batching, relation load strategy, `relationMode = "prisma"`, splitting large `IN` lists, soft delete, validation rules, lifecycle hooks, read replicas.
