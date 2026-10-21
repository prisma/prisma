import type { Contract } from '@internal/contract/types';
import type { TargetBoundComponentDescriptor } from '@internal/framework-components/components';
import type {
  ControlAdapterInstance,
  ControlDriverInstance,
  ControlExtensionDescriptor,
  ControlFamilyInstance,
  TargetMigrationsCapability,
} from '@internal/framework-components/control';
import type { SnapshotContentVerifier } from '@internal/migration-tools/contract-snapshot-store';
import { ifDefined } from '@internal/utils/defined';
import { errorStatementNeedsMigrationFile } from '../../utils/cli-errors';
import type { AnswerPlanQuestions } from '../statements/plan-questions';
import type { StatementText } from '../statements/statement-text';
import type { DbUpdateResult, OnControlProgress } from '../types';
import { executeRun } from './db-run';

export const DB_UPDATE_POLICY = {
  allowedOperationClasses: ['additive', 'widening', 'destructive'] as const,
} as const;

/**
 * Options for the `db update` operation.
 *
 * Same loader → planner → runner pipeline as `db init`, but with the
 * widened operation policy (additive + widening + destructive). An apply
 * asks `answerQuestions` what each operation that would lose data means and
 * whether each that would change access may run, before it applies anything.
 */
export interface ExecuteDbUpdateOptions<TFamilyId extends string, TTargetId extends string> {
  readonly driver: ControlDriverInstance<TFamilyId, TTargetId>;
  readonly adapter: ControlAdapterInstance<TFamilyId, TTargetId>;
  readonly familyInstance: ControlFamilyInstance<TFamilyId, unknown>;
  readonly contract: Contract;
  readonly mode: 'plan' | 'apply';
  readonly migrations: TargetMigrationsCapability<
    TFamilyId,
    TTargetId,
    ControlFamilyInstance<TFamilyId, unknown>
  >;
  readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<TFamilyId, TTargetId>>;
  /** Consents to every operation that would lose data, without asking. */
  readonly acceptDataLoss?: boolean;
  /** Consents to every operation that would change who can read or write data, without asking. */
  readonly acceptAccessChanges?: boolean;
  readonly migrationsDir: string;
  readonly targetId: TTargetId;
  /** The target's default namespace, which is never removed and never a rename's new name. */
  readonly defaultNamespaceId: string;
  readonly extensions?: ReadonlyArray<ControlExtensionDescriptor<TFamilyId, TTargetId>>;
  /** Content check for contract snapshots the aggregate loader resolves. */
  readonly verifySnapshotContent?: SnapshotContentVerifier;
  /**
   * The statements as the user wrote them, in the order given. A `rename` is planned; a `delete`
   * or `allow` answers the question about the subject it names. A `convert` or `backfill` fails
   * with `MIGRATION.STATEMENT_NEEDS_MIGRATION_FILE`: `db update` has no migration file to fill.
   */
  readonly statements?: readonly StatementText[];
  /** Asks the questions no statement answered; see {@link AnswerPlanQuestions}. */
  readonly answerQuestions: AnswerPlanQuestions;
  readonly onProgress?: OnControlProgress;
}

/** Execute `db update` against the configured contract. */
export async function executeDbUpdate<TFamilyId extends string, TTargetId extends string>(
  options: ExecuteDbUpdateOptions<TFamilyId, TTargetId>,
): Promise<DbUpdateResult> {
  const statements = options.statements ?? [];
  if (statements.some(({ verb }) => verb === 'convert' || verb === 'backfill')) {
    throw errorStatementNeedsMigrationFile(statements, undefined);
  }
  return (await executeRun<TFamilyId, TTargetId>({
    driver: options.driver,
    adapter: options.adapter,
    familyInstance: options.familyInstance,
    contract: options.contract,
    migrations: options.migrations,
    frameworkComponents: options.frameworkComponents,
    migrationsDir: options.migrationsDir,
    targetId: options.targetId,
    defaultNamespaceId: options.defaultNamespaceId,
    extensions: options.extensions ?? [],
    policy: DB_UPDATE_POLICY,
    action: 'dbUpdate',
    mode: options.mode,
    statements: options.statements ?? [],
    answerQuestions: options.answerQuestions,
    acceptDataLoss: options.acceptDataLoss ?? false,
    acceptAccessChanges: options.acceptAccessChanges ?? false,
    ...ifDefined('verifySnapshotContent', options.verifySnapshotContent),
    ...ifDefined('onProgress', options.onProgress),
  })) as DbUpdateResult;
}
