# Refract ORM

Refract is a TypeScript-native ORM, built on the Prisma schema language and Kysely query builder.

> [!CAUTION]
> **Should I use Refract?**
>
> No, probably not. Refract is a fork of Prisma ORM that:
>
> 1. Involved a lot of LLM-generated code
> 2. Is written by a person who has no idea what they're doing
> 3. Isn't stable or mature
>
> Despite these concerns, if you're still willing to try out the project, thank you very much! I'll do my best to address feedback and concerns.

## Vision

Refract wants to be your ORM du jour. We want to get there by offering the following:

1. A way to define your database schema in a clear and concise way.
2. A way to generate a full-typed, high-level client SDK so you can work with your data quickly and easily.
3. A way to seamlessly migrate from one database schema to another.

How we get there is with the following tools:

1. A superset of the Prisma schema language that also allows you to define constraints, views, procedures, and more.
2. A generated client that combines a Prisma-style API with the ability to use Kysely queries directly.
3. A migration engine that generates reasonable up and down migrations for a given schema change.
4. The ability to do any or all of the above a la carte via development plugins, typescript functions, and a CLI.

## Strategic Pillars

While right now Refract is a dinky one-man show, we have a clear vision of a mature, community-managed project. Here are some of the tenets we want to stand by:

- Whenever possible, a project using Prisma could switch to Refract with minimal code churn.
- Refract is a typescript project, from top to bottom.
- Refract should get out of your way and integrate with modern tooling and workflows.
- Refract should consider and prioritize community-driven contributions.

## What You Get

- **Prisma schema compatibility**: Use your existing `.prisma` files without modification
- **Type-safe client API**: Generated Prisma-like client with CRUD operations that map to Kysely queries
- **Relation loading**: Support for `include` to fetch related records with proper typing
- **Relation filtering**: `where` filters across relations (`some`, `every`, `none`, `is`, `isNot`)
- **Kysely integration**: Direct access via `$kysely` for advanced queries
- **Programmatic migrations**: `diff()` and `apply()` APIs that work through Kysely
- **Modern CLI**: `refract init`, `refract generate`, and `refract migrate` commands
- **Modern build tool integrations**: `unplugin-refract` with hot reloading
- **Multi-database support**: PostgreSQL, MySQL, and SQLite today, with a clear path to additional dialects

## Project Status

The project's current focus is an alpha version that includes schema parsing, client generation, migrations, and Kysely-backed execution for PostgreSQL, MySQL, and SQLite queries.

Future effort will be put towards:

1. A beta release
2. As much parity with Prisma ORM as is possible (incl. DB support, etc)
3. Feature differentiation (Prisma Schema Language superset)

## Key Packages

- `packages/client`: Client runtime and code generation.
- `packages/schema-parser`: TypeScript-native parser for `.prisma` schemas.
- `packages/field-translator`: Database-specific field transformation for code generation.
- `packages/migrate`: Programmatic migration engine powered by Kysely.
- `packages/config`: Configuration discovery and dialect wiring.
- `packages/unplugin-refract`: Build-tool integration (Vite, Webpack, Rollup, esbuild) that emits virtual `.refract/types` modules.
- `packages/cli`: CLI (`refract`) that orchestrates config, generation, and migrations.

Each package is ESM-only and published to the `@refract/*` namespace once stabilized.

## Getting Started (Alpha)

Refract supports two workflows:

1. **Vite + unplugin (recommended)**: auto-generates the client and keeps `.refract/types` in sync.
2. **CLI-only (Prisma-style)**: run `refract dev` for a unified generate+migrate loop, or run commands manually.

### 1) Vite + unplugin (recommended)

```bash
pnpm add -D @refract/cli unplugin-refract
npx refract init
export DATABASE_URL="file:./dev.db"
pnpm dev
```

> [!NOTE]
> `refract init` will detect Vite and can auto-patch your `vite.config` to add this plugin. It can also offer to install recommended dependencies.

Add the plugin in `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import refract from 'unplugin-refract/vite'

export default defineConfig({
  plugins: [
    refract({
      autoGenerateClient: true,
      autoMigrate: true,
    }),
  ],
})
```

### 2) CLI-only

```bash
# Initialize config + schema
npx refract init

# Run the dev loop (generate + migrate on schema changes)
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
npx refract dev
```

## Development Workflow

1. Edit or create your `schema.prisma`.
2. Use `pnpm --filter @refract/schema-parser test` to exercise parsing changes.
3. Run `pnpm --filter @refract/client build` (or `pnpm watch`) to regenerate the client runtime.
4. Use the CLI for init/generate/migrate flows.
5. Launch the demo project (Vite + unplugin) to validate type generation and CRUD operations.

## Contributing

Refract is TypeScript-first. Follow our workspace conventions:

- Node.js ≥ 20, pnpm ≥ 10.
- `pnpm lint`, `pnpm test`, and `pnpm build` at the workspace root before submitting changes.
- Database-backed tests require Docker containers defined in `/docker`.

## License

Apache-2.0 © Refract contributors.
