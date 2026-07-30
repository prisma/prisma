# Public npm surface

> Linear Project: [Public npm surface (ADR 242)](https://linear.app/prisma-company/project/public-npm-surface-adr-242-8a50efed8401) · Planning record: [TML-3120](https://linear.app/prisma-company/issue/TML-3120/plan-public-npm-surface) · Branch: `tml-3120-public-npm-surface`

## Purpose

The npm registry should itself document what Prisma Next's public API is. Today every workspace package publishes, so users cannot tell facade from internal, applications accumulate a dozen-plus direct Prisma dependencies, and every internal package name is de-facto public API that is breaking to rename. This project executes [ADR 242](https://github.com/prisma/prisma/pull/29852): the published surface becomes 17 `@prisma/*` packages plus the unscoped bin shim, and everything else becomes structurally unpublishable.

## At a glance

An application installs one package, and the stack arrives as exact-pinned dependencies:

```jsonc
// package.json
{ "dependencies": { "@prisma/orm-postgres": "0.17.0" } }
```

```
@prisma/orm-postgres            facade: wiring + re-exports
├── @prisma/orm-framework       contracts, components, runtime core
├── @prisma/orm-family-sql      SQL-family contract, lanes, runtime
├── @prisma/orm-target-postgres target descriptor + adapter + driver
└── @prisma/orm-toolchain       CLI (bin), emitter, config-loader, LSP
```

The 17 published packages: 3 database facades, 6 extension packs, `orm-framework`, `orm-toolchain`, `orm-family-sql`, `orm-family-mongo`, 3 targets, plus the `prisma` bin shim. All publishable packages live under `packages/9-public/`; every other workspace package is `"private": true` and reaches npm only as a subpath entrypoint of a published shell (e.g. `packages/2-sql/5-runtime` → `@prisma/orm-family-sql/runtime`). The full decision, audience model, and alternatives live in ADR 242 — this spec does not restate them.

## Non-goals

- **Renaming internal workspace packages.** Private names never reach npm. The `@prisma-next/*` workspace names stay as the repo-internal vocabulary; renaming ~50 packages and every import in the repo buys nothing the privacy flag doesn't already provide. (Open question 3 tracks operator confirmation.)
- **Claiming the unscoped `prisma` npm name.** Deferred in ADR 242; the bin shim ships under its current name until the succession with classic Prisma ORM is coordinated.
- **Resolving the emitter's layer placement.** ADR 242 defers whether the emitter moves out of the tooling layer. This project wires the emitter's *import-specifier output* to published names; moving the emitter between packages is follow-on work if the deferred decision lands that way.
- **Restructuring internal package granularity.** Shells re-export what exists; no merges or splits of workspace packages.
- **Changing the versioning or release model.** Lockstep stays; only the set of packages that publish changes.
- **New runtime behavior.** Byte-for-byte, applications run the same code under new import names.

## Place in the larger world

- **Workspace and build.** `pnpm-workspace.yaml` globs gain the `packages/9-public/@prisma/*` level. Packages build with tsdown configs (`packages/0-config/tsdown`); shells need exports maps with one entrypoint per re-exported internal package.
- **The emitter** (`packages/1-framework/3-tooling/emitter`, plus family emitters) writes import specifiers into users' generated contract files. Today it emits internal workspace names; it must emit facade entrypoints by default and platform-package entrypoints in decomposed mode.
- **The CLI** (`packages/1-framework/3-tooling/cli`) `init` command installs the user-facing package name; the bin-only shim (`packages/1-framework/3-tooling/prisma-next`, ADR 211) copies the CLI dist and moves under `packages/9-public/`.
- **Extensions** (`packages/3-extensions/*`) peer-depend on internal adapter packages today (e.g. `@prisma-next/adapter-postgres`); peers must repoint to published target packages.
- **Examples and tests** (`examples/*`, `test/*`) install long lists of internal packages; they collapse to facade + extensions + toolchain and serve as the proving ground that the facade surface is complete.
- **Publish workflow** (`.github/workflows/publish.yml`, `scripts/` publish tooling, release-notes checks) iterates publishable packages; it must publish exactly the `9-public` set.
- **Docs.** `docs/reference/Package Naming Conventions.md` is rewritten around the public/private split and carries the canonical directory→entrypoint mapping; ADR 211 gets an amendment note.

## Cross-cutting requirements

- **One module, one package.** No internal module may be reachable through two published packages; shells re-export, never copy. This preserves shared-registry and `instanceof` identity and is the invariant that lint must be able to check.
- **Generated code imports only direct dependencies.** Facade entrypoints by default; platform packages only in decomposed installs. No emitted file may import a package the application doesn't directly depend on.
- **Publishability is a directory property.** Lint enforces both directions: nothing outside `packages/9-public/` is publishable, everything inside it is. Emitted output and example code may reference only published names.
- **Facades pin exact lockstep versions** of the platform packages they depend on.
- **Every slice leaves CI green and the repo releasable** (see transitional-shape constraints).

## Transitional-shape constraints

- **No stable release mid-rename.** Until the final slice lands, the tree is a mix of old and new publish identities; the publish workflow must not cut a `latest` release from an intermediate state. Dev-tag builds are acceptable. The project should span at most one release window; coordinate with any release that must ship mid-project.
- **Old names keep working in-repo throughout.** Internal imports (`@prisma-next/*` workspace names) never break at any intermediate commit; shells are additive until the switchover slice flips `private` flags and the publish list together, atomically in one PR.
- **The shim invariants of ADR 211** (deps/bin/version drift-lint) must hold at every commit, including after the shim moves directories.

## Contract impact

No contract entities, kinds, or shapes change. The authoring-surface impact is the import specifier in emitted contract files (`@prisma-next/framework-components` → `@prisma/orm-postgres/components` or `@prisma/orm-framework/components`): regenerating a contract after upgrade rewrites imports but produces an identical `contractHash`. Upgrade instructions must cover the regeneration step (see `record-upgrade-instructions` skill at the switchover slice).

## Adapter impact

All targets are affected identically and mechanically: postgres, sqlite, and mongo adapter/driver/target packages become entrypoints of `@prisma/orm-target-<x>` shells. No adapter behavior changes. Extension peer dependencies repoint from adapter packages to target shells.

## Project DoD

- [ ] A publish dry-run from the working branch lists exactly the 17 ADR 242 packages (+ shim under its interim name) and nothing else.
- [ ] Lint fails on: a publishable package outside `9-public`, a private package inside it, an emitted or example import of a non-published name, and shim drift (ADR 211 invariants).
- [ ] At least one example app per family (postgres, sqlite, mongo) installs only facade + extensions + toolchain, regenerates its contract, type-checks, and passes its test suite against packed tarballs (not workspace links).
- [ ] A decomposed-install proof exists: one example or test consumes platform packages directly with a replaced adapter and passes.
- [ ] Generated-code import audit: no emitted file imports a transitive dependency, verified by test in both emitter modes.
- [ ] `docs/reference/Package Naming Conventions.md` rewritten; ADR 211 amended; upgrade instructions recorded for the emitted-import rename.
- [ ] Repo-wide CI green; team-DoD floor inherited from `drive/calibration/dod.md`.

## Open questions

1. **npm org readiness.** Do `wmadden`/CI publish tokens have rights to create the new `@prisma/orm-*` names, and is provenance/trusted-publishing configured for them? (External dependency; blocks only the final publish, not the repo work.)
2. **Interim shim name.** Keep publishing the bin shim as `prisma-next` until the `prisma` succession is decided, or hold it out of the publish list entirely?
3. **Internal names stay `@prisma-next/*`** — confirm the non-goal above matches operator intent, since it means the old brand persists in repo-internal vocabulary indefinitely.
4. **Extension pack naming depth.** ADR 242 fixes `orm-extension-<x>`; confirm `middleware-cache` becomes `orm-extension-middleware-cache` (it is an extension in-repo but not named `extension-*` today).

## References

- [ADR 242 — Public npm surface](../../docs/architecture%20docs/adrs/ADR%20242%20-%20Public%20npm%20surface%20-%20single%20%40prisma%20scope%20with%20consolidated%20publish%20packages.md) (PR [#29852](https://github.com/prisma/prisma/pull/29852))
- [ADR 211 — `prisma-next` bin-only distribution](../../docs/architecture%20docs/adrs/ADR%20211%20-%20prisma-next%20bin-only%20distribution.md)
- [Package Naming Conventions](../../docs/reference/Package%20Naming%20Conventions.md) (to be rewritten at close-out)
- [Release notes process](../../docs/releases/README.md) (lockstep + publish flow)
