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

## Open questions

Tracked in `spec.md § Open questions` — org readiness, shim interim name, internal-name confirmation, `middleware-cache` naming depth.

## References

- ADR 242 (decision), ADR 211 (shim mechanics), `docs/reference/Package Naming Conventions.md` (to be rewritten at close-out).
