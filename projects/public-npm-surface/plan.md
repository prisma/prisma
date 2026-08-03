# Public npm surface — project plan

**Spec:** `projects/public-npm-surface/spec.md` · **Linear:** [TML-3120](https://linear.app/prisma-company/issue/TML-3120/plan-public-npm-surface)

## Summary

Four slices in a stack, following the migration pattern (additive shells → additive consumers → canary emitter → atomic switchover). Every intermediate commit keeps old names working and CI green; the publish list changes only in the final slice.

## Slices

### 1. Platform publish shells — [TML-3121](https://linear.app/prisma-company/issue/TML-3121) · `slices/platform-shells/`

Scaffold `packages/9-public/@prisma/` with the 7 platform shells (`orm-framework`, `orm-toolchain`, `orm-family-sql`, `orm-family-mongo`, `orm-target-{postgres,sqlite,mongo}`), each re-exporting its internal workspace packages as subpath entrypoints. Workspace glob, tsdown/exports wiring.

- **Builds on:** — (first slice; base is the ADR 242 branch)
- **Hands to:** every internal module importable via a published-shell entrypoint; shells build green; publish list unchanged.

### 2. Facades, extension packs, bin shim — [TML-3122](https://linear.app/prisma-company/issue/TML-3122) · `slices/facades-extensions/`

`@prisma/orm-{postgres,sqlite,mongo}` facades (wiring + contract-surface re-exports + exact-pinned platform deps), 6 `@prisma/orm-extension-*` packs with peers repointed to target shells, shim relocated with ADR 211 invariants intact. Old names untouched; examples untouched.

- **Builds on:** 1
- **Hands to:** the complete 17-package surface exists and builds.

### 3. Emitter import roots — [TML-3123](https://linear.app/prisma-company/issue/TML-3123) · `slices/emitter-import-roots/`

Emitters write published names only: facade entrypoints by default, platform entrypoints in decomposed mode. Both modes tested; no-transitive-import audit; `contractHash` invariance.

- **Builds on:** 2 (facade entrypoints must resolve)
- **Hands to:** regeneration produces published-name imports.

### 4. Switchover — [TML-3124](https://linear.app/prisma-company/issue/TML-3124) · `slices/switchover/`

Atomic flip: privatize all non-`9-public` packages, publish workflow targets exactly the 9-public set, two-direction publishability lint + published-names-only import lint + shim drift-lint, examples/tests migrate to facades, decomposed-install proof, packed-tarball verification per family, upgrade instructions.

- **Builds on:** 3
- **Hands to:** publish dry-run lists exactly the ADR 242 surface; project DoD met except close-out docs.

## Sequencing

Stack: 1 → 2 → 3 → 4. No parallel groups — each slice consumes the previous hand-off. Within slice 3, platform-mode work can start once slice 1 merges if throughput demands it; not planned as a separate group.

## Dependencies

- **npm org readiness** (spec OQ 1): publish rights + provenance for the new `@prisma/orm-*` names. Blocks the actual publish, not any slice. Owner: operator.
- **`prisma` name succession** (spec OQ 2): shim publishes under interim name; no slice blocked.
- **ADR 242 PR [#29852](https://github.com/prisma/prisma/pull/29852)**: base of the working branch; must merge before slice PRs target `main`.

## Close-out (required)

- [ ] Verify all acceptance criteria in `spec.md`
- [ ] Rewrite `docs/reference/Package Naming Conventions.md`; amend ADR 211
- [ ] Migrate long-lived docs into `docs/`; strip repo-wide references to `projects/public-npm-surface/**`
- [ ] Final retro; delete `projects/public-npm-surface/`
