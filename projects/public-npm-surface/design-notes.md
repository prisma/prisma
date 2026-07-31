# Public npm surface — design notes

The system-level design is settled and recorded in [ADR 242](../../docs/architecture%20docs/adrs/ADR%20242%20-%20Public%20npm%20surface%20-%20single%20%40prisma%20scope%20with%20consolidated%20publish%20packages.md); these notes hold only execution-level decisions made while shaping this project.

## Principles

- **Additive until the switchover.** Old package names and imports work at every intermediate commit; the publish list and `private` flags flip in one PR.
- **Shells re-export, never copy.** One module, one published package — the ADR's identity rule is the invariant every slice must preserve.
- **The registry is the deliverable.** Verification runs against packed tarballs, not workspace links, because workspace resolution hides exactly the class of bug (phantom deps, missing exports entries) this project exists to eliminate.

## Execution decisions

- **Internal workspace names stay `@prisma-next/*`.** Private names never reach npm; renaming ~50 packages and every in-repo import buys nothing the `private` flag doesn't provide. Recorded as a spec non-goal; flagged to operator (spec OQ 3).
- **Facades are relocated entry packages, not new code.** Today's per-database entry packages already do the wiring; they move to `packages/9-public/` and gain re-export entrypoints rather than being rewritten.
- **Shim keeps its current name for now** (spec OQ 2); the `prisma` succession is out of scope per ADR 242's deferred decisions.

## Findings during delivery

- **Families and targets runtime-depend on the toolchain shell** (TML-3121): `family-sql`/`family-mongo` reach `emitter`/`migration-tools`, targets reach `cli`. ADR 242's "tooling depends only on framework" holds, but the reverse edges mean a facade install pulls `orm-toolchain` into the runtime dependency graph — evidence for the deferred emitter-placement decision (spec non-goal 3). Serverless bundles still tree-shake, but the structural guarantee the split aimed for is only partial until emitter/migration-tools placement is resolved.
- **Entrypoint canon is per export-subpath, not per package** (TML-3121): internal packages have no root export, so `@prisma-next/<pkg>/<sub>` → `@prisma/<shell>/<entry>/<sub>` is the only 1:1 rewrite. Family prefixes strip inside their shell (`sql-contract` → `contract`); `9-family` packages → `family`. The mapping table in `packages/0-config/tsdown/shells.ts` is the single source of truth for build, emitter (TML-3123), and lint (TML-3124).
- **Root aggregate entrypoints restore the ADR-named surfaces** (TML-3121 review): the per-subpath canon alone meant `@prisma/orm-framework/contract` and `orm-target-postgres/{target,adapter,driver}` — names ADR 242 promises — did not exist. Shells now synthesize a star-export aggregate per internal package that lacks a root export, layered on top of the per-subpath entries. Packages with a curated root export keep it. Aggregate builds fail on real ESM export ambiguity; the check is runtime-name-based, so a pure type-name collision inside an aggregate `.d.mts` would not be caught.
- **Shells bundle rather than depend** (TML-3121): a published shell cannot depend on private packages, so identity is preserved by one rolldown build per shell (single chunk per shared module) plus cross-shell externalization to published entrypoints. Verified at sourcemap level: zero duplicated modules across all 7 shells.

- **Facades are generated shells too, not relocated source** (TML-3122): moving the facade source under `packages/9-public/` would make in-repo examples — which import both the facade name and internals directly — load two copies of every SQL module, breaking the shared-registry invariant and the transitional constraint that old names keep working. The facade's *published* artifact is unchanged (thin, exact-pinned deps on platform shells, bundling only its own wiring source); only its on-disk home differs. This adds three mechanisms to the shell builder: a package occupying the shell's own namespace, forwarding entrypoints that `export *` from a sibling shell, and forwarded bins. The switchover slice can relocate source once examples move to facade imports.
- **A facade install does not get the toolchain's bin for free** (TML-3122, corrects a project-plan assumption): pnpm links bins of *direct* dependencies only, so `@prisma/orm-toolchain`'s bin never appears in an app that depends on it transitively via a facade. Each facade therefore declares its own `bin.prisma-next` as a one-line launcher importing `@prisma/orm-toolchain/bin/prisma-next` — one published CLI implementation, reachable from a facade-only install.
- **The emitted-migration import root is hardcoded in the targets** (TML-3122): `render-typescript.ts` and `op-factory-call.ts` in the Postgres and Mongo targets write `@prisma-next/<db>/migration` into generated migration files. This couples `init`'s scaffolded dependency to the emitter's import root — the two must flip together, in TML-3123. Until then `init` keeps scaffolding the current names.

## App-facing dependency shape: one package or three?

TML-3126 stopped short of the flip after a scan reported 20 internal packages with no facade entrypoint. That scan was over-read at the time — including in this file — as "those APIs are unreachable" and "ADR 242's promise is broken". Both readings were wrong, and the corrected picture matters for the remaining slices:

- **Users cannot end up with duplicate modules.** After the switchover the internal `@prisma-next/*` packages are not published, so an application has no way to install both an internal package and a shell. Module duplication is a *workspace-only* hazard during migration, where both sit on disk — which is exactly what `scripts/lint-single-import-root.mjs` now guards.
- **Nothing is unreachable.** `@prisma/orm-family-sql` already publishes `/runtime`, `/orm-client`, `/builder`, `/relational-core` and their subpaths. The scan found packages the *facade* does not re-export, not packages an application cannot get.

What is left is an ergonomics decision, tracked on TML-3128: an app depends either on the facade alone (facades re-export the family runtime surfaces; ~19 new entrypoints) or on the facade plus `@prisma/orm-family-sql` and `@prisma/orm-toolchain` (works today, no new entrypoints, and consistent with how ADR 242 already treats the toolchain). Decide it with evidence by rewriting one example per family using published names only — some of the scanned imports look like stale example code rather than real gaps (`prisma-next-demo` takes the generic `Runtime` from `sql-runtime` where the facade already offers `PostgresRuntime`).

**Worth adopting either way** (raised by the same slice): derive the import root from the *consuming project's* dependencies rather than a global default, so `init` can scaffold facade-only projects immediately and examples migrate one at a time instead of in one big-bang commit.

## Decomposed installs and migrations: three import-root gaps, all shallow

Raised by TML-3123, resolved in analysis during its review, and **carried into TML-3126** as work. ADR 242's decomposability promise holds — an earlier reading of these as structural holes (and the symbol-aware-resolver fix it implied) was wrong.

1. **Postgres/SQLite migrations under `platform` mode.** A generated migration imports one specifier, `@prisma-next/<db>/migration`, carrying the target's `Migration`, the CLI's `MigrationCLI`, the SQL family's DDL builders, and the framework's `placeholder`. That four-way merge is **platform-owned** — it lives in `packages/3-targets/3-targets/postgres/src/exports/migration.ts`; the facade's `migration.ts` is a one-line re-export of it. So the merged specifier already resolves under both roots, and `platform` fails only because the emitted constant names the facade's alias instead of the module behind it. Fix: either record single-hop entrypoint aliases in `publish-surface` (keeps the nicer facade-root name, no published-surface change), or author the constants against the target specifier (simpler, changes default output so it rides with the flip).
2. **Mongo migrations under `facade` mode.** Mongo emits three specifiers where SQL emits one, and the facade republishes contract surfaces but not the family migration base or the CLI. The asymmetry is an accident the code already flags as a follow-up. Fix: mirror the SQL targets — have `@prisma-next/target-mongo/migration` re-export `Migration` and `MigrationCLI`, collapsing the scaffold to one specifier. Mongo then works under all three roots with no change to the published facade surface.
3. **`init` under `platform` mode.** `@prisma-next/<db>/runtime` is the facade's own wiring, not a re-export, so a decomposed scaffold is a different template rather than a renamed import. This is correct by construction: `init` is facade-only. Express it in the type (`internal | facade`) rather than as a runtime throw, and state it in the ADR.

## Decisions deferred to close-out (raised by delivery, need an ADR answer)

1. **The framework/toolchain split does not currently achieve its stated purpose.** ADR 242 splits `orm-framework` from `orm-toolchain` so a deployed application's runtime graph never carries a compiler toolchain. In practice every facade and most extension packs hard-depend on `orm-toolchain`, inherited from internal packages (`@prisma-next/postgres` → `@prisma-next/cli`; families and targets → `emitter`/`migration-tools`/`cli`), and the facade needs it for the bin launcher regardless. Tree-shaking still trims deployed bundles, but the *structural* guarantee the ADR claims is not there. Either the internal dependencies move (the deferred emitter-placement decision, plus separating the CLI's runtime-facing surface from its tooling) or ADR 242's rationale is amended to claim only what holds.
2. **`@prisma/orm-extension-supabase` depends on a facade.** ADR 242 says extension authors build against platform packages; this pack depends on `@prisma/orm-postgres` because its internal package does. It therefore cannot be used in a decomposed install without pulling the whole facade in. Either the internal dependency is redirected at the platform packages, or the ADR acknowledges facade-dependent extensions as a category.
3. **"Facade" is now overloaded.** The repo already calls `@prisma-next/postgres` the facade (`removePreviousFacade` in `init.ts`, the init-journey harness). `@prisma/orm-postgres` is a second thing with the same name. Worth settling the vocabulary before the docs rewrite.

## Open questions

Tracked in `spec.md § Open questions` — org readiness, shim interim name, internal-name confirmation, `middleware-cache` naming depth.

## References

- ADR 242 (decision), ADR 211 (shim mechanics), `docs/reference/Package Naming Conventions.md` (to be rewritten at close-out).
