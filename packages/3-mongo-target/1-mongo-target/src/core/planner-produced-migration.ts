import type { MigrationPlanWithAuthoringSurface } from '@prisma-next/framework-components/control';
import { Migration, type MigrationMeta } from '@prisma-next/migration-tools/migration';
import type { AnyMongoMigrationOperation } from '@prisma-next/mongo-query-ast/control';
import type { OpFactoryCall } from './op-factory-call';
import { renderOps } from './render-ops';
import { renderCallsToTypeScript } from './render-typescript';

/**
 * Planner-produced Mongo migration, returned by `MongoMigrationPlanner.plan(...)`
 * and `MongoMigrationPlanner.emptyMigration(...)`.
 *
 * Unlike user-authored migrations (which extend `MongoMigration` from
 * `@prisma-next/family-mongo`), this class lives inside the target and holds
 * the richer authoring IR (`OpFactoryCall[]`) needed to render itself back to
 * TypeScript source. It implements `MigrationPlanWithAuthoringSurface` so
 * that the CLI can uniformly ask any planner result to serialize itself to a
 * `migration.ts`.
 *
 * It extends the framework `Migration` base directly and declares its own
 * `targetId` rather than inheriting `MongoMigration`, whose added value is
 * the lazily-built contract views a planner result never reads.
 */
export class PlannerProducedMongoMigration
  extends Migration<AnyMongoMigrationOperation>
  implements MigrationPlanWithAuthoringSurface
{
  readonly targetId = 'mongo' as const;

  constructor(
    private readonly calls: readonly OpFactoryCall[],
    private readonly meta: MigrationMeta,
    private readonly snapshotsImportPath: string,
  ) {
    super();
  }

  override get operations(): readonly AnyMongoMigrationOperation[] {
    return renderOps(this.calls);
  }

  override describe(): MigrationMeta {
    return this.meta;
  }

  renderTypeScript(): string {
    return renderCallsToTypeScript(this.calls, {
      from: this.meta.from,
      to: this.meta.to,
      snapshotsImportPath: this.snapshotsImportPath,
    });
  }
}
