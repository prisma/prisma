# Refract ORM

Refract is a TypeScript-native ORM, built on the Prisma schema language and Kysely query builder.

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
- **Kysely integration**: Direct access via `$kysely` for advanced queries
- **Programmatic migrations**: `diff()` and `apply()` APIs that work through Kysely
- **Modern CLI**: `refract init`, `refract generate`, and `refract migrate` commands
- **Vite-first generation**: `unplugin-refract` with hot module reloading for type updates
- **Multi-database support**: PostgreSQL and SQLite today, with clear path to additional dialects

For architectural details, see `ARCHITECTURE.md`. For the delivery timeline, see `DELIVERY_ROADMAP.md`.

## Project Status

- Current focus: **Phase 0 (End-to-End Prototype)** — stand up a working example that exercises schema parsing, client generation, migrations, and Kysely-backed execution for PostgreSQL and SQLite.
- Subsequent phases target a proud-to-demo release (Phase 1), Prisma-level parity (Phase 2), and differentiated features (Phase 3+).

## Key Packages

- `packages/client-refract` (`@refract/client`): Kysely-backed client runtime and code generator.
- `packages/schema-parser`: TypeScript-native parser for `.prisma` schemas.
- `packages/field-translator`: Database-specific field transformation code generators.
- `packages/migrate`: Programmatic migration engine powered by Kysely.
- `packages/config`: Configuration discovery and dialect wiring.
- `packages/unplugin-refract`: Build-tool integration (Vite, Webpack, Rollup, esbuild) that emits virtual `.refract/types` modules.
- `packages/cli`: ESM-first CLI (`refract`) that orchestrates config, generation, and migrations.

Each package is ESM-only and published to the `@refract/*` namespace once stabilized.

## Getting Started (Preview)

```bash
pnpm install

# Build workspace packages
pnpm build

# Explore the client demo
pnpm --filter @refract/client demo
```

> Note: Refract is under active development. APIs may change during Phase 0 as we converge on the end-to-end example. Track progress in `DELIVERY_ROADMAP.md` and `NEXT_STEPS.md`.

## Development Workflow

1. Edit or create your `schema.prisma`.
2. Use `pnpm --filter @refract/schema-parser test` to exercise parsing changes.
3. Run `pnpm --filter @refract/client build` (or `pnpm watch`) to regenerate the client runtime.
4. Use the CLI for init/generate/migrate flows (e.g., `cd examples/basic && pnpm generate`).
5. Launch the demo project (Vite + unplugin) to validate type generation and CRUD operations.

## Contributing

This repository is transitioning from the Prisma codebase. When touching legacy files, prefer modernizing them to align with Refract’s TypeScript-native strategy. Follow our workspace conventions:

- Node.js ≥ 20, pnpm ≥ 9.14.4.
- `pnpm lint`, `pnpm test`, and `pnpm build` at the workspace root before submitting changes.
- Database-backed tests require Docker containers defined in `/docker`.

## License

Apache-2.0 © Refract contributors.
