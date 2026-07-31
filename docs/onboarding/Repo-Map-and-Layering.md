# Repo Map & Layering

- See `architecture.config.json` for domain/layer/plane mapping.
- Import rules: `.cursor/rules/import-validation.mdc` and `scripts/check-imports.mjs`.
- Legacy packages: marked in `architecture.config.json` with notes; avoid adding new deps to legacy.

## Planes and target package layout

Planes (`migration` / `runtime` / `shared`) cut across the directory hierarchy and are enforced by `dependency-cruiser` against the globs in `architecture.config.json`. Cross-plane rules: `migration → runtime` is **forbidden**; `runtime → migration` is allowed for artifacts only (e.g. compiled query plans, contract IR); `shared → *` is allowed.

Target packages (`@internal/target-*`) split their `src/core/` along this boundary:

- `src/core/migrations/**` — migration plane. Planner, emitter, operation factories, resolver, TS rendering. Executed at `node migration.ts` time and at `migration plan` / `migrate`.
- `src/core/**` (everything else) — shared plane. Files used from both migration and runtime entrypoints (`authoring.ts`, `descriptor-meta.ts`, `types.ts`, …).
- `src/exports/control.ts` — migration-plane export.
- `src/exports/runtime.ts` — runtime-plane export.
- `src/exports/pack.ts` — shared-plane export.

The intent is that target migration code is **plainly control-plane** and should not be allowed to import from runtime-plane packages (e.g. `@internal/sql-runtime`, family runtime adapters). Putting migration code under a shared- or unregistered glob hides plane violations from CI; explicit migration-plane registration surfaces them.

### Glob resolution

`dependency-cruiser.config.mjs` resolves overlapping globs by **most-specific wins**: each source file is placed in exactly the module group corresponding to its longest-matching glob. So a target whose `architecture.config.json` registers both `src/core/**` (shared) and `src/core/migrations/**` (migration) places files under `migrations/` in the migration group only — not in both. Author globs from broad-to-specific; the resolver picks the right one.

### When adding a new target package

1. Register `src/exports/runtime.ts` as `plane: runtime`.
2. Register `src/exports/control.ts` as `plane: migration` (and `pack.ts` as `plane: shared` if the target has one).
3. Register `src/core/**` as `plane: shared`.
4. Register `src/core/migrations/**` as `plane: migration` *even if the directory does not exist yet* — keeps target registrations symmetric and prevents code added later from inheriting the shared registration by accident.
