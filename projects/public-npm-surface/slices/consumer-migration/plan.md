# Slice: consumer migration and the flip — plan

**Issue:** [TML-3126](https://linear.app/prisma-company/issue/TML-3126) · **Branch:** `tml-3126-consumer-migration` (stacked on `tml-3123-emitter-import-roots`)

## Outcome

The emitter's default import root becomes `facade`, and every in-repo consumer moves to published names in the same commit. After this slice nothing in the repo imports an internal package name, which makes privatization mechanical.

## Why it is one commit, not several

A shell bundles a *copy* of each internal package's dist. The moment generated code names facade entrypoints while example source still names internals, every shared module exists twice in one process and `instanceof` / shared-registry identity breaks. Generated code and hand-written source must cross together.

## Order of work

1. **Unblock Mongo first.** Mongo migrations cannot be emitted under `facade` mode today: the scaffold emits three specifiers, and the facade republishes contract surfaces but neither the family migration base nor the CLI. Mirror the SQL targets — have `@prisma-next/target-mongo/migration` re-export `Migration` and `MigrationCLI` so the scaffold collapses to one specifier (the code already tracks this as a follow-up). This changes emitted Mongo output, so land it first, with its fixtures, as its own commit.
2. **Flip the default** to `facade`. Every call site already accepts a resolver; construct with `createImportSpecifierResolver` and thread it through `EmitOptions`, `RenderMigrationMeta`, and the init templates. Check all six init call sites — two used the default as of TML-3123.
3. **Publish the mapping table.** Wiring a real resolver into the CLI/emitter makes `@prisma-next/publish-surface` a production dependency, and `validateShellManifest` will fail the shell build until it is mapped into `@prisma/orm-toolchain`. Expect that failure; it is the guardrail working. Then decide what the tarball baseline lock says about names the table legitimately carries **as data** rather than as import specifiers — the current check cannot tell the difference, and absorbing ~50 entries into the allowlist would gut its value. Prefer teaching the check to distinguish the table's data from emitted specifiers.
4. **Migrate consumers**: `examples/*` source imports and `package.json` deps; `test/integration` and `test/e2e` fixtures and installs; `init`'s scaffolded dependencies.
5. **Regenerate fixtures**: `pnpm fixtures:emit`, plus the seven emitted fixtures outside its glob (listed on the Linear issue) and `**/migration.ts`, which `fixtures:check` does not cover.

## Done when

- Default emitted output names published packages only; no in-repo source or fixture imports an internal name (verified by repo-wide grep, not by spot check).
- Every example builds, type-checks, and passes its tests against the facade surface.
- `test/integration` and `test/e2e` pass.
- `init` scaffolds a facade dependency, and the scaffolded project can run its own migrations end to end (the init journey e2e is the check that previously caught this).
- Module identity holds: no example loads two copies of a shared module. Assert it, do not assume it — the failure is silent.
- `knownInternalNamesInDist` shrinks; the entries that remain are explained.
- Repo CI green, including the Coverage job.

## Risks

- **Silent identity breakage is the main hazard.** Everything can compile and pass unit tests while two copies of a registry exist. The identity assertion is the slice's most important test.
- **Diff size**: mechanical rewrites plus regenerated fixtures will dominate. Keep logic changes (step 1, step 3) in separate commits from the mechanical migration so review can separate them.
- **The examples are the real acceptance test** for the facade surface. If an example needs an entrypoint the facade does not expose, that is a finding about the published surface, not a reason to reach for an internal name — report it rather than working around it.
