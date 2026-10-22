# Vision

This page says where Prisma 8 is going, in two layers: **values**, which do not change, and **durable themes**, the parts of the product the maintainers invest in across many releases. [Project intent](./project-intent.md) says who Prisma 8 is for and what not to assume. The [steering list](../../architecture%20docs/ADR-INDEX.md#steering-list) lists requests the maintainers have already answered, with what to use instead.

## How to use this page

Use it before you judge a feature request or a pull request, and before you propose a new feature, surface or solution. Read the [project intent](./project-intent.md) and the [steering list](../../architecture%20docs/ADR-INDEX.md#steering-list) first. If an ADR on the list covers the request, cite it.

Give the request one of four verdicts, with one sentence that says why and the anchor you relied on: the value, the durable theme or the ADR.

- **`aligned`**: the work advances a stated value or durable theme.
- **`rejected`**: it conflicts with a value or an accepted ADR, or it belongs elsewhere, such as in an extension, in user code or in another repository.
- **`unclear`**: this page does not clearly speak to it.
- **`not_applicable`**: a bug fix, or any item where a judgment about direction does not mean anything. This is the right answer for most bugs.

Be conservative. Prefer `unclear` or `not_applicable` over a confident `aligned` or `rejected` unless this page or an ADR speaks directly to the item.

The verdict is evidence for a decision, not the decision. A value or a theme alone never grounds a decline. Declining a request needs an `Accepted` ADR that covers it, or a maintainer's own earlier words on an issue or a pull request ([PR triage](../../oss/pr-triage.md#step-5--direction-fit)). An ADR with status `Proposed` never grounds a verdict.

- **Already exists.** When a feature Prisma 8 ships already covers the request, the answer is "use X", naming the feature. For example, query logging is a middleware ([ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)).
- **No record covers it.** Search earlier issues and maintainer comments for a maintainer's position before you give a verdict.
- **Precedent.** An earlier request closed as not planned is precedent only when its reasoning covers the full scope of the new request. If it covers part, it decides nothing.
- **A maintainer accepted it.** Never decline a change that a maintainer in the thread proposed or accepted, unless a later maintainer comment declines it. Give `unclear` and flag the conflict.
- **Two maintainers disagree.** Two maintainers who contradict each other in different threads are not an established position. Give `unclear` and flag the conflict.
- **Protected items.** An agent never proposes declining an item filed by a maintainer, an item with a milestone, or a security issue.
- **Nothing to use instead.** When the thing to use instead does not exist yet, say so.
- **Declining.** End the comment with three things: a workaround the person can use today, what the maintainers would accept instead, and an invitation to reopen when that changes.
- **A new no.** When you decline on a maintainer's words that no ADR records, record it as the [ADR index](../../architecture%20docs/ADR-INDEX.md#when-to-add-a-record) says.

The [PR triage guide](../../oss/pr-triage.md#step-5--direction-fit) applies the same rules to pull requests.

## Values

- **"we will not build in the core features which can be built in extension/user space."** (Will Madden, 2026-10-22.) The manifesto says "every part of Prisma ORM 8 is itself an extension".
- **"Prisma ORM is an open framework and an open ecosystem."** ([manifesto, principle 1](https://www.prisma.io/blog/prisma-orm-manifesto-2026#1-prisma-orm-is-an-open-framework-and-an-open-ecosystem))
- **"Database tools must be safe to delegate."** ([manifesto, principle 2](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate))
- **"Developer experience must be exceptional."** ([manifesto, principle 3](https://www.prisma.io/blog/prisma-orm-manifesto-2026#3-developer-experience-must-be-exceptional))
- **"Prisma ORM must fit the modern JavaScript landscape."** ([manifesto, principle 4](https://www.prisma.io/blog/prisma-orm-manifesto-2026#4-prisma-orm-must-fit-the-modern-javascript-landscape))
- **"We are stewards, not gatekeepers."** ([manifesto, principle 5](https://www.prisma.io/blog/prisma-orm-manifesto-2026#5-we-are-stewards-not-gatekeepers))

How the system is built is in the ten [guiding principles](../../Architecture%20Overview.md#guiding-principles) of the Architecture Overview.

## Durable themes

- **Databases, in order.** PostgreSQL reaches general availability, then MongoDB, SQLite and MySQL do, then we see. Everything else is expected to be built in user or extension space. Will Madden, 2026-10-22: "postgres GA. mongo GA / SQLite GA / mysql GA. then we see. everything else we expect to be built in user/extension space". PostgreSQL, MySQL, SQLite, MongoDB and MariaDB are Prisma's first-class databases, "prioritized for bug fixes, performance improvements, and feature development" ([prisma/orm#25843](https://github.com/prisma/orm/issues/25843)). MongoDB has first-class support in Prisma 8 ([README](../../../README.md#supported-databases)), and its implementation is in Early Access (Will Madden, 2026-10-22).
- **The data contract and its authoring.** One canonical `contract.json` defines what exists and what is allowed, written in PSL or with TypeScript builders ([Architecture Overview](../../Architecture%20Overview.md#contract-first), scoreboard: [PSL](../../../scorecard/03-psl-schema-language.md), [contract emission and authoring](../../../scorecard/04-contract-emission-and-authoring.md)).
- **Queries: the query builder, the ORM client and raw SQL.** The ORM is an optional layer over the SQL query builder, and raw SQL is a lane of its own ([ADR 015](../../architecture%20docs/adrs/ADR%20015%20-%20ORM%20as%20Optional%20Extension.md), [ADR 247](../../architecture%20docs/adrs/ADR%20247%20-%20Whole-query%20raw%20SQL%20is%20the%20fragment%20mechanism%20at%20statement%20position.md), scoreboard sections 05 to 14).
- **Migrations that are safe to delegate.** Every migration is a contract-to-contract edge with checks before and after, and destructive actions need approval ([Architecture Overview](../../Architecture%20Overview.md#control-plane--self-verifying-change), [manifesto, principle 2](https://www.prisma.io/blog/prisma-orm-manifesto-2026#2-database-tools-must-be-safe-to-delegate), scoreboard: [migrations](../../../scorecard/15-migrations.md), [introspection](../../../scorecard/16-introspection.md)).
- **Extensions and the extension ecosystem.** "Everything around it, including Postgres support itself, is built on the same public SPI that's available to any author." ([README, For extension authors](../../../README.md#for-extension-authors), scoreboard: [extensions](../../../scorecard/18-extensions.md))
- **Agents as first-class users.** "Prisma 8 is an ORM designed for software agents." ([Architecture Overview](../../Architecture%20Overview.md#agent-first-orm)) The packages ship skills that agents load ([skills/README.md](../../../skills/README.md)).
- **The runtime and middleware.** Behaviour around queries, such as logging, caching and tracing, is written as middleware that observes every activity ([ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md), scoreboard: [observability and lifecycle](../../../scorecard/19-observability-and-lifecycle.md)).
- **The CLI, the editor and tools.** The `prisma` CLI and the VS Code extension ([scoreboard: CLI commands](../../../scorecard/17-cli-commands.md), [GA plan, editor and tools](https://github.com/prisma/orm/blob/planning/prisma-8-ga/planning/plan.md#stream-3-editor-and-tools)).
- **The upgrade path from Prisma 7.** Prisma 7 applications move to Prisma 8 incrementally; Prisma 8 reads a Prisma 7 schema as a contract source ([ADR 252](../../architecture%20docs/adrs/ADR%20252%20-%20An%20earlier%20Prisma%20version's%20schema%20is%20a%20contract%20source.md)). Prisma 7 is maintained for 18 months after Prisma 8 GA (Will Madden, 2026-10-22; [README](../../../README.md)).
- **The modern JavaScript landscape.** "Prisma ORM 8 is written entirely in TypeScript and ships as ES modules" ([manifesto, principle 4](https://www.prisma.io/blog/prisma-orm-manifesto-2026#4-prisma-orm-must-fit-the-modern-javascript-landscape)), on current runtimes ([ADR 222](../../architecture%20docs/adrs/ADR%20222%20-%20Version%20support%20policy.md), [Supported Versions](../../Supported%20Versions.md)).
