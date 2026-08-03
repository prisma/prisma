# Slice: platform publish shells — plan

**Issue:** [TML-3121](https://linear.app/prisma-company/issue/TML-3121) · **Branch:** `tml-3121-platform-shells` (on `tml-3120-public-npm-surface`)

## Outcome

`packages/9-public/@prisma/` contains the 7 platform shells (`orm-framework`, `orm-toolchain`, `orm-family-sql`, `orm-family-mongo`, `orm-target-postgres`, `orm-target-sqlite`, `orm-target-mongo`), each publishable and exposing one subpath entrypoint per internal workspace package it consolidates. Publish list and `private` flags unchanged elsewhere; repo builds green.

## Mechanism (the part that must be right)

A published shell cannot declare dependencies on private workspace packages, so shells **bundle** their internals:

- **One entrypoint per internal package**, named from the canonical mapping (e.g. `packages/2-sql/5-runtime` → `@prisma/orm-family-sql/runtime`).
- **Within a shell: code-splitting, not duplication.** Entrypoints that share internal modules must share chunks (rolldown/tsdown multi-entry splitting), or `instanceof`/registry identity breaks inside a single install.
- **Across shells: externalize and rewrite.** When bundling `orm-family-sql`, imports of framework internals rewrite to `@prisma/orm-framework/<entrypoint>` and are marked external. Cross-shell references become real published-package deps (exact lockstep version).
- **Canonical mapping as data.** One module holds the internal-package → (shell, entrypoint) table; shell build configs, and later the emitter (TML-3123) and lint (TML-3124), consume it. Home: `packages/0-config/tsdown` (extend `@repo/tsdown`'s `defineConfig` with a shell mode) or a sibling module there.
- Type declarations follow the same mapping (`.d.mts` per entrypoint, cross-shell imports pointing at published names).

## Dispatches

1. **Mechanism canary** — build the mapping table + shell build mode; prove it on `orm-framework` alone (the dependency-closed root: no cross-shell externals). Verify: `pnpm pack` the shell, install the tarball in a scratch project, import two entrypoints that share an internal module, assert shared identity (e.g. a class from `/contract` used by `/components` is the same reference).
2. **Fan-out** — remaining 6 shells using the proven mode; cross-shell externals exercised (family-sql → framework; targets → family + framework; toolchain → framework). Workspace glob `packages/9-public/@prisma/*`; shells wired into turbo build.
3. **Validation** — tarball-install smoke test covering a cross-shell chain (target-postgres → family-sql → framework), asserting resolution and identity; wire into CI as part of the slice's test surface.

## Done when

- All 7 shells `pnpm build` green from root; repo-wide CI green.
- Tarball smoke test passes: every declared entrypoint resolves from an installed tarball; shared-module identity holds within and across shells.
- No internal `@internal/*` specifier appears in any shell's published dist.
- Nothing outside `packages/9-public/` changed behavior; publish list untouched.

## Risks

- **rolldown chunk dedup across entrypoints** is the identity linchpin — the canary dispatch exists to falsify it early. If splitting can't guarantee single-copy, fall back to each entrypoint being a thin re-export of one internal "core" chunk per shell.
- **`orm-toolchain` bins** (CLI) must survive bundling with executable permissions and working shebangs.
- **Runtime externals** (pg, mongodb, arktype, esbuild, prettier...) stay real deps of the shell — collect each shell's union of its internals' external deps.
