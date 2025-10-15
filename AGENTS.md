# Quick Reference for Agents

## Project Snapshot

- **Name**: Refract ORM
- **Goal**: Deliver a TypeScript-native fork of Prisma that keeps the `.prisma` schema language and Prisma-style client while delegating query execution to Kysely.
- **Phase**: 0 (end-to-end prototype in progress). See `DELIVERY_ROADMAP.md` and `NEXT_STEPS.md`.
- **Gospel Docs**: `EXECUTIVE_SUMMARY.md`, `REQUIREMENTS.md`, `DELIVERY_ROADMAP.md`.

## Workspace Essentials

- Install: `pnpm install`
- Build: `pnpm build` or `pnpm -r build`
- Watch: `pnpm watch`
- Lint: `pnpm lint`
- Test: `pnpm test` (database-backed suites require Docker per `docker/README.md`)

## Key Packages

- `@refract/client-refract`: Prisma-like client runtime backed by Kysely; exposes `$kysely`.
- `@refract/schema-parser`: Pure TypeScript parser for `.prisma` files, produces AST for generators.
- `@refract/migrate`: Programmatic migrations via Kysely (`diff`, `apply`, history APIs).
- `@refract/config`: Config discovery and dialect creation (PostgreSQL, SQLite priority).
- `unplugin-refract`: Build-tool integration that emits virtual `.refract/types` modules for IDE support.
- `@refract/cli`: ESM-only CLI wrapping config, generation, and migrations (implementation in progress).

## Development Notes

- Prioritize PostgreSQL and SQLite support while structuring code for additional Kysely dialects.
- Keep schema parsing, client generation, and migrations TypeScript-native—no Rust engine integration.
- Integrate with Vite via `unplugin-refract`; provide manual fallbacks for non-Vite environments.
- Tests live alongside packages (`src/__tests__`) and as functional suites under `packages/client-refract`.

## Context Links

- Phase goals and requirements: see the gospel docs.
- Progress tracking: add actionable items to `NEXT_STEPS.md` as priorities evolve.
