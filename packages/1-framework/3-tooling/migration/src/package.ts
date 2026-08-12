import type {
  MigrationPackage,
  MigrationPlanOperation,
} from '@internal/framework-components/control';

export type MigrationOps = readonly MigrationPlanOperation[];

/**
 * Augmented form of the canonical {@link MigrationPackage} returned by
 * the on-disk readers (`readMigrationPackage`, `readMigrationsDir`).
 * Adds `dirPath` — the absolute path the package was loaded from — so
 * downstream diagnostics can point operators at a concrete directory.
 *
 * Holding an `OnDiskMigrationPackage` value implies the loader verified
 * the package's integrity (hash recomputation against the stored
 * `migrationHash`); the canonical structural shape carries no such
 * guarantee on its own.
 */
export interface OnDiskMigrationPackage extends MigrationPackage {
  readonly dirPath: string;
}
