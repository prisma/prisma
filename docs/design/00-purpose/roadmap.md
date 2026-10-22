# The Prisma 8 Roadmap 2026/27

This roadmap lists the work to Prisma 8 GA and the work planned after it. GA is targeted at the end of October 2026, with November as the fallback. The work is grouped in streams, worked in parallel; inside a stream the order is top to bottom.

When we execute on the roadmap, we keep learning, and our assessment of some topics changes. We may add or drop topics as we go, and we continuously tune the plan based on what we learn and what we hear from you.

The full plan, with the reasons behind each decision, is on the [`planning/prisma-8-ga` branch](https://github.com/prisma/orm/tree/planning/prisma-8-ga/planning). Statuses here are as of 2026-10-21.

Legend of annotations:

| Mark | Description |
| --- | --- |
| bullet | work not started |
| check mark | work completed |
| :runner: | on-going work |
| :muscle: | stretch goal: wanted at GA, but it can ship just after |

## Foundations and breaking changes

GA is the last chance to make breaking changes, so this stream decides the date.

- [x] Data types own column types ([ADR 254](../../architecture%20docs/adrs/ADR%20254%20-%20Data%20types%20and%20casts.md))
- [x] One CLI and one config file
- [ ] An early MySQL attempt, to find shared code that assumes PostgreSQL
- [x] SQL expression literals
- [ ] :runner: PSL mixins, then remove field presets; generated values become `@onCreate` and `@onUpdate`, and type aliases become an authoring shorthand ([ADR 275](../../architecture%20docs/adrs/ADR%20275%20-%20Client%20generators%20are%20field%20attributes,%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md))
- [x] Remove `@noCheck` and `.noCheck()`
- [ ] :runner: Migration statements: the planner refuses data loss, and the user states renames, deletes, conversions and backfills
- [x] Client surfaces: a client takes a typed contract value, and custom collections on every client and transaction ([ADR 274](../../architecture%20docs/adrs/ADR%20274%20-%20A%20client%20takes%20a%20typed%20contract%20value,%20so%20every%20other%20option%20is%20inferred.md))

## Upgrade path from Prisma 7

The test: an existing Prisma 7 database can be signed by Prisma 8.

- [ ] :runner: Close every urgent and high upgrade issue
- [ ] :runner: Prisma 8 owns migrations in a Prisma 7 project that still reads `schema.prisma`
- [x] Storage a model does not map: a table may hold columns its model does not map, and a table may have no model ([ADR 267](../../architecture%20docs/adrs/ADR%20267%20-%20A%20table%20may%20hold%20columns%20its%20model%20does%20not%20map.md))
- [ ] Rewrite the upgrade guide
- [ ] Codecs for `citext`, `bit`, `varbit`, `xml` and `oid`
- [x] Columns whose type has no codec ([ADR 273](../../architecture%20docs/adrs/ADR%20273%20-%20A%20column%20of%20a%20type%20no%20data%20type%20claims%20is%20a%20raw%20column.md))
- [ ] Adopt a Prisma 7 database without changing it: the enum membership check

## Editor and tools

- [x] Emulator controls in the `prisma` CLI: start, stop, list
- [ ] A Prisma Studio command in the `prisma` CLI
- [ ] :runner: VS Code extension: formatter without the CLI, go-to-definition, multi-file PSL, emulator controls
- [ ] Make the extension's handling of local and remote Prisma Postgres match the CLI and its emulators
- [x] Multi-file PSL
- [x] Several `types` blocks in a schema, so type aliases can sit beside the models that use them

## Query features

Everything here is additive, so nothing here can block a breaking change.

- [ ] Transaction options: isolation levels and timeouts
- [ ] Nested transactions
- [ ] :runner: Nested writes on relations: `update`, `delete`, `upsert`, `set`, `connectOrCreate`
- [x] Design the replacement for `omit`
- [ ] :muscle: Expressions in updates, which meet the need `increment` and `decrement` met in Prisma 7
- [x] A query that fails when nothing matches, which meets the need `firstOrThrow` met in Prisma 7
- [x] Middleware sees a tree of activities ([ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md))
- [x] Cache middleware ([ADR 266](../../architecture%20docs/adrs/ADR%20266%20-%20The%20cache%20middleware%20passes%20data%20to%20its%20store,%20and%20the%20store%20decides%20how%20to%20cache.md))
- [x] Row locking on a select ([ADR 261](../../architecture%20docs/adrs/ADR%20261%20-%20Row%20locks%20are%20a%20select%20clause%20named%20after%20the%20SQL,%20with%20one%20capability%20per%20strength%20or%20option.md))
- [x] Collection classes, query fragments and indexes ([ADR 265](../../architecture%20docs/adrs/ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md), [ADR 259](../../architecture%20docs/adrs/ADR%20259%20-%20Query%20fragments%20are%20functions.md), [ADR 270](../../architecture%20docs/adrs/ADR%20270%20-%20ORM%20queries%20use%20the%20query%20builder's%20functions%20and%20a%20model's%20indexes.md))
- [x] `variant()` selects by discriminator value
- [x] The Postgres driver returns every column as text

## Docs and the new user's first hour

The test: the getting-started eval passes, in few steps and with no workarounds.

- [x] Docs and the shipped skill stop naming `prisma-composer`
- [ ] :runner: Correct the query reference in the shipped skill, which promises features that do not exist
- [ ] :runner: Close the docs gaps the getting-started eval found
- [ ] An ORM scenario for the getting-started eval
- [ ] :runner: Restructure the docs
- [ ] :muscle: Document that cursor pagination starts after the cursor row
- [ ] :muscle: Update the records that contradict the code

## Work found along the way

- [ ] Shrink the generated contract files, so a pull request's line count shows the change and not the regenerated `contract.d.ts` and `contract.json`

## Databases

- PostgreSQL is ready at GA.
- SQLite, MongoDB and MySQL/MariaDB can finish after GA. Until each is ready, it is labelled release candidate or Early Access. Their work starts once the foundations stream has stopped changing what targets build on.

## After GA

- [ ] Medium and low upgrade issues
- [ ] A `money` codec
- [ ] Views
- [ ] Prisma 8 syntax for columns and tables no model maps, so `contract print` can convert a Prisma 7 schema that uses `@ignore`
- [ ] JSON filters and list filters
- [ ] Query linting
- [ ] Querying across contract spaces
- [ ] Performance work
- [ ] A migration runner service
- [ ] The BetterAuth flow
- [ ] Referential actions on MongoDB
