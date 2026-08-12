# Prisma 8 RC1

**The goal: on July 31 2026 we publish `prisma@8.0.0-rc.1` from the `prisma/prisma` repository and announce it.** Prisma Next becomes Prisma 8. Users arrive at the same GitHub repository and the same npm package they have always used, and what they find there is the new ORM.

These documents carry the full context, from the high-level goals down to concrete steps. They deliberately do not say who does what — ownership lives in [Linear](https://linear.app/prisma-company/project/prisma-8-rc1-7592265f700c).

Read them in order:

1. **[What the release is](release-definition.md)** — what "RC" means for us, what freezes on July 31, what we promise, and what we deliberately don't.
2. **[How we can tell it's correct](scoreboard.md)** — the feature-support matrix, the side-by-side proof, and the benchmarks. The matrix doubles as the public scoreboard and generates the to-do list.
3. **[The remaining feature set and work](feature-surface.md)** — what ships stable, what ships experimental, what's explicitly out, and the engineering that must land before the freeze.
4. **[The repository and package migration](repo-migration.md)** — the mechanical steps to move into prisma/prisma and onto the `prisma` npm package.
5. **[Running v7 and v8 in parallel](parallel-install.md)** — the incremental migration story we're promising users, and how it actually works.
6. **[The plan](plan.md)** — everything above as dated, ordered steps.

Decision history and rejected alternatives are in [design-notes.md](design-notes.md). The formal acceptance criteria are in [spec.md](spec.md).
