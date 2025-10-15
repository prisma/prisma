# Refract ORM

Refract is a TypeScript-native ORM that preserves the declarative Prisma schema language while replacing the Rust engine with a lean, transparent implementation built entirely in TypeScript. By composing around Kysely for query execution, Refract delivers the familiar Prisma-style client API with the flexibility of direct access to `$kysely` when needed.

- **Why**: Simplify the ORM stack, remove binary friction, and keep developers in the TypeScript ecosystem they already trust. See `EXECUTIVE_SUMMARY.md`.
- **What**: A Prisma-compatible schema workflow, auto-generated client, programmatic migrations, and modern tooling integrations. See `REQUIREMENTS.md`.
- **How**: Phased delivery from an end-to-end MVP through feature parity and beyond. See `DELIVERY_ROADMAP.md`.

## Project Status

- Current focus: **Phase 0 (End-to-End Prototype)** — stand up a working example that exercises schema parsing, client generation, migrations, and Kysely-backed execution for PostgreSQL and SQLite.
- Subsequent phases target a proud-to-demo release (Phase 1), Prisma-level parity (Phase 2), and differentiated features (Phase 3+).

## Key Packages

- `packages/client-refract`: Kysely-backed client runtime and generators.
- `packages/schema-parser`: TypeScript-native parser for `.prisma` schemas.
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
pnpm --filter @refract/client-refract demo
```

> Note: Refract is under active development. APIs may change during Phase 0 as we converge on the end-to-end example. Track progress in `DELIVERY_ROADMAP.md` and `NEXT_STEPS.md`.

## Development Workflow

1. Edit or create your `schema.prisma`.
2. Use `pnpm --filter @refract/schema-parser test` to exercise parsing changes.
3. Run `pnpm --filter @refract/client-refract build` (or `pnpm watch`) to regenerate the client runtime.
4. Use the CLI (`pnpm refract …`) for init/generate/migrate flows once Phase 0 tasks are complete.
5. Launch the demo project (Vite + unplugin) to validate type generation and CRUD operations.

## Contributing

This repository is transitioning from the Prisma codebase. When touching legacy files, prefer modernizing them to align with Refract’s TypeScript-native strategy. Follow our workspace conventions:

- Node.js ≥ 20, pnpm ≥ 9.14.4.
- `pnpm lint`, `pnpm test`, and `pnpm build` at the workspace root before submitting changes.
- Database-backed tests require Docker containers defined in `/docker`.

## License

Apache-2.0 © Refract contributors.
