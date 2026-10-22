# Project intent

Prisma 8 is a TypeScript rewrite of Prisma ORM, designed to be extensible, composable and friendly to AI agents ([README](../../../README.md)). Its centre is the data contract: one `contract.json`, with a matching `contract.d.ts`, that describes what exists in the database and what is allowed. Queries compile into plans that are checked against the contract before they touch data ([Architecture Overview](../../Architecture%20Overview.md#guiding-principles)).

Read this file before making product-level decisions. The [vision](./vision.md) says where Prisma 8 is going and how to judge a request against it. The [ADR index](../../architecture%20docs/ADR-INDEX.md#steering-list) opens with the steering list: requests the maintainers have already answered, with what to use instead.

## What this project is

- **A framework in which every part is an extension.** The [Prisma ORM Manifesto 2026](https://www.prisma.io/blog/prisma-orm-manifesto-2026#1-prisma-orm-is-an-open-framework-and-an-open-ecosystem) says "every part of Prisma ORM 8 is itself an extension", built with the same tools anyone can use. Postgres support is built on the same public interface any extension author can use ([README, For extension authors](../../../README.md#for-extension-authors)).
- **A small core that the core team maintains.** The manifesto: "We maintain the framework core" ([principle 5](https://www.prisma.io/blog/prisma-orm-manifesto-2026#5-we-are-stewards-not-gatekeepers)). New behaviour comes from adapters, extension packs and middleware, not from patching the core or adding global flags ([ADR 005](../../architecture%20docs/adrs/ADR%20005%20-%20Thin%20Core%20Fat%20Targets.md), [Architecture Overview](../../Architecture%20Overview.md#compose-dont-configure)).

## Who it is for

- **TypeScript developers starting a new project on PostgreSQL or MongoDB.** The README says new projects should start on Prisma 8 ([README](../../../README.md)). PostgreSQL is the primary target. MongoDB is a first-class database ([prisma/orm#25843](https://github.com/prisma/orm/issues/25843)), and its Prisma 8 implementation is in Early Access (Will Madden, 2026-10-22).
- **Software agents, and the people working alongside them.** "Prisma 8 is an ORM designed for software agents." Agents need deterministic surfaces, machine-readable structure and tight feedback loops ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm)). The packages ship skills that agents load to do the work ([skills/README.md](../../../skills/README.md)).
- **Teams moving from Prisma 7, one step at a time.** Prisma 8 can read a Prisma 7 schema as its contract source while Prisma 7 still owns the database ([ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)). Prisma 7 is maintained for 18 months after Prisma 8 GA (Will Madden, 2026-10-22; [manifesto](https://www.prisma.io/blog/prisma-orm-manifesto-2026)).
- **Extension authors.** Integrating a database, a tool or a library is meant to happen through an extension ([README, For extension authors](../../../README.md#for-extension-authors), [manifesto, principle 1](https://www.prisma.io/blog/prisma-orm-manifesto-2026#1-prisma-orm-is-an-open-framework-and-an-open-ecosystem)).

Optimise for:

- **Deterministic behaviour.** Declarative artifacts define every execution path, and verification happens before data is touched ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm)).
- **Explicit over implicit.** No hidden extra round-trips, fallbacks or adapter guesses. One query lane call compiles to one statement ([ADR 003](../../architecture%20docs/adrs/ADR%20003%20-%20One%20Query%20One%20Statement.md)).
- **Feedback before execution.** Lints, budgets and offline checks explain what is wrong and how to fix it before anything runs ([Architecture Overview](../../Architecture%20Overview.md#feedback-before-execution)).
- **Tools that are safe to delegate.** Tools used by agents show planned changes, verify their results, and require approval for destructive actions ([manifesto, principle 2](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate)).
- **Small, modern, tree-shakable packages.** Packages are ESM-only and target current runtimes: Node.js 24, TypeScript 5.9, PostgreSQL 15, MongoDB 8.0 ([Supported Versions](../../Supported%20Versions.md), [ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)).

It does not need to optimise for:

- **Runtimes older than its floors, or CommonJS.** A floor starts at the latest release the project tests against and is lowered only when a concrete user need justifies it. No CommonJS entry points are published ([ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md)).
- **Reproducing Prisma 7 query behaviour.** The Prisma 7 contract source describes a database; it does not commit Prisma 8 to reproducing Prisma 7 query behaviour ([GA plan decisions, principle 4](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/decisions.md#principles)).
- **Languages other than TypeScript and JavaScript.** Prisma does not fix bugs or accept feature requests for other languages ([prisma/orm#25843, Programming Language Contexts](https://github.com/prisma/orm/issues/25843)).
- **Databases outside the first-class list.** Supported databases beyond the first-class ones "are not prioritized for new features or bug fixes" ([prisma/orm#25843, Database Contexts](https://github.com/prisma/orm/issues/25843)).

## What not to assume

- **Do not assume the core should take a feature that an extension or user code can provide.** Will Madden, 2026-10-22: "we will not build in the core features which can be built in extension/user space."
- **Do not assume a Prisma 7 feature exists in Prisma 8.** Check the [feature scoreboard](../../../scorecard.md) and the *What Prisma 8 doesn't do yet* sections of the [`prisma-8` skill references](../../../skills/prisma-8/references/).
- **Do not assume a missing feature is unwanted.** A `❌` on the scoreboard means "not in 8.0". The PR triage guide says "'Not planned' is not by itself a reason to decline" ([PR triage](../../oss/pr-triage.md#step-5--direction-fit)). An accepted ADR is what rules a feature out.
- **Do not assume an item on the [roadmap](./roadmap.md) will ship.** Topics may be added or dropped as the work goes on.
- **Do not assume the folders under `projects/` are a roadmap.** They hold work in flight, or records of finished work that were not cleaned up ([PR triage](../../oss/pr-triage.md#step-5--direction-fit)).
- **Do not assume the ORM client is the only way to query.** The ORM is an optional layer over the SQL query builder, and there is a raw SQL lane ([ADR 015](../../architecture%20docs/adrs/ADR%20015%20-%20ORM%20as%20Optional%20Extension.md), [ADR 247](../../architecture%20docs/adrs/ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md)). A request is often answered by a surface that already exists.

## Agent guidance

If you are an agent working in this repo:

- Read this file before making product-level decisions.
- Before you judge a feature request or a pull request, or propose a feature or a solution, follow [How to use this page](./vision.md#how-to-use-this-page) on the vision page.
- Open the [steering list](../../architecture%20docs/ADR-INDEX.md#steering-list) before you propose a new surface. If an ADR covers the request, cite it.
- Do not propose building into the core a feature that an extension or user code can provide.
