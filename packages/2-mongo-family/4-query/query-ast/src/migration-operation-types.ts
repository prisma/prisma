import type {
  MigrationOperationClass,
  MigrationPlanOperation,
} from '@internal/framework-components/control';
import type { AnyMongoDdlCommand } from './ddl-commands';
import type { MongoFilterExpr } from './filter-expressions';
import type { AnyMongoInspectionCommand } from './inspection-commands';
import type { MongoQueryPlan } from './query-plan';

export interface MongoMigrationCheck {
  readonly description: string;
  readonly source: AnyMongoInspectionCommand;
  readonly filter: MongoFilterExpr;
  readonly expect: 'exists' | 'notExists';
}

export interface MongoMigrationStep {
  readonly description: string;
  readonly command: AnyMongoDdlCommand;
}

export interface MongoMigrationPlanOperation extends MigrationPlanOperation {
  readonly precheck: readonly MongoMigrationCheck[];
  readonly execute: readonly MongoMigrationStep[];
  readonly postcheck: readonly MongoMigrationCheck[];
}

export interface MongoDataTransformCheck {
  readonly description: string;
  readonly source: MongoQueryPlan;
  readonly filter: MongoFilterExpr;
  readonly expect: 'exists' | 'notExists';
}

export interface MongoDataTransformOperation extends MigrationPlanOperation {
  readonly operationClass: 'data';
  /**
   * Human-readable label for this data transform.
   */
  readonly name: string;
  /**
   * Optional opt-in routing identity. Presence opts the transform into
   * invariant-aware routing; absence means the transform is
   * path-dependent and not referenceable from refs.
   */
  readonly invariantId?: string;
  readonly precheck: readonly MongoDataTransformCheck[];
  readonly run: readonly MongoQueryPlan[];
  readonly postcheck: readonly MongoDataTransformCheck[];
}

export type AnyMongoMigrationOperation = MongoMigrationPlanOperation | MongoDataTransformOperation;

export type { MigrationOperationClass, MigrationPlanOperation };
