# Reference Migration Systems

Summaries of the **domain model and vocabulary** used by established migration systems, used as comparison anchors for Prisma Next's own vocabulary work.

Each summary follows the same shape so they can be compared side by side:

- **Mental model** — one paragraph: how the system thinks about migrations (sequential / dependency-graph / declarative; file-based / DB-tracked).
- **Vocabulary** — load-bearing nouns, verbs, events, identities the system uses in user-facing docs.
- **CLI command surface** — subcommands and the verbs they use.
- **Distinctive vocabulary choices** — terms unique to the system or unusually used.

## Selection rationale

Picked to cover the spectrum of mental models:

- **active-record.md** — Rails ActiveRecord. The classic sequential file-ordered model; the default mental model many developers carry.
- **liquibase.md** — Liquibase. Changelog + `id+author+filename` identity; XML/YAML/JSON authoring; explicitly versioned change-sets.
- **django.md** — Django migrations. Auto-detected, dependency graph between migrations.
- **sqitch.md** — Sqitch. Dependency-based, no implicit ordering, explicit deploy/verify/revert separation. The closest analog to Prisma Next's graph model.
- **atlas.md** — Atlas (Ariga). Declarative state-based migrations; modern; HCL DSL; both versioned and declarative modes.
- **prisma-current.md** — Prisma 5/6 (current). The direct predecessor; `migrate dev` / `migrate deploy` split.
