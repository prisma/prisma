# Quick Reference for Agents

## Getting Started as an Agent

When beginning work on this project, **always read these core documents first**:

1. **README.md** - Vision, why Refract exists, strategic pillars, and feature overview
2. **ARCHITECTURE.md** - How code generation works, package dependencies, template system, design principles, and common pitfalls
3. **DELIVERY_ROADMAP.md** - Phase-based delivery plan and completion criteria
4. **NEXT_STEPS.md** - Current tactical tasks and progress tracking

These documents contain critical context that will help you understand the codebase structure, avoid known pitfalls, and work effectively.

## Project Snapshot

- **Name**: Refract ORM
- **Goal**: Deliver a TypeScript-native fork of Prisma that keeps the `.prisma` schema language and Prisma-style client while delegating query execution to Kysely.
- **Phase**: 0 (end-to-end prototype in progress). See `DELIVERY_ROADMAP.md` and `NEXT_STEPS.md`.
- **Key Docs**: `README.md` (vision/features), `ARCHITECTURE.md` (internals), `DELIVERY_ROADMAP.md` (timeline).

## Workspace Essentials

- Install: `pnpm install`
- Build: `pnpm build` or `pnpm -r build`
- Watch: `pnpm watch`
- Lint: `pnpm lint`
- Test: `pnpm test` (database-backed suites require Docker per `docker/README.md`)

## Key Packages

- `@refract/client`: Prisma-like client runtime backed by Kysely; exposes `$kysely`.
- `@refract/schema-parser`: Pure TypeScript parser for `.prisma` files, produces AST for generators.
- `@refract/migrate`: Programmatic migrations via Kysely (`diff`, `apply`, history APIs).
- `@refract/config`: Config discovery and dialect creation (PostgreSQL, SQLite priority).
- `unplugin-refract`: Build-tool integration that emits virtual `.refract/types` modules for IDE support.
- `@refract/cli`: ESM-only CLI wrapping config, generation, and migrations (implementation in progress).

## Development Notes

- Prioritize PostgreSQL and SQLite support while structuring code for additional Kysely dialects.
- Keep schema parsing, client generation, and migrations TypeScript-native—no Rust engine integration.
- Integrate with Vite via `unplugin-refract`; provide manual fallbacks for non-Vite environments.
- Tests live alongside packages (`src/__tests__`) and as functional suites under `packages/client`.

## Code Generation Workflow (IMPORTANT!)

When making changes to the client generator:

1. **Edit source**: Modify `packages/client/src/client-generator.ts`
2. **Rebuild client package**: `pnpm --filter @refract/client build`
3. **Rebuild CLI**: `pnpm --filter @refract/cli build`
4. **Regenerate example client**: `cd examples/basic && node ../../packages/cli/dist/bin.js generate`
5. **Test**: `cd examples/basic && pnpm demo`

**⚠️ Do NOT use `pnpm generate` in example directories during development!** It won't pick up your changes. Use the direct node invocation instead.

See `ARCHITECTURE.md` for detailed explanations of the code generation flow, template system, and common pitfalls (like `.replace()` vs `.replaceAll()`).

## Common Patterns & Gotchas

Read `ARCHITECTURE.md` section "Common Patterns" for:
- How field transformations are generated and embedded
- Variable substitution in templates (watch for multiple occurrences!)
- Column qualification in JOIN queries (must use `Table.column` syntax)
- Kysely API constraints and best practices

## Context Links

- **Vision & features**: README.md
- **How it works**: ARCHITECTURE.md
- **Phase goals & timeline**: DELIVERY_ROADMAP.md
- **Current tasks**: NEXT_STEPS.md
