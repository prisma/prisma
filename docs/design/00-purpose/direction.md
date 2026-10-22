# Direction

This page says where Prisma 8 is going. Use it to judge whether a feature request, a pull request or a solution you are about to propose fits the project. It has three layers, from the most durable to the most changeable:

1. **Principles.** How the system is designed. These change rarely, and only through an ADR.
2. **Long-lived themes.** Commitments that hold across many releases: which databases come next, which runtimes are supported, how long Prisma 7 is maintained.
3. **Current focus.** What the maintainers are working on now. This layer goes stale fastest, so it carries a date.

Two other pages complete the picture. [Project intent](./project-intent.md) says who Prisma 8 is for and what it optimises for. The [decision records](../90-decisions/README.md) list requests the maintainers have already answered, with what to use instead.

## How to use this page

When you judge a request against this page, give one of three verdicts and cite the line you relied on:

- **Fits.** A principle or theme supports it, and no decision record rules it out.
- **Does not fit.** A decision record rules it out, or it contradicts a principle. Cite the record or the principle.
- **Unclear.** Nothing here speaks to it directly. Say so, and leave the decision to a maintainer.

A request that fits poorly is not closed on direction alone. Direction is evidence for a maintainer's decision, not the decision itself. The [PR triage guide](../../oss/pr-triage.md#step-5--direction-fit) says the same for pull requests.

## Principles

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

Prisma 8 is designed for software agents and the people working with them. Surfaces are deterministic and machine-readable, and errors say what to do next. The packages ship skills that agents load ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm), [skills/README.md](../../../skills/README.md)).

### Databases, in order

1. **PostgreSQL** is the primary target.
2. **MongoDB** is supported.
3. **SQLite** is planned next. It is a proof of concept today.
4. **MySQL** follows after SQLite.

Source: [README, Supported databases](../../../README.md#supported-databases). The [feature scoreboard](../../../scorecard.md) shows what each database supports today. Weigh a request for another database against this order. Any author can add a database as an extension on the public interface.

### Extensions first, thin core

New databases, tools and libraries integrate through extensions built on the same public interface that Postgres support uses. A feature that only one database, tool or library needs belongs in a target or an extension, not the core ([README, For extension authors](../../../README.md#for-extension-authors), [ADR 005](../../architecture%20docs/adrs/ADR%20005%20-%20Thin%20Core%20Fat%20Targets.md)).

### No generated client

The emitter writes `contract.json` and `contract.d.ts` and nothing else. Queries are built at runtime from the contract ([ADR 007](../../architecture%20docs/adrs/ADR%20007%20-%20Types%20Only%20Emission.md)).

### ESM-only, on current runtimes

Prisma 8 publishes only ES modules. The floors are Node.js 24, TypeScript 5.9, PostgreSQL 15 and MongoDB 8.0. Bun 1.2 and Deno 2.0 are supported on a best-effort basis. Floors start at the latest release the project tests and are lowered only for a concrete user need ([Supported Versions](../../Supported%20Versions.md), [ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)).

### Prisma 7 is maintained for eighteen months

Prisma 7 receives bug fixes and security updates for eighteen months after `8.0.0` final, on the [`v7` branch](https://github.com/prisma/orm/tree/v7). New features do not land on Prisma 7 ([README](../../../README.md), [SECURITY.md](../../../SECURITY.md), [PR triage](../../oss/pr-triage.md#step-2--is-it-in-scope-for-that-line)). Prisma 7 applications move to Prisma 8 incrementally; Prisma 8 reads a Prisma 7 schema as a contract source while Prisma 7 still owns the database ([ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)).

### Gaps are named, not hidden

Every notable feature Prisma 8 lacks is listed on the [feature scoreboard](../../../scorecard.md), and each skill reference has a *What Prisma 8 doesn't do yet* section with a workaround ([skills/README.md](../../../skills/README.md)). The [decision records](../90-decisions/README.md) say which gaps are deliberate.

## Current focus

> **Placeholder. A maintainer writes this section.**
>
> **As of:** _not yet written_
>
> List the two to five things the maintainers are working on now, each with a link to its tracking issue.

This section goes stale faster than the rest of the page. If the **As of** date is more than three months old, treat the section as out of date: do not cite it as evidence, and tell a maintainer it needs updating. The folders under `projects/` are not a substitute. They hold work in flight, or records of finished work, and they do not say what comes next.
