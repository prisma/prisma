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

### 3. Emitter import roots become configurable — [TML-3123](https://linear.app/prisma-company/issue/TML-3123) · `slices/emitter-import-roots/`

Every place that writes a package name into user code — the framework/SQL/Mongo emitters, the targets' hardcoded emitted-migration roots, the CLI's `init` templates — takes its import root from one configurable source (`publicSpecifier()`/`shells.ts`). All three modes (facade, platform, internal) are tested, with a no-transitive-import audit and `contractHash` invariance across the rename.

**The default stays internal.** Flipping it here would break the repo: an example's generated contract would import facade entrypoints while the example's own source imports internals, loading two copies of every shared module — the precise failure this project exists to prevent.

- **Builds on:** 2 (facade entrypoints must resolve)
- **Hands to:** a single switch that changes every emitted import root, proven in all three modes.

### 4. Consumer migration and the flip — [TML-3126](https://linear.app/prisma-company/issue/TML-3126) · `slices/consumer-migration/`

Flip the emitter default to facade mode and migrate every in-repo consumer in the same commit: examples, `test/integration`, `test/e2e`, and `init`'s scaffolded dependencies all move to published names; fixtures and generated artifacts regenerate. After this slice nothing in-repo imports an internal package name.

- **Builds on:** 3
- **Hands to:** the repo runs entirely on published names, so privatization becomes mechanical.

### 5. Switchover — [TML-3124](https://linear.app/prisma-company/issue/TML-3124) · `slices/switchover/`

Privatize all non-`9-public` packages, point the publish workflow at exactly the 9-public set, land the two-direction publishability lint + published-names-only import lint + shim drift-lint, sweep the internal-name baseline (diagnostics, config-validation, telemetry), add the decomposed-install proof and packed-tarball verification per family, record upgrade instructions.

- **Builds on:** 4
- **Hands to:** publish dry-run lists exactly the ADR 242 surface; project DoD met except close-out docs.

## Sequencing

Stack: 1 → 2 → 3 → 4 → 5. No parallel groups — each slice consumes the previous hand-off.

Five slices exceeds the 1–4 guideline. The extra slice came from a sequencing constraint discovered during delivery rather than from scope growth: the emitter's *capability* and the *flip* of its default cannot land together, because the flip is only safe once every in-repo consumer has moved. Splitting them keeps each slice reviewable in one sitting and keeps every intermediate commit green.

## Dependencies

- **npm org readiness** (spec OQ 1): publish rights + provenance for the new `@prisma/orm-*` names. Blocks the actual publish, not any slice. Owner: operator.
- **`prisma` name succession** (spec OQ 2): shim publishes under interim name; no slice blocked.
- **ADR 242 PR [#29852](https://github.com/prisma/prisma/pull/29852)**: base of the working branch; must merge before slice PRs target `main`.

## Close-out (required)

- [ ] Verify all acceptance criteria in `spec.md`
- [ ] Rewrite `docs/reference/Package Naming Conventions.md`; amend ADR 211
- [ ] Migrate long-lived docs into `docs/`; strip repo-wide references to `projects/public-npm-surface/**`
- [ ] Final retro; delete `projects/public-npm-surface/`
