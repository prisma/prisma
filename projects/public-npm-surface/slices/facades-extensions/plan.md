# Slice: facades, extension packs, bin shim — plan

**Issue:** [TML-3122](https://linear.app/prisma-company/issue/TML-3122) · **Branch:** `tml-3122-facades-extensions` (stacked on `tml-3121-platform-shells`)

## Outcome

The complete 17-package public surface exists under `packages/9-public/` and builds: 3 database facades, 6 extension packs, the relocated bin shim, on top of slice 1's 7 platform shells. Still additive — no `private` flags flip, no publish-list change, existing names keep working.

## Scope

### Facades (3)

`@prisma/orm-{postgres,sqlite,mongo}` from today's `packages/3-extensions/{postgres,sqlite,mongo}`. These are real wiring packages, not shells: their source moves, and they gain

- **exact-pinned dependencies** on the platform shells they need (`workspace:<version>`, publishing as exact),
- **contract-surface re-exports as their own entrypoints** (`@prisma/orm-postgres/contract`, `/components`) so generated code imports only a direct dependency — this is what TML-3123 will emit against,
- their existing entrypoints preserved (`/config`, `/runtime`, `/target`, `/family`, `/migration`, `/serverless`, `/static`, `/contract-builder`, `/control`).

### Extension packs (6)

`@prisma/orm-extension-{postgis,pgvector,paradedb,supabase,arktype-json,middleware-cache}` from `packages/3-extensions/*`. Peer dependencies repoint from internal adapter packages (`@prisma-next/adapter-postgres`) to published target shells (`@prisma/orm-target-postgres`).

### Bin shim (1)

`packages/1-framework/3-tooling/prisma-next` moves to `packages/9-public/prisma-next` (interim name; the `prisma` succession is deferred per ADR 242). ADR 211 invariants — dist copied verbatim from the CLI, deps/bin/version mirrored, no `exports`/`main`/`types`, drift-lint green — must hold after the move, with the drift-lint's paths updated.

## Two decisions this slice must land

1. **`sql-orm-client` has no home.** `packages/3-extensions/sql-orm-client` is SQL-family platform code (both the postgres and sqlite facades depend on it), not a user-installed extension, despite its directory. ADR 242 never places it and slice 1's shell mapping omitted it. **Ruling: add it to the `@prisma/orm-family-sql` shell as the `orm-client` entry.** One module, one package — it cannot be duplicated into two facades. This edits slice 1's mapping table, so the shell build must be re-verified.
2. **Bin-name conflict.** `@prisma/orm-toolchain` (slice 1) and the shim both declare `bin.prisma-next`. They collide only if both are installed. **Ruling: keep the toolchain's bin** — a facade install then gives `npx prisma-next` with no shim — and **narrow the shim to the bootstrap path** (`pnpm dlx prisma-next init`), where nothing else is installed. The CLI's `init` command must therefore install the **facade only**, never the shim. Verify `init`'s generated `package.json` accordingly.

## Done when

- All 17 published packages build green from root; repo CI green (`lint:docs`, `lint:manifests`, `lint:deps`, `typecheck:packages`, `check:clean-tree`, `check:publish-deps`).
- Tarball test: installing a facade tarball alone resolves every facade entrypoint, pulls its platform shells transitively, and exposes a working `npx prisma-next --help`.
- Tarball test: an extension pack installs against its target shell with peer resolution satisfied.
- Module identity holds across facade → shell boundaries (same assertion style as slice 1).
- `sql-orm-client` reachable as `@prisma/orm-family-sql/orm-client`; no duplicate copy in either facade.
- Shim drift-lint passes from the new location; `init` scaffolds a facade dependency.
- No `@prisma-next/*` specifier in any published dist.

## Outcome vs plan (recorded at slice completion)

Two plan instructions were corrected during implementation; both corrections are right and are recorded in `design-notes.md`:

1. **"Facade source moves"** — not done, and should not be: relocating the source breaks the transitional constraint this same plan sets, because in-repo examples import both the facade name and internals directly and would load duplicate module copies. Facades ship as generated shells whose published artifact matches the plan exactly.
2. **"The toolchain's bin gives a facade install `npx prisma-next`"** — false premise. pnpm links bins of direct dependencies only. Each facade declares a launcher bin delegating to the toolchain's single CLI implementation.

`init` scaffolding a facade dependency moves to TML-3123: the targets hardcode `@prisma-next/<db>/migration` as the emitted-migration import root, so `init`'s dependency and the emitter's import root must flip together.

## Risks

- **Facade source moves** (unlike slice 1's pure additions) — internal imports of `@prisma-next/postgres` etc. must keep resolving; keep the old package as a thin re-export if anything in-repo still depends on it, and remove that in the switchover slice.
- **Mongo facade peer** (`mongodb`) and driver externals must land as real facade deps.
- Editing slice 1's mapping table (decision 1) invalidates shell caches — expected; verify shells still build and identity tests still pass.
