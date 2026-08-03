---
name: prisma-next
description: Route a vague Prisma Next prompt to the right specific skill. Use for "help me with Prisma Next", "what is Prisma Next", "explain Prisma Next", "I'm new to PN", "where do I start", "what can I do with Prisma Next", "what can I do next with Prisma", "just ran createprisma", "tour of Prisma Next", "Prisma Next overview", and comparison questions like "Prisma Next vs Prisma 7", "PN vs Drizzle", "PN vs Kysely", "PN vs TypeORM". Do NOT use when the prompt clearly matches a workflow skill — adoption / quickstart / first-touch orientation / brownfield introspection, schema / contract editing, migration authoring (db update / migration plan / migrate), migration review on deploy / concurrent migrations, queries / db.orm / db.sql / TypedSQL, Supabase / RLS / role binding, runtime / db.ts / middleware wiring, build / Vite plugin / Next.js plugin, debug / structured error envelopes / PN-* error codes, or feedback / bug report / feature request — load that sibling skill directly.
---

# Prisma Next — Router

> **Edit your data contract. Prisma handles the rest.**

This skill exists to disambiguate vague Prisma Next prompts. When the user hasn't yet committed to a specific workflow (e.g. *"help me with Prisma Next"*, *"explain how Prisma Next works"*, *"I'm new to PN, where do I start?"*), this skill fires and routes them to the right specific skill.

## When to Use

- The user has not yet stated a concrete task.
- The user types a meta-question about Prisma Next (*"what is Prisma Next?"*, *"how does PN compare to Drizzle/Prisma 7?"*).
- The user asks for a tour, an overview, or a starting point.

## When Not to Use

- The user named a workflow — use the matching skill directly:
  - Setting up a new project or adopting an existing DB → `prisma-next-quickstart`.
  - Editing the schema, adding a model, changing a field → `prisma-next-contract`.
  - Authoring a migration, fixing a planner error → `prisma-next-migrations`.
  - Reviewing what's about to run on merge, handling concurrent migrations → `prisma-8-migration-review`.
  - Writing a query → `prisma-next-queries`.
  - Supabase — RLS policies, role binding (`asUser` / `asAnon` / `asServiceRole`), `auth.users` FKs, `@internal/extension-supabase` → `prisma-next-supabase`.
  - Wiring `db.ts`, middleware, environment config → `prisma-next-runtime`.
  - Build-system / dev-server plugin (Vite, Next.js, …) → `prisma-next-build`.
  - A specific error code or symptom → `prisma-next-debug`.
  - Reporting a bug or filing a feature request against Prisma Next → `prisma-next-feedback`.

## Routing rules

If the user's prompt clearly matches one of the workflow skills, route there directly without asking.

Otherwise, ask **one** disambiguating question. Pick from:

- *"Are you new to Prisma Next and asking what you can do with it, or where to start?"* (and any *"what can I do with Prisma Next?"* / *"I just ran createprisma"* variant) → `prisma-next-quickstart` (first-touch orientation path).
- *"Do you want to set up a new Prisma Next project, or wire it into an existing database?"* → `prisma-next-quickstart`.
- *"Do you want to edit your data contract (add a model / field / relation), or work with the database (migrations, queries)?"* → `prisma-next-contract` vs the others.
- *"Is this about authoring a migration, or about reviewing what's going to run on deploy?"* → `prisma-next-migrations` vs `prisma-8-migration-review`.
- *"Is this about wiring Prisma Next into your build tool (Vite / Next.js / …), or about wiring `db.ts` and middleware at runtime?"* → `prisma-next-build` vs `prisma-next-runtime`.
- *"What error or symptom are you seeing?"* → `prisma-next-debug`.
- *"Do you want to report this as a bug to the Prisma Next team, or is this a feature request?"* → `prisma-next-feedback`.

If you still can't tell which skill applies, ask the user what they want to do. Do not guess.

## The canonical model (one paragraph)

Prisma Next is a contract-first data layer. You author a **data contract** (a `contract.prisma` file, or a TypeScript builder). The framework emits machine-readable artifacts (`contract.json`, `contract.d.ts`) and gives you three runtime surfaces on SQL targets: a typed SQL query builder (`db.sql.from(...)`), a typed ORM client (`db.orm.User.select(...)`), and a raw SQL escape hatch (`db.sql.raw(...)`). On MongoDB targets only the ORM lane exists, and its keys are collection storage names (`db.orm.users`) rather than PSL model names — `prisma-next-queries` § *MongoDB ORM addressing* covers the rule. Migrations are planned from the contract diff; you review them, optionally edit the `migration.ts` for data transforms, and apply.

Three steps the user does:

1. **Edit your data contract.** (`prisma-next-contract`)
2. **The system plans the migrations for you.** (`prisma-next-migrations`)
3. **If you need data migrations, you edit `migration.ts` and execute it.** (`prisma-next-migrations`)

Everything else — queries, runtime wiring, build integration, debugging, feedback — sits on top of those three.

## Checklist

- [ ] If the prompt matches a specific workflow skill, route there without asking.
- [ ] If the prompt is vague, ask one disambiguating question.
- [ ] Do not attempt to answer the user's question from this skill — load the right specific skill first.
- [ ] If the user describes a missing feature or a misbehaviour they want fixed, route to `prisma-next-feedback`.
