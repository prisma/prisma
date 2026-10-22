# Direction

- As of: 2026-10-22, set by Will Madden.
- Stale after: 90 days. After that, treat the current focus as unknown and ask a maintainer to re-date it. The principles and long-lived themes do not go stale.

This page says where Prisma 8 is going. Use it to judge whether a feature request, a pull request or a solution you are about to propose fits the project. It has three layers, from the most durable to the most changeable:

1. **Principles.** How the system is designed. These change rarely, and only through an ADR.
2. **Long-lived themes.** Commitments that hold across many releases: which databases come next, which runtimes are supported, how long Prisma 7 is maintained.
3. **Current focus.** What the maintainers are working on now. This layer goes stale fastest, so it carries the date above.

Two other pages complete the picture. [Project intent](./project-intent.md) says who Prisma 8 is for and what it deliberately does not do. The [decision records](../90-decisions/README.md) list requests the maintainers have already answered, with what to use instead.

A line or section marked `Draft — unconfirmed` was written by an agent from the document it cites, and no maintainer has accepted it yet. It does not count as direction. A maintainer confirms it by deleting the marker, and rejects it by deleting the line.

Work in flight, such as project folders, plans, spikes and open pull requests, is not direction. Do not read it as a roadmap.

## How to use this page

Use it before you judge a feature request or a pull request, and before you propose a new feature, surface or solution. Read the [project intent](./project-intent.md) and the [decision records](../90-decisions/README.md) as well. The most important rule: the core does not take a feature that can be built as an extension or in user space.

Give one of three verdicts and cite the line or record you relied on:

- **Fits.** A confirmed line on this page or in the project intent names the capability or the need it serves, and no decision record or confirmed "does not do" line rules it out.
- **Does not fit.** A decision record with status `not-yet` or `never` covers it, or a confirmed line under "What it deliberately does not do" in the [project intent](./project-intent.md#what-it-deliberately-does-not-do) excludes it. Nothing else gives this verdict.
- **Unclear.** Anything else, including a request that only seems to conflict with a principle. Say so, and leave the decision to a maintainer.

A `Draft — unconfirmed` line and a `proposed` record never ground a verdict either way. Work in flight is not direction either. The [PR triage guide](../../oss/pr-triage.md#step-5--direction-fit) applies the same rules to pull requests. The `product-direction` skill in [prisma/ignite](https://github.com/prisma/ignite) describes how to keep this record and run this check.

## Principles

Draft — unconfirmed (from the Architecture Overview)

The guiding principles are written in the [Architecture Overview](../../Architecture%20Overview.md#guiding-principles). In short:

- **Contract-first.** One canonical `contract.json` defines what exists and what is allowed. It carries no executable logic.
- **Plans are the product.** Intent compiles into immutable, hashable plans. A query lane call lowers to one statement.
- **Thin core, fat targets.** The core stays small. Adapters and extension packs carry database-specific behaviour.
- **The framework provides affordances; targets implement specifics.** The framework never branches on which database it is talking to.
- **Domain-first surfaces.** APIs speak in models, fields and relations. Storage details are available but secondary.
- **Explicit over implicit.** No hidden round-trips, fallbacks or guesses.
- **Compose, don't configure.** Behaviour comes from packages and middleware, not global flags.
- **Modular, composable packages.** ESM, tree-shakable, side-effect free.
- **Feedback before execution.** Problems are reported, with a fix, before anything runs.

## Long-lived themes

### Agents are first-class users

Draft — unconfirmed (from the Architecture Overview and skills/README.md)

Prisma 8 is designed for software agents and the people working with them. Surfaces are deterministic and machine-readable, and errors say what to do next. The packages ship skills that agents load ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm), [skills/README.md](../../../skills/README.md)).

### Databases, in order

- **MongoDB is a first-class database, and Prisma 8's MongoDB implementation is in Early Access.** These are two different statements. "First-class" is Prisma's commitment about the database's place: [Priorities & Operating Contexts (prisma/orm#25843)](https://github.com/prisma/orm/issues/25843) names MongoDB among the first-class databases, which "are prioritized for bug fixes, performance improvements, and feature development". "Early Access" is the status of the implementation: Prisma 8's MongoDB support exists today and is not finished (Will Madden, 2026-10-22). The [current focus](#current-focus) lets it reach general availability after PostgreSQL.
- **PostgreSQL** is the primary target. Draft — unconfirmed (from the README)
- **SQLite** is planned next. It is a proof of concept today. Draft — unconfirmed (from the README)
- **MySQL** follows after SQLite. Draft — unconfirmed (from the README)

Source for the unconfirmed lines: [README, Supported databases](../../../README.md#supported-databases). The [feature scoreboard](../../../scorecard.md) shows what each database supports today. Any author can add a database as an extension on the public interface.

### Extensions first, thin core

- **The core does not take a feature that can be built as an extension or in user space.** Will Madden: "we will not build in the core features which can be built in extension/user space." This is the first line of [what Prisma 8 deliberately does not do](./project-intent.md#what-it-deliberately-does-not-do), and rests on the [Prisma ORM Manifesto 2026](https://www.prisma.io/blog/prisma-orm-manifesto-2026).
- New databases, tools and libraries integrate through extensions built on the same public interface that Postgres support uses. A feature that only one database, tool or library needs belongs in a target or an extension, not the core ([README, For extension authors](../../../README.md#for-extension-authors), [ADR 005](../../architecture%20docs/adrs/ADR%20005%20-%20Thin%20Core%20Fat%20Targets.md)). Draft — unconfirmed (from the README and ADR 005)

### No generated client

Draft — unconfirmed (from ADR 007)

The emitter writes `contract.json` and `contract.d.ts` and nothing else. Queries are built at runtime from the contract ([ADR 007](../../architecture%20docs/adrs/ADR%20007%20-%20Types%20Only%20Emission.md)).

### ESM-only, on current runtimes

Draft — unconfirmed (from Supported Versions and ADR 222)

Prisma 8 publishes only ES modules. The floors are Node.js 24, TypeScript 5.9, PostgreSQL 15 and MongoDB 8.0. Bun 1.2 and Deno 2.0 are supported on a best-effort basis. Floors start at the latest release the project tests and are lowered only for a concrete user need ([Supported Versions](../../Supported%20Versions.md), [ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)).

### Prisma 7 is maintained for eighteen months

Draft — unconfirmed (from the README, SECURITY.md, the PR triage guide and ADR 252)

Prisma 7 receives bug fixes and security updates for eighteen months after `8.0.0` final, on the [`v7` branch](https://github.com/prisma/orm/tree/v7). New features do not land on Prisma 7 ([README](../../../README.md), [SECURITY.md](../../../SECURITY.md), [PR triage](../../oss/pr-triage.md#step-2--is-it-in-scope-for-that-line)). Prisma 7 applications move to Prisma 8 incrementally; Prisma 8 reads a Prisma 7 schema as a contract source while Prisma 7 still owns the database ([ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)).

### Gaps are named, not hidden

Draft — unconfirmed (from the scoreboard and skills/README.md)

Every notable feature Prisma 8 lacks is listed on the [feature scoreboard](../../../scorecard.md), and each skill reference has a *What Prisma 8 doesn't do yet* section with a workaround ([skills/README.md](../../../skills/README.md)). The [decision records](../90-decisions/README.md) say which gaps are deliberate.

## Current focus

Set by Will Madden, as of 2026-10-22: "reaching GA for the postgres implementation, and while the ORM is in RC status, validating all user and extension-author-facing APIs since we won't be able to change them after GA."

- **General availability for PostgreSQL.** Prisma 8 reaches GA with its PostgreSQL implementation ready.
- **Settle every public API while the ORM is a release candidate.** Every API that users or extension authors call is checked and, where needed, changed now, because it cannot change after GA. Breaking changes come first for this reason.
- **The other databases follow.** SQLite, MongoDB and MySQL/MariaDB can reach general availability after PostgreSQL. Until each is ready, it is labelled release candidate or Early Access.

The current plans are on the [`planning/prisma-8-ga` branch](https://github.com/prisma/orm/tree/planning/prisma-8-ga/planning). They group the GA work in five streams: foundations and breaking changes, the upgrade path from Prisma 7, editor and tools, query features, and docs for a new user's first hour. The plan's individual rows are work in flight, not direction.
