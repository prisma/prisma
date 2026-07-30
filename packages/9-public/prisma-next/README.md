# prisma-next

The Prisma Next CLI. Emit contracts, verify and sign databases, and run migrations from a type-safe contract.

## Install

```bash
pnpm add -D prisma-next
# or
npm install -D prisma-next
# or
yarn add -D prisma-next
# or
bun add -D prisma-next
```

No install? Run it directly:

```bash
pnpm dlx prisma-next init
npx prisma-next init
bunx prisma-next init
yarn dlx prisma-next init
```

This is the bootstrap path, and it is what this package exists for: a project with no Prisma Next dependencies yet still needs a way to run `init`. A project that already depends on a database facade (`@prisma/orm-postgres`, `@prisma/orm-sqlite`, `@prisma/orm-mongo`) gets the same `prisma-next` command from that facade and does not need this package as well.

## Quickstart

In a project with a `package.json`:

```bash
pnpm dlx prisma-next init
```

Init prompts for your database (PostgreSQL or MongoDB) and schema location, scaffolds the config/schema/runtime files, installs the target facade (e.g. `@prisma-next/postgres`) plus `prisma-next`, and emits your contract.

## Commands

| Command | Purpose |
| --- | --- |
| `prisma-next init` | Scaffold a new Prisma Next project (config, schema, runtime, docs). |
| `prisma-next contract emit` | Emit `contract.json` and `contract.d.ts` from your schema. |
| `prisma-next contract infer` | Introspect a database and write an inferred PSL contract. |
| `prisma-next db init` | Bootstrap a database to match the current contract (additive only). |
| `prisma-next db update` | Update a database to match the current contract (including destructive ops). |
| `prisma-next db schema` | Inspect the live database schema. |
| `prisma-next db sign` | Write or update the contract marker on the database. |
| `prisma-next db verify` | Verify the database matches the emitted contract. |
| `prisma-next migration plan` | Plan a new migration from contract changes. |
| `prisma-next migration show` | Display a migration package. |
| `prisma-next migration status` | Show the migration graph and applied status. |
| `prisma-next migrate` | Apply planned migrations to the database. |
| `prisma-next migration verify` | Verify a migration package's integrity. |
| `prisma-next migration ref` | Manage named refs in `migrations/refs.json`. |

Run `prisma-next --help` or `prisma-next <command> --help` for full options.

## Programmatic use

`prisma-next` is a CLI distribution only — it has no library exports. Importing from `prisma-next` (root or any subpath) will fail.

Authors of build integrations, extension packs, and advanced config wiring should install [`@prisma-next/cli`](https://www.npmjs.com/package/@prisma-next/cli) and import from its subpaths:

- `@prisma-next/cli/config-types` — `defineConfig` and config types
- `@prisma-next/cli/control-api` — `createControlClient` for programmatic control-plane operations
- `@prisma-next/config-loader` — `loadConfig`
- `@prisma-next/cli/commands/*` — individual command factories (`createContractEmitCommand`, `createDbInitCommand`, …)

These subpaths are less stable than the facade packages (`@prisma-next/postgres/config`, `@prisma-next/mongo/config`) — prefer those for application-level config.

## Links

- Project: [prisma-next on GitHub](https://github.com/prisma/prisma-next)
- Internal architecture documentation: [`@prisma-next/cli` README](https://github.com/prisma/prisma-next/tree/main/packages/1-framework/3-tooling/cli)
