# Project intent

Read this page before you propose a feature, judge a feature request, or decide what a change to Prisma 8 should optimise for. It says who Prisma 8 is for and what it is trying to be. The [direction](./direction.md) page builds on it, and the [decision records](../90-decisions/README.md) list the requests the maintainers have already answered.

A line or section marked `Draft — unconfirmed` was written by an agent from the document it cites, and no maintainer has accepted it yet. It does not count as direction. A maintainer confirms it by deleting the marker, and rejects it by deleting the line.

## What it deliberately does not do

- **Prisma 8 does not build into the core a feature that can be built as an extension or in user space.** In the words of Will Madden, the maintainer who wrote the [Prisma ORM Manifesto 2026](https://www.prisma.io/blog/prisma-orm-manifesto-2026): "we will not build in the core features which can be built in extension/user space." The manifesto says every part of Prisma ORM 8 is itself an extension, built with the same tools anyone can use, and that the core team maintains the framework core so it never becomes the bottleneck ([manifesto, principles 1 and 5](https://www.prisma.io/blog/prisma-orm-manifesto-2026#1-prisma-orm-is-an-open-framework-and-an-open-ecosystem)). Use instead: an extension package, middleware, a query fragment or collection method, or application code.
- **Convenience that hides work.** Automatic batching and transparent data loaders were considered and rejected because they make performance unpredictable and break the checks ([ADR 003](../../architecture%20docs/adrs/ADR%20003%20-%20One%20Query%20One%20Statement.md)). Draft — unconfirmed (from ADR 003)
- **Generated client code.** The emitter writes only `contract.json` and `contract.d.ts`; it never ships generated JavaScript ([ADR 007](../../architecture%20docs/adrs/ADR%20007%20-%20Types%20Only%20Emission.md)). Draft — unconfirmed (from ADR 007)
- **Configuration switches.** Behaviour comes from composing packages, not from "global flags or magic modes" ([Architecture Overview](../../Architecture%20Overview.md#compose-dont-configure)). Draft — unconfirmed (from the Architecture Overview)
- **Old runtimes.** Version floors start at the latest release the project tests against and are lowered only when a concrete user need justifies it. CommonJS is not supported ([ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)). Draft — unconfirmed (from ADR 222)
- **Prisma 7's client API.** Prisma 8 has its own API. The [feature scoreboard](../../../scorecard.md) lists every notable Prisma 7 feature Prisma 8 lacks, so absences are named rather than hidden. Draft — unconfirmed (from the README and the scoreboard)

## What Prisma 8 is

Draft — unconfirmed (from the README and the Architecture Overview)

Prisma 8 is a TypeScript rewrite of Prisma ORM. It is designed to be extensible, composable and friendly to AI agents ([README](../../../README.md)). Its centre is the data contract: one `contract.json`, with a matching `contract.d.ts`, that describes what exists in the database and what is allowed. Queries compile into plans that are checked against the contract before they touch data ([Architecture Overview](../../Architecture%20Overview.md#guiding-principles)).

## Who it is for

Draft — unconfirmed (from the README, the Architecture Overview, skills/README.md and ADR 252)

- **TypeScript developers starting a new project on PostgreSQL or MongoDB.** The README says new projects should start on Prisma 8 ([README](../../../README.md)). PostgreSQL is the primary target. MongoDB is a first-class database, and its Prisma 8 implementation is in Early Access (see [Databases, in order](./direction.md#databases-in-order)).
- **Software agents, and the people working alongside them.** "Prisma 8 is an ORM designed for software agents." Agents need deterministic surfaces, machine-readable structure and tight feedback loops ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm)). The packages ship skills that agents load to do the work ([skills/README.md](../../../skills/README.md)).
- **Teams moving from Prisma 7, one step at a time.** Prisma 7 applications migrate incrementally, and Prisma 8 can read a Prisma 7 schema as its contract source while Prisma 7 still owns the database ([README](../../../README.md), [ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)).
- **Extension authors.** Postgres support itself is built on the same public interface any author can use. Integrating a database, a tool or a library is meant to happen through an extension ([README, For extension authors](../../../README.md#for-extension-authors)).

## What it optimises for

Draft — unconfirmed (from the Architecture Overview and the ADRs cited on each line)

- **Deterministic behaviour.** Declarative artifacts define every execution path, and verification happens before data is touched ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm)).
- **Explicit over implicit.** No hidden extra round-trips, fallbacks or adapter guesses. One query lane call compiles to one statement ([ADR 003](../../architecture%20docs/adrs/ADR%20003%20-%20One%20Query%20One%20Statement.md)).
- **Feedback before execution.** Lints, budgets and offline checks explain what is wrong and how to fix it before anything runs ([Architecture Overview](../../Architecture%20Overview.md#feedback-before-execution)).
- **A small core with behaviour in targets and extensions.** New behaviour comes from adapters, extension packs and middleware, not from patching the core or adding global flags ([ADR 005](../../architecture%20docs/adrs/ADR%20005%20-%20Thin%20Core%20Fat%20Targets.md), [Architecture Overview](../../Architecture%20Overview.md#compose-dont-configure)).
- **Small, modern, tree-shakable packages.** Packages are ESM-only and target current runtimes: Node.js 24, TypeScript 5.9, PostgreSQL 15, MongoDB 8.0 ([Supported Versions](../../Supported%20Versions.md), [ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)).

## What not to assume

Draft — unconfirmed (from the scoreboard, the skill references, the PR triage guide and the ADRs cited on each line)

- **Do not assume a Prisma 7 feature exists in Prisma 8.** Check the [feature scoreboard](../../../scorecard.md) and the *What Prisma 8 doesn't do yet* sections of the [`prisma-8` skill references](../../../skills/prisma-8/references/).
- **Do not assume a missing feature is unwanted.** A `❌` on the scoreboard means "not in 8.0". Many of those are gaps the skill invites users to request. The PR triage guide says "'Not planned' is not by itself a reason to decline" ([PR triage](../../oss/pr-triage.md#step-5--direction-fit)). The [decision records](../90-decisions/README.md) say which absences are `not-yet` and which are `never`.
- **Do not assume the folders under `projects/` are a roadmap.** They hold work in flight, or records of finished work that were not cleaned up. Use the [direction](./direction.md) page and the decision records instead.
- **Do not assume the ORM client is the only way to query.** The ORM is an optional layer over the SQL query builder, and there is a raw SQL lane ([ADR 015](../../architecture%20docs/adrs/ADR%20015%20-%20ORM%20as%20Optional%20Extension.md), [ADR 247](../../architecture%20docs/adrs/ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md)). A request is often answered by a surface that already exists.
