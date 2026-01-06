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
pnpm build
```

For faster local dev:

```bash
pnpm -r run dev
```

## Test

```bash
pnpm -r test
```

## Examples

Vite demo:

```bash
pnpm --filter @refract/cli build
cd examples/vite
node ../../packages/cli/dist/bin.js generate
pnpm dev
```

Postgres demo:

```bash
pnpm demo:postgres
```

## Notes

- Keep changes small and focused.
- Prefer the Refract-first workflow (`refract` CLI + `unplugin-refract`).
