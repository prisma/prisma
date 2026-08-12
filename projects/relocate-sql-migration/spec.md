# Relocate `sql-migration.ts` into `core/migrations/`

## Summary

Move `packages/2-sql/9-family/src/core/sql-migration.ts` into the sibling `core/migrations/` directory, then register that directory as `plane: migration` in `architecture.config.json`. This resolves a latent shared→migration plane violation (the file imports `Migration` from migration-plane `@internal/migration-tools/migration` from a shared-plane home) without introducing any new abstractions.

## Context

- `packages/2-sql/9-family/src/core/**` is currently registered as `{ domain: sql, layer: family, plane: shared }` (`architecture.config.json:87-92`).
- `core/sql-migration.ts:1` imports `Migration` from `@internal/migration-tools/migration`, which is a migration-plane package (`packages/1-framework/3-tooling/**` → `plane: migration`, `architecture.config.json:46-50`).
- Plane rules forbid shared→migration (`architecture.config.json:521-525`). This import is a real violation; it isn't caught today because dep-cruiser's matching tolerates a subpath re-export path the validator doesn't fully resolve. The fix makes the code honest about its plane rather than relying on that gap.
- The sibling directory `packages/2-sql/9-family/src/core/migrations/` already houses control-plane (migration-plane intent) code: `contract-to-schema-ir.ts`, `descriptor-schemas.ts`, `operation-descriptors.ts`, `plan-helpers.ts`, `policies.ts`, `types.ts`. It is currently registered as shared (inherited from the `src/core/**` glob), so moving the file there is not sufficient on its own — the directory itself needs an explicit migration-plane registration.

The file is imported from exactly one place: `packages/2-sql/9-family/src/exports/migration.ts:1` re-exports it as `Migration`.

## Changes

1. **Move the file**

   - `packages/2-sql/9-family/src/core/sql-migration.ts` → `packages/2-sql/9-family/src/core/migrations/sql-migration.ts`.
   - Update the internal import in the file — the relative type import currently reads `from './migrations/types'`; after the move it becomes `from './types'`.

2. **Update the one consumer**

   - `packages/2-sql/9-family/src/exports/migration.ts:1` — change
     `export { SqlMigration as Migration } from '../core/sql-migration';`
     to
     `export { SqlMigration as Migration } from '../core/migrations/sql-migration';`.

3. **Register `core/migrations/**` as migration plane**

   In `architecture.config.json`, add a new entry after the existing `packages/2-sql/9-family/src/core/**` entry (more-specific glob wins at consumer-config level; see Open questions):

   ```json
   {
     "glob": "packages/2-sql/9-family/src/core/migrations/**",
     "domain": "sql",
     "layer": "family",
     "plane": "migration"
   }
   ```

4. **Verify the other files under `core/migrations/` are plane-compatible**

   The existing files in `core/migrations/` (`contract-to-schema-ir.ts`, `descriptor-schemas.ts`, `operation-descriptors.ts`, `plan-helpers.ts`, `policies.ts`, `types.ts`) are control-plane by intent, so re-registering the directory as migration plane should be a no-op or a correction. If any of them import from runtime-plane packages, that's a pre-existing latent violation surfaced by this change — fix it or flag it here (do not suppress).

## Acceptance criteria

- `sql-migration.ts` lives at `packages/2-sql/9-family/src/core/migrations/sql-migration.ts`.
- No file references `../core/sql-migration` or `./sql-migration` outside the new location.
- `architecture.config.json` includes the new `core/migrations/**` migration-plane entry.
- `pnpm dep-cruise` (or the repo-standard dependency-validation command) reports zero plane violations in `packages/2-sql/9-family/`.
- `pnpm -F @internal/family-sql build` and `pnpm -F @internal/family-sql typecheck` pass.
- The re-export at `src/exports/migration.ts` still exposes `SqlMigration` as `Migration` — no public-API change.

## Out of scope

- Splitting `Migration` into an abstract authoring class vs. a `run()` orchestrator. That is a separate, larger refactor (see `projects/migration-control-adapter-di/spec.md`). This spec addresses only the misplaced file.
- Any change to `@internal/migration-tools` or its exports.
- Renaming `SqlMigration` or its public `Migration` alias.

## Open questions

1. **Glob precedence in `architecture.config.json`.** `dependency-cruiser.config.mjs` builds one module group per `domain-layer-plane` triple and unions all matching globs into each group's regex. A file at `src/core/migrations/**` would match *both* the `src/core/**` (shared) group and the new `src/core/migrations/**` (migration) group, so every rule from both groups would be evaluated against it. Two possible fixes:
   - (a) Adjust `dependency-cruiser.config.mjs` to resolve each source file to its most-specific glob and place it in exactly one group.
   - (b) Rewrite the existing `src/core/**` glob to exclude the migrations subtree (`src/core/!(migrations)/**` or similar) so the two patterns are mutually exclusive by construction.

   Option (a) is the more principled fix and benefits all target packages with similar splits; option (b) is a local patch. Pick (a) if touching the config loader is acceptable in this PR; otherwise (b).
