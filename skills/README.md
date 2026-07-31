# Prisma Next skills

Agent skills for [Prisma Next](https://github.com/prisma/prisma-next) — a small set of `SKILL.md` files that teach an LLM agent how to operate Prisma Next end-to-end without re-deriving the API from documentation each time.

> **Edit your data contract. Prisma handles the rest.**
>
> **Install the version that matches your Prisma Next version.** Skills ship in lockstep with the Prisma Next CLI/runtime. If your project uses Prisma Next `0.8.0`, install from `prisma/prisma-next#v0.8.0` so the skill surface matches the runtime surface.

## What's in the box

One package, eleven skills. Each skill is a `SKILL.md` with its own `description` field that an agent runtime matches against the user's prompt:

| Skill | Scope |
|---|---|
| `prisma-next` | Router — catches vague prompts and routes to a specific skill. |
| `prisma-next-quickstart` | Adoption: greenfield projects and brownfield databases. |
| `prisma-next-contract` | Contract authoring — PSL, TS builder, no-emit. |
| `prisma-next-migrations` | Migration authoring — `db update`, `migration plan`, data transforms. |
| `prisma-next-migration-review` | Deployment + concurrency — "what runs on merge?", diamond convergence. |
| `prisma-next-queries` | Queries — SQL DSL, Raw SQL, ORM client, TypedSQL. |
| `prisma-next-supabase` | Supabase — the extension pack, RLS policy authoring, role-bound runtime (`asUser` / `asAnon` / `asServiceRole`), `auth.*` admin reads. |
| `prisma-next-runtime` | Wiring `db.ts` — middleware, connection, environment. |
| `prisma-next-build` | Build-system / dev-server integration — Vite plugin today, Next.js / Webpack / esbuild / Rollup are gaps named instead of fabricated. |
| `prisma-next-debug` | Debugging — error envelopes, signal-routing to error-code references. |
| `prisma-next-feedback` | Hand a question or report off to the team — file a GitHub issue (bug or feature request), or route Q&A / design feedback / direct-team-contact (extension authors included) to the Prisma Discord. The canonical destination of every other skill's *What PN doesn't do yet* routing. |

Every skill follows the same shape: preamble + canonical mental-model headline, *When to Use* / *When Not to Use*, *Key Concepts*, *Workflow*, *Common Pitfalls*, **What Prisma Next doesn't do yet**, *Reference Files*, and *Checklist*.

## Install

The skill is normally installed for you by `prisma-next init`, which operates in the current working directory:

```bash
mkdir my-app && cd my-app
pnpm dlx prisma-next init
```

To install standalone (existing project or a new agent runtime added after `init`):

```bash
# `--all` installs every skill in the cluster (the cluster works as a unit —
# the router skill routes between the others) for every agent runtime the CLI
# detects on this machine, without prompting per-skill or per-agent.
pnpm dlx skills add prisma/prisma-next#v<your-prisma-next-version> --all
```

The skill is always installed at the **project level** — there is no host-wide / global install path. The cluster's surface (commands it references, exit codes it expects, capability claims it makes) tracks the project's `@internal/*` version, and a global install would have to pick a single version for every project on the host. Pinning per-project keeps the skill, CLI, runtime, and extension packs coherent on every project the user works in.

If you have multiple agent runtimes installed and want the skill cluster active in only one of them, swap `--all` for `--skill '*' -a <agent>` (e.g. `-a claude-code`, `-a cursor`, `-a codex`). The `skills` CLI's `--help` lists the supported agent ids.

## Capability-gap honesty

Prisma Next is in early access (`0.x`). Each skill carries a *What Prisma Next doesn't do yet* section that names features the framework doesn't implement (model validations, lifecycle callbacks, Studio, runtime-apply migrations, `EXPLAIN`, prepared statements, `db.batch()`, multi-database routing, Next.js plugin, …) along with the workaround and a route to the `prisma-next-feedback` skill so the request becomes a tracked issue instead of a one-line URL.

The pattern is deliberate: it gives the agent something concrete to say when a user asks about an unbuilt feature, instead of confabulating a plausible-looking API call against something that doesn't exist.

## Versioning

The skills source is versioned with the rest of Prisma Next. Keep the git ref aligned with your Prisma Next version (see the call-out at the top of this README).

## Contributing / authoring a skill

Authoring rules, cluster conventions, and the worked example for *concepts-over-procedures* live in [`DEVELOPING.md`](./DEVELOPING.md). Read that before adding or rewriting a `SKILL.md`. Skill sources live in this `skills/` directory in the `prisma-next` monorepo.

## License

Apache-2.0.
