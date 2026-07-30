// Re-exported so a Mongo `migration.ts` only needs the single
// `@prisma-next/target-mongo/migration` import for its base class and the
// CLI entrypoint, mirroring the Postgres and SQLite targets. The renderer
// emits the entrypoint call as `MigrationCLI.run(import.meta.url, M)`.
export { MigrationCLI } from '@prisma-next/cli/migration-cli';
// Re-exported so user-edited migration.ts files only need to depend on
// `@prisma-next/target-mongo/migration` to fill in planner-emitted
// `placeholder("…")` slots, instead of pulling in `@prisma-next/errors`
// directly. The planner emits an import from this same module.
export { placeholder } from '@prisma-next/errors/migration';
// The user-facing Mongo migration base lives in the family package rather
// than here, because the family owns `targetId` and the contract views. It
// is forwarded so the scaffold names one package instead of two.
export { Migration } from '@prisma-next/family-mongo/migration';
export {
  collMod,
  createCollection,
  createIndex,
  dataTransform,
  dropCollection,
  dropIndex,
  setValidation,
  validatedCollection,
} from '../core/migration-factories';
