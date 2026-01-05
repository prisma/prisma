# Contributing to Refract ORM

Thanks for helping build Refract. This project is intentionally small and TypeScript-first.

## Code of Conduct

By participating, you agree to follow `CODE_OF_CONDUCT.md`.

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker (only if you run database-backed tests)

## Setup

```bash
pnpm install
```

## Build

```bash
pnpm -r build
```

For faster local dev:

```bash
pnpm -r run dev
```

## Test

```bash
pnpm -r test
```

Database-backed tests require Docker. See `docker/README.md`.

## Examples

Vite demo (recommended for Phase 0):

```bash
pnpm --filter @refract/cli build
cd examples/vite
node ../../packages/cli/dist/bin.js generate
pnpm dev
```

Postgres demo (optional):

```bash
pnpm demo:postgres
```

## Notes

- Keep changes small and focused.
- Prefer the Refract-first workflow (`refract` CLI + `unplugin-refract`).
