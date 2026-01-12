# Ork Vite Tooling Demo

This example uses **Vite as a build tool** to automate Ork tasks that are painful with Prisma:

- ✅ Auto‑generate the client on schema change
- ✅ Auto‑apply migrations on schema change
- ✅ Live type updates via `.ork/types`

The point is **not** UI — it is the dev workflow and console output.

## Prerequisites

- Node.js >= 20
- pnpm >= 10

## Setup (repo local)

From the repo root:

```bash
pnpm install
pnpm --filter ork build
```

Then:

```bash
cd examples/vite
pnpm approve-builds
export DATABASE_URL="file:./dev.db"
pnpm dev
```

## What Happens in `pnpm dev`

1. Vite starts.
2. `unplugin-ork` runs an initial sync:
   - generates `./.ork/index.ts`
   - applies migrations to `./dev.db`
3. Edit `schema.prisma` and watch the console:
   - client re‑generates
   - migrations re‑apply
   - `.ork/types` updates for live types

## Files to Inspect

- `vite.config.ts` — configures `unplugin-ork` automation options
- `schema.prisma` — change this to trigger the workflow

## Optional CLI Generation

If you want manual generation instead of auto‑generation:

```bash
pnpm generate:local
```

## Notes

- The generated client is written to `./.ork`.
- The SQLite database lives at `./dev.db`.
- If migrations fail with missing `better-sqlite3`, run `pnpm approve-builds` and reinstall.
- Alternatively, you can skip `DATABASE_URL` by hardcoding `datasource.url` in `ork.config.ts`.
