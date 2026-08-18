# Prisma Next skills

Agent skills for [Prisma Next](https://github.com/prisma/prisma) (Prisma 8) — `SKILL.md` files that teach an LLM agent how to operate Prisma Next end-to-end without re-deriving the API from documentation each time.

> **Edit your data contract. Prisma handles the rest.**
>
> **Install the version that matches your Prisma Next version.** The usage skill ships in lockstep with the Prisma Next CLI/runtime. If your project uses Prisma Next `0.8.0`, install from `prisma/prisma#v0.8.0` so the skill surface matches the runtime surface.

## What's in the box

Three skills:

| Skill | Scope | Ref policy |
|---|---|---|
| [`prisma-8`](./prisma-8/) | The consolidated usage skill. `SKILL.md` is a router: a description trigger that fires on any Prisma Next work, a routing table, and progressive disclosure into [`prisma-8/references/`](./prisma-8/references/) — adoption/quickstart, contract authoring, migration authoring, migration review on deploy, queries (with Postgres/SQLite and Mongo companions), runtime wiring, build integration, Supabase/RLS, structured-error debugging, and feedback routing. | Version-pinned (`#v<version>`) |
| [`prisma-next-upgrade`](./prisma-next-upgrade/) | Upgrade a consumer project across Prisma Next versions — per-transition `upgrades/<from>-to-<to>/` instructions and codemods. | Always tracks `main` |
| [`prisma-8-extension-upgrade`](./prisma-8-extension-upgrade/) | Same, for extension authors upgrading `@internal/*` peer pins. | Always tracks `main` |

The usage skill's reference files follow a shared shape: preamble + canonical mental-model headline, *When to Use* / *When Not to Use*, *Key Concepts*, *Workflow*, *Common Pitfalls*, **What Prisma Next doesn't do yet**, and *Checklist*.

## Install

The skills are normally installed for you by `prisma orm init`, which operates in the current working directory:

```bash
mkdir my-app && cd my-app
pnpm dlx @prisma/cli@next orm init
```

To install standalone (existing project or a new agent runtime added after `init`):

```bash
# Usage skill — pin to your Prisma Next version.
pnpm dlx skills add prisma/prisma/skills#v<your-prisma-8-version> --skill prisma-8 -y

# Upgrade skills — always latest.
pnpm dlx skills add prisma/prisma/skills --skill prisma-next-upgrade -y
pnpm dlx skills add prisma/prisma/skills --skill prisma-8-extension-upgrade -y
```

The skills are always installed at the **project level** — there is no host-wide / global install path. The usage skill's surface (commands it references, exit codes it expects, capability claims it makes) tracks the project's `@internal/*` version, and a global install would have to pick a single version for every project on the host. Pinning per-project keeps the skill, CLI, runtime, and extension packs coherent on every project the user works in.

To limit the install to one agent runtime, add `-a <agent>` (e.g. `-a claude-code`, `-a cursor`, `-a codex`). The `skills` CLI's `--help` lists the supported agent ids.

## Capability-gap honesty

Prisma Next is in early access (`0.x`). Each reference file carries a *What Prisma Next doesn't do yet* section that names features the framework doesn't implement (model validations, lifecycle callbacks, Studio, runtime-apply migrations, `EXPLAIN`, prepared statements, `db.batch()`, multi-database routing, Next.js plugin, …) along with the workaround and a route to [`prisma-next/references/feedback.md`](./prisma-next/references/feedback.md) so the request becomes a tracked issue instead of a one-line URL.

The pattern is deliberate: it gives the agent something concrete to say when a user asks about an unbuilt feature, instead of confabulating a plausible-looking API call against something that doesn't exist.

## Versioning

The skills source is versioned with the rest of Prisma Next. Keep the git ref aligned with your Prisma Next version for the usage skill (see the call-out at the top of this README). The upgrade skills are intentionally unpinned — the cumulative instruction set on `main` is the source of truth and includes fixes for every prior transition.

## Contributing / authoring

Authoring rules, reference-file conventions, and the worked example for *concepts-over-procedures* live in [`DEVELOPING.md`](./DEVELOPING.md). Read that before adding or rewriting a reference file. Skill sources live in this `skills/` directory in the `prisma/prisma` monorepo.

## License

Apache-2.0.
