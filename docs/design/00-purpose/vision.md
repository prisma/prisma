# Vision

This page says where Prisma 8 is going. It has three layers, from the most durable to the most changeable:

1. **Values.** How Prisma 8 is designed and built. They do not change.
2. **Durable themes.** The broad parts of the product the maintainers invest in, across many releases.
3. **Current priorities.** What the maintainers are working on now, with the date they were set.

[Project intent](./project-intent.md) says who Prisma 8 is for and what not to assume. The [roadmap](./roadmap.md) lists the work planned in each area. The [steering list](../../architecture%20docs/ADR-INDEX.md#steering-list) lists requests the maintainers have already answered, with what to use instead.

## How to use this page

Use it before you judge a feature request or a pull request, and before you propose a new feature, surface or solution. Read the [project intent](./project-intent.md) and the [steering list](../../architecture%20docs/ADR-INDEX.md#steering-list) as well. The most important rule, in the words of Will Madden (2026-10-22): "we will not build in the core features which can be built in extension/user space."

Give the request one of four verdicts:

- **`aligned`**: the work advances a stated value, durable theme or current priority.
- **`rejected`**: it conflicts with a value or an accepted ADR, or it belongs elsewhere, such as in an extension, in user code or in another repository.
- **`unclear`**: this page does not clearly speak to it.
- **`not_applicable`**: a bug fix, or any item where a judgment about direction does not mean anything. This is the right answer for most bugs.

With the verdict, write one sentence that says why, and cite the anchor you relied on: the value, the durable theme, the current priority or the ADR.

- **Values and durable themes may be quoted.**
- **Current priorities are paraphrased only.** Do not quote them, do not name the plan they come from, and do not name people. Write, for example, "this fits the current priority of settling public APIs before GA".

Be conservative. Prefer `unclear` or `not_applicable` over a confident `aligned` or `rejected` unless this page speaks directly to the item.

The verdict is evidence for a decision, not the decision. A request that is `aligned` is still judged on its merits, and a request that is `rejected` is not declined on that verdict alone. Declining a request as out of scope needs an accepted ADR that covers it, or an established maintainer position: a maintainer's earlier statement on an issue or a pull request, in their own words. An ADR with status `Proposed` is not a decision.

When no ADR covers the request, search earlier issues and maintainer comments for a maintainer's position before you give a verdict. When you decline, end the comment with three things: a workaround the person can use today, what the maintainers would accept instead, and an invitation to reopen when that changes.

The [PR triage guide](../../oss/pr-triage.md#step-5--direction-fit) applies the same rules to pull requests.

## Values

These come from the [Prisma ORM Manifesto 2026](https://www.prisma.io/blog/prisma-orm-manifesto-2026) and the [Architecture Overview's guiding principles](../../Architecture%20Overview.md#guiding-principles).

- **"We will not build in the core features which can be built in extension/user space."** (Will Madden, 2026-10-22.) The manifesto says "every part of Prisma ORM 8 is itself an extension".
- **"Prisma ORM is an open framework and an open ecosystem."** ([manifesto, principle 1](https://www.prisma.io/blog/prisma-orm-manifesto-2026#1-prisma-orm-is-an-open-framework-and-an-open-ecosystem))
- **"Database tools must be safe to delegate."** ([manifesto, principle 2](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate))
- **"Developer experience must be exceptional."** ([manifesto, principle 3](https://www.prisma.io/blog/prisma-orm-manifesto-2026#3-developer-experience-must-be-exceptional))
- **"Prisma ORM must fit the modern JavaScript landscape."** ([manifesto, principle 4](https://www.prisma.io/blog/prisma-orm-manifesto-2026#4-prisma-orm-must-fit-the-modern-javascript-landscape))
- **"We are stewards, not gatekeepers."** ([manifesto, principle 5](https://www.prisma.io/blog/prisma-orm-manifesto-2026#5-we-are-stewards-not-gatekeepers))

The guiding principles say how the system is built. Each has a section in the [Architecture Overview](../../Architecture%20Overview.md#guiding-principles):

- **Contract-first.** "The contract is the center of gravity."
- **Plans are the product.** "We don't execute intent directly; we compile it into immutable Plans."
- **Thin core, fat targets.** "Keep the core small and stable".
- **The framework provides affordances; targets implement specifics.** The framework never branches on which database it is talking to.
- **Familiar with one target, fluent in another.** A developer fluent in one target reads any other target the same way.
- **Domain-first surfaces.** "User-facing APIs speak in application-domain terms".
- **Explicit over implicit.** "No hidden multi round-trips, fallbacks, or adapter heuristics."
- **Compose, don't configure.** Behaviour comes from packages and plugins, "not global flags or magic modes".
- **Modular, composable packages.** "only imported components end up in the bundle".
- **Feedback before execution.** "Fast, targeted feedback at authoring, planning, and execution time."

## Durable themes

Each theme is a broad part of Prisma 8. The [feature areas](./feature-areas.md) page splits the code into areas, and the [roadmap](./roadmap.md) lists the work in each.

- **The data contract and its authoring.** One canonical `contract.json` defines what exists and what is allowed, written in PSL or with TypeScript builders ([Architecture Overview](../../Architecture%20Overview.md#contract-first), scoreboard: [PSL](../../../scorecard/03-psl-schema-language.md), [contract emission and authoring](../../../scorecard/04-contract-emission-and-authoring.md)).
- **Queries: the query builder, the ORM client and raw SQL.** The ORM is an optional layer over the SQL query builder, and raw SQL is a lane of its own ([ADR 015](../../architecture%20docs/adrs/ADR%20015%20-%20ORM%20as%20Optional%20Extension.md), [ADR 247](../../architecture%20docs/adrs/ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md), scoreboard sections 05 to 14).
- **Migrations that are safe to delegate.** Every migration is a contract-to-contract edge with checks before and after, and destructive actions need approval ([Architecture Overview](../../Architecture%20Overview.md#control-plane--self-verifying-change), [manifesto, principle 2](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate), scoreboard: [migrations](../../../scorecard/15-migrations.md), [introspection](../../../scorecard/16-introspection.md)).
- **First-class databases.** PostgreSQL, MySQL, SQLite, MongoDB and MariaDB are Prisma's first-class databases, "prioritized for bug fixes, performance improvements, and feature development" ([prisma/orm#25843](https://github.com/prisma/orm/issues/25843)). In Prisma 8, PostgreSQL is the primary target. MongoDB has first-class support ([README](../../../README.md#supported-databases)); first-class is a commitment about its place, and its implementation is in Early Access (Will Madden, 2026-10-22). SQLite is a proof of concept, and MySQL follows after SQLite ([README](../../../README.md#supported-databases)).
- **Extensions and the extension ecosystem.** "Everything around it, including Postgres support itself, is built on the same public SPI that's available to any author." ([README, For extension authors](../../../README.md#for-extension-authors), scoreboard: [extensions](../../../scorecard/18-extensions.md))
- **Agents as first-class users.** "Prisma 8 is an ORM designed for software agents." ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm)) The packages ship skills that agents load ([skills/README.md](../../../skills/README.md)).
- **The runtime and middleware.** Behaviour around queries, such as logging, caching and tracing, is written as middleware that observes every activity ([ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md), scoreboard: [observability and lifecycle](../../../scorecard/19-observability-and-lifecycle.md)).
- **The CLI, the editor and tools.** The `prisma` CLI and the VS Code extension ([scoreboard: CLI commands](../../../scorecard/17-cli-commands.md), [roadmap: editor and tools](./roadmap.md#editor-and-tools)).
- **The upgrade path from Prisma 7.** Prisma 7 applications move to Prisma 8 incrementally; Prisma 8 reads a Prisma 7 schema as a contract source ([ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)). Prisma 7 is maintained for 18 months after Prisma 8 GA (Will Madden, 2026-10-22; [README](../../../README.md)).
- **The modern JavaScript landscape.** "Prisma ORM 8 is written entirely in TypeScript and ships as ES modules" ([manifesto, principle 4](https://www.prisma.io/blog/prisma-orm-manifesto-2026#4-prisma-orm-must-fit-the-modern-javascript-landscape)), on current runtimes ([ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md), [Supported Versions](../../Supported%20Versions.md)).

## Current priorities

Set by Will Madden on 2026-10-22. Paraphrase these when you cite them.

- Reach general availability for the PostgreSQL implementation.
- While the ORM is a release candidate, check every API that users and extension authors call, and change it now if it needs changing, because these APIs cannot change after GA.

The other databases can reach general availability after PostgreSQL; until each is ready it is labelled release candidate or Early Access ([roadmap](./roadmap.md#databases)).
