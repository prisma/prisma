# Slice: emitter import roots become configurable — plan

**Issue:** [TML-3123](https://linear.app/prisma-company/issue/TML-3123) · **Branch:** `tml-3123-emitter-import-roots` (stacked on `tml-3122-facades-extensions`)

## Outcome

Every place that writes a package name into user code resolves that name through one configurable import-root mode. All three modes are proven by test. The default is unchanged, so the repo behaves exactly as it does today.

## Why the default must not flip here

An example's generated contract imports `@prisma-next/sql-contract/types`; the same example's source imports `@prisma-next/sql-contract`. A shell bundles a *copy* of each internal package's dist, so pointing generated code at facade entrypoints while example source still points at internals puts two copies of every shared SQL module in one process — losing `instanceof` and shared-registry identity, the failure this project exists to prevent. The flip is only safe once every in-repo consumer moves, which is [TML-3126](https://linear.app/prisma-company/issue/TML-3126).

## Scope

**One source of truth.** `publicSpecifier()` in `packages/0-config/tsdown/shell-build.ts`, driven by `shells.ts`. Import it; do not duplicate the mapping. If the emitter cannot depend on a build-config package, move the mapping to a package both can consume rather than copying it.

**Three modes.**

| Mode | Emits | For |
|---|---|---|
| `internal` (default) | `@prisma-next/sql-contract/types` | today's behavior; unchanged until TML-3126 |
| `facade` | `@prisma/orm-postgres/family-contract/types` | apps that installed one facade |
| `platform` | `@prisma/orm-family-sql/contract/types` | decomposed installs |

**Call sites to parameterize.**

- Framework, SQL, and Mongo emitters (contract and type emission).
- Targets' emitted-migration roots: `packages/3-targets/3-targets/postgres/src/core/migrations/render-typescript.ts:45-48` (`BASE_IMPORTS`) and `op-factory-call.ts:112` (`POSTGRES_MIGRATION_FACADE`, 8 call sites), plus SQLite and Mongo equivalents. `RenderMigrationMeta` has no import-root field today — it needs one.
- CLI `init` templates: `packages/1-framework/3-tooling/cli/src/commands/init/templates/code-templates.ts` (~lines 7, 161, 201, 254, 265, 307).

## Done when

- Each of the three modes emits the expected specifier for every emitted artifact kind (contract types, migration files, init templates), covered by test.
- **No-transitive-import audit**: for each mode, nothing emitted names a package the target application would not directly depend on. This is the cross-cutting requirement the whole slice serves.
- `contractHash` is unchanged across modes — the import rename must not perturb the contract identity.
- Default output is byte-identical to today: existing fixtures do not regenerate, examples and integration tests are untouched, repo CI green.
- No mapping is duplicated: the emitter and the shell build resolve names through the same table.

## Risks

- **The emitter may not be able to import from `packages/0-config/tsdown`** (a build-config package). If so, the mapping moves to a shared location both consume — do not fork it.
- **`contractHash` invariance** is an assumption to verify early: if the hash covers emitted import text, the mode would change the hash and the design needs revisiting before the rest is built.
- Mongo's emitted-migration path may differ in shape from the SQL targets; check before assuming symmetry.
