import type { ContractMarkerRecord } from '@internal/contract/types';
import {
  type MigrationOperationPolicy,
  runnerFailure,
  runnerSuccess,
  type SqlControlFamilyInstance,
  type SqlMigrationPlanContractInfo,
  type SqlMigrationPlanOperationStep,
  type SqlMigrationRunner,
  type SqlMigrationRunnerExecuteOptions,
  type SqlMigrationRunnerFailure,
  type SqlMigrationRunnerResult,
  type SqlMigrationRunnerSuccessValue,
} from '@internal/family-sql/control';
import {
  failedPostcheckWhy,
  failedPrecheckWhy,
  type MigrationRunnerResult,
  schemaCheckWhy,
  withDatabaseUnchanged,
  withFailingSpace,
} from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { InternalError } from '@internal/utils/internal-error';
import { notOk, ok, okVoid, type Result } from '@internal/utils/result';
import { mysqlError } from '../errors';
import { acquireMarkerLock, releaseMarkerLock } from '../marker-lock';
import type { Op } from './operations';
import type { MysqlPlanTargetDetails } from './planner-target-details';

type Options = SqlMigrationRunnerExecuteOptions<MysqlPlanTargetDetails>;
type Driver = SqlControlDriverInstance<string>;
type Checked = Result<void, SqlMigrationRunnerFailure>;

interface AppliedOperations {
  readonly result: Checked;
  readonly executed: readonly Op[];
  readonly executedCount: number;
  readonly changedDatabase: boolean;
}

/** A space's apply, and whether it changed the database before it ended. */
interface SpaceOutcome {
  readonly result: SqlMigrationRunnerResult;
  readonly changedDatabase: boolean;
}

function stepHolds(rows: readonly Record<string, unknown>[]): boolean {
  const value = rows[0] === undefined ? undefined : Object.values(rows[0])[0];
  if (typeof value === 'string') return value !== '0' && value.length > 0;
  return Boolean(value);
}

function skipRecord(operation: Op): Op {
  return Object.freeze({
    id: operation.id,
    label: operation.label,
    ...ifDefined('summary', operation.summary),
    operationClass: operation.operationClass,
    target: operation.target,
    precheck: Object.freeze([]),
    execute: Object.freeze([]),
    postcheck: Object.freeze([...operation.postcheck]),
    meta: Object.freeze({
      ...(operation.meta ?? {}),
      runner: Object.freeze({ skipped: true, reason: 'postcheck_pre_satisfied' }),
    }),
  });
}

/**
 * The MySQL migration runner. MySQL commits every DDL statement as it runs, so no transaction can undo an apply: the runner applies one space at a time, checks each operation before and after it runs, verifies the space's schema, and only then writes the space's marker and ledger entries, in one transaction. A failure leaves the spaces before it applied, and running the apply again skips what already holds. The whole apply holds the marker lock, which MySQL keeps for the session, so it is released on the same connection when the apply ends.
 */
class MysqlMigrationRunner implements SqlMigrationRunner<MysqlPlanTargetDetails> {
  constructor(private readonly family: SqlControlFamilyInstance) {}

  async execute(options: {
    readonly driver: Driver;
    readonly perSpaceOptions: ReadonlyArray<Options>;
  }): Promise<MigrationRunnerResult> {
    const { driver, perSpaceOptions } = options;
    if (perSpaceOptions.length === 0) return ok({ perSpaceResults: [] });
    await acquireMarkerLock(driver);
    try {
      const perSpaceResults: { space: string; value: SqlMigrationRunnerSuccessValue }[] = [];
      let changedBefore = false;
      for (const spaceOptions of perSpaceOptions) {
        const space = spaceOptions.space ?? spaceOptions.plan.spaceId;
        const { result, changedDatabase } = await this.#applySpace({
          ...spaceOptions,
          driver,
          space,
        });
        if (!result.ok) {
          return notOk(
            withFailingSpace(
              withDatabaseUnchanged(result.failure, !changedBefore && !changedDatabase),
              space,
            ),
          );
        }
        changedBefore ||= changedDatabase;
        perSpaceResults.push({ space, value: result.value });
      }
      return ok({ perSpaceResults });
    } finally {
      await releaseMarkerLock(driver);
    }
  }

  async executeOnConnection(options: Options): Promise<SqlMigrationRunnerResult> {
    return (await this.#applySpace(options)).result;
  }

  async #applySpace(options: Options): Promise<SpaceOutcome> {
    const { driver } = options;
    if (options.space !== undefined && options.space !== options.plan.spaceId) {
      throw mysqlError(
        'MIGRATION.CONTRACT_SPACE_VIOLATION',
        `SqlMigrationRunner: options.space (${options.space}) does not match plan.spaceId (${options.plan.spaceId})`,
        { meta: { space: options.space, planSpaceId: options.plan.spaceId } },
      );
    }
    const space = options.plan.spaceId;
    const unchanged = (result: SqlMigrationRunnerResult): SpaceOutcome => ({
      result,
      changedDatabase: false,
    });
    const operations = blindCast<
      readonly Op[],
      'the MySQL planner and migration class produce MySQL operations; MigrationPlan.operations uses the wider framework type to admit promises'
    >(await Promise.all(options.plan.operations));

    const destinationCheck = this.#checkDestination(
      options.plan.destination,
      options.destinationContract,
    );
    if (!destinationCheck.ok) return unchanged(destinationCheck);
    const policyCheck = this.#checkPolicy(options.policy, operations);
    if (!policyCheck.ok) return unchanged(policyCheck);

    await this.#ensureControlTables(driver, options);
    const existingMarker = await this.family.readMarker({ driver, space });
    const originCheck = this.#checkOrigin(existingMarker, options.plan.origin ?? null);
    if (!originCheck.ok) return unchanged(originCheck);

    const isSelfEdge = options.plan.origin?.storageHash === options.plan.destination.storageHash;
    const atDestination =
      existingMarker !== null &&
      existingMarker.storageHash === options.plan.destination.storageHash &&
      (options.plan.destination.profileHash === undefined ||
        existingMarker.profileHash === options.plan.destination.profileHash);
    const skipOperations = atDestination && options.plan.origin != null && !isSelfEdge;

    const applied: AppliedOperations = skipOperations
      ? { result: okVoid(), executed: [], executedCount: 0, changedDatabase: false }
      : await this.#applyOperations(driver, options, operations);
    const { changedDatabase } = applied;
    if (!applied.result.ok) return { result: applied.result, changedDatabase };

    const schema = await this.family.introspect({ driver, contract: options.destinationContract });
    const verified = this.family.verifySchema({
      contract: options.destinationContract,
      schema,
      strict: options.strictVerification ?? true,
      frameworkComponents: options.frameworkComponents,
    });
    if (!verified.ok) {
      return {
        result: runnerFailure('MIGRATION.SCHEMA_VERIFY_FAILED', verified.summary, {
          why: schemaCheckWhy(verified.schema.issues),
          meta: { schemaIssues: verified.schema.issues },
        }),
        changedDatabase,
      };
    }

    const existingInvariants = new Set(existingMarker?.invariants ?? []);
    const isSelfEdgeNoOp =
      isSelfEdge &&
      applied.executedCount === 0 &&
      options.plan.providedInvariants.every((id) => existingInvariants.has(id));
    if (!isSelfEdgeNoOp) {
      const written = await this.#writeMarkerAndLedger(
        driver,
        options,
        existingMarker,
        applied.executed,
      );
      if (!written.ok) return { result: written, changedDatabase };
    }
    return {
      result: runnerSuccess({
        operationsPlanned: operations.length,
        operationsExecuted: applied.executedCount,
      }),
      changedDatabase: changedDatabase || !isSelfEdgeNoOp,
    };
  }

  async #ensureControlTables(driver: Driver, options: Options): Promise<void> {
    for (const query of this.family.bootstrapControlTableQueries()) {
      const statement = await this.family.lowerAst(query, {
        contract: options.destinationContract,
      });
      await driver.query(statement.sql, statement.params);
    }
  }

  async #applyOperations(
    driver: Driver,
    options: Options,
    operations: readonly Op[],
  ): Promise<AppliedOperations> {
    const checks = options.executionChecks;
    const runPrechecks = checks?.prechecks !== false;
    const runPostchecks = checks?.postchecks !== false;
    const runIdempotency = checks?.idempotencyChecks !== false;
    const executed: Op[] = [];
    let executedCount = 0;
    let changedDatabase = false;
    const stop = (result: Checked): AppliedOperations => ({
      result,
      executed,
      executedCount,
      changedDatabase,
    });
    for (const operation of operations) {
      options.callbacks?.onOperationStart?.(operation);
      try {
        if (runPostchecks && runIdempotency && (await this.#allHold(driver, operation.postcheck))) {
          executed.push(skipRecord(operation));
          continue;
        }
        if (runPrechecks) {
          const precheck = await this.#runChecks(driver, operation, 'precheck');
          if (!precheck.ok) return stop(precheck);
        }
        const execution = await this.#runSteps(driver, operation);
        changedDatabase ||= execution.ran;
        if (!execution.result.ok) return stop(execution.result);
        executedCount += 1;
        if (runPostchecks) {
          const postcheck = await this.#runChecks(driver, operation, 'postcheck');
          if (!postcheck.ok) return stop(postcheck);
        }
        executed.push(operation);
      } finally {
        options.callbacks?.onOperationComplete?.(operation);
      }
    }
    return stop(okVoid());
  }

  async #allHold(
    driver: Driver,
    steps: readonly SqlMigrationPlanOperationStep[],
  ): Promise<boolean> {
    if (steps.length === 0) return false;
    for (const step of steps) {
      if (!stepHolds((await driver.query(step.sql, step.params ?? [])).rows)) return false;
    }
    return true;
  }

  async #runChecks(
    driver: Driver,
    operation: Op,
    phase: 'precheck' | 'postcheck',
  ): Promise<Checked> {
    for (const step of operation[phase]) {
      if (stepHolds((await driver.query(step.sql, step.params ?? [])).rows)) continue;
      const failedCheck = {
        operationId: operation.id,
        phase,
        description: step.description,
        ...ifDefined('expectation', step.expectation),
      };
      return runnerFailure(
        phase === 'precheck' ? 'MIGRATION.PRECHECK_FAILED' : 'MIGRATION.POSTCHECK_FAILED',
        `Operation ${operation.id} failed during ${phase}: ${step.description}`,
        {
          why:
            phase === 'precheck' ? failedPrecheckWhy(failedCheck) : failedPostcheckWhy(failedCheck),
          meta: { failedCheck },
        },
      );
    }
    return okVoid();
  }

  /** Runs an operation's steps. `ran` says whether any step reached the database, which a DDL statement changes for good. */
  async #runSteps(
    driver: Driver,
    operation: Op,
  ): Promise<{ readonly result: Checked; readonly ran: boolean }> {
    let ran = false;
    for (const step of operation.execute) {
      try {
        await driver.query(step.sql, step.params ?? []);
        ran = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ran,
          result: runnerFailure(
            'MIGRATION.EXECUTION_FAILED',
            `Operation ${operation.id} failed during execution: ${step.description}`,
            {
              why: message,
              meta: { operationId: operation.id, stepDescription: step.description, sql: step.sql },
            },
          ),
        };
      }
    }
    return { result: okVoid(), ran };
  }

  async #writeMarkerAndLedger(
    driver: Driver,
    options: Options,
    existingMarker: ContractMarkerRecord | null,
    executed: readonly Op[],
  ): Promise<Checked> {
    const { plan } = options;
    const destination = {
      storageHash: plan.destination.storageHash,
      profileHash:
        plan.destination.profileHash ??
        options.destinationContract.profileHash ??
        plan.destination.storageHash,
      invariants: plan.providedInvariants,
    };
    await driver.query('START TRANSACTION');
    try {
      if (existingMarker === null) {
        await this.family.initMarker({ driver, space: plan.spaceId, destination });
      } else {
        const swapped = await this.family.updateMarker({
          driver,
          space: plan.spaceId,
          expectedFrom: existingMarker.storageHash,
          destination,
        });
        if (!swapped) {
          await driver.query('ROLLBACK');
          const found = await this.family.readMarker({ driver, space: plan.spaceId });
          return runnerFailure(
            'MIGRATION.MARKER_CAS_FAILURE',
            'Marker was modified by another process during migration execution.',
            {
              meta: {
                space: plan.spaceId,
                expectedStorageHash: existingMarker.storageHash,
                foundStorageHash: found?.storageHash ?? null,
                destinationStorageHash: plan.destination.storageHash,
              },
            },
          );
        }
      }
      await this.#writeLedger(driver, options, executed);
    } catch (error) {
      await driver.query('ROLLBACK');
      throw error;
    }
    await driver.query('COMMIT');
    return okVoid();
  }

  async #writeLedger(driver: Driver, options: Options, executed: readonly Op[]): Promise<void> {
    const { plan, migrationEdges } = options;
    const edgeOperations = migrationEdges.reduce((sum, edge) => sum + edge.operationCount, 0);
    if (edgeOperations !== plan.operations.length) {
      throw new InternalError(
        `Ledger write: plan.operations length (${plan.operations.length}) does not match sum of migrationEdges operationCount (${edgeOperations})`,
      );
    }
    let offset = 0;
    for (const edge of migrationEdges) {
      const operations = executed.slice(offset, offset + edge.operationCount);
      offset += edge.operationCount;
      await this.family.writeLedgerEntry({
        driver,
        space: plan.spaceId,
        entry: {
          edgeId: `${edge.from}->${edge.to}`,
          from: edge.from,
          to: edge.to,
          migrationName: edge.dirName,
          migrationHash: edge.migrationHash,
          operations,
        },
      });
    }
  }

  #checkDestination(
    destination: SqlMigrationPlanContractInfo,
    contract: Options['destinationContract'],
  ): Checked {
    if (destination.storageHash !== contract.storage.storageHash) {
      return runnerFailure(
        'MIGRATION.DESTINATION_CONTRACT_MISMATCH',
        `Plan destination storage hash (${destination.storageHash}) does not match provided contract storage hash (${contract.storage.storageHash}).`,
        {
          meta: {
            planStorageHash: destination.storageHash,
            contractStorageHash: contract.storage.storageHash,
          },
        },
      );
    }
    if (
      destination.profileHash !== undefined &&
      contract.profileHash !== undefined &&
      destination.profileHash !== contract.profileHash
    ) {
      return runnerFailure(
        'MIGRATION.DESTINATION_CONTRACT_MISMATCH',
        `Plan destination profile hash (${destination.profileHash}) does not match provided contract profile hash (${contract.profileHash}).`,
        {
          meta: {
            planProfileHash: destination.profileHash,
            contractProfileHash: contract.profileHash,
          },
        },
      );
    }
    return okVoid();
  }

  #checkPolicy(policy: MigrationOperationPolicy, operations: readonly Op[]): Checked {
    const allowed = new Set(policy.allowedOperationClasses);
    const refused = operations.find((operation) => !allowed.has(operation.operationClass));
    if (refused === undefined) return okVoid();
    return runnerFailure(
      'MIGRATION.POLICY_VIOLATION',
      `Operation ${refused.id} has class "${refused.operationClass}" which is not allowed by policy.`,
      {
        why: `Policy only allows: ${policy.allowedOperationClasses.join(', ')}.`,
        meta: {
          operationId: refused.id,
          operationClass: refused.operationClass,
          allowedClasses: policy.allowedOperationClasses,
        },
      },
    );
  }

  #checkOrigin(
    marker: ContractMarkerRecord | null,
    origin: SqlMigrationPlanContractInfo | null,
  ): Checked {
    if (origin === null) return okVoid();
    if (marker === null) {
      return runnerFailure(
        'MIGRATION.MARKER_ORIGIN_MISMATCH',
        `Missing contract marker: expected origin storage hash ${origin.storageHash}.`,
        { meta: { expectedOriginStorageHash: origin.storageHash } },
      );
    }
    if (marker.storageHash !== origin.storageHash) {
      return runnerFailure(
        'MIGRATION.MARKER_ORIGIN_MISMATCH',
        `Existing contract marker (${marker.storageHash}) does not match plan origin (${origin.storageHash}).`,
        {
          meta: {
            markerStorageHash: marker.storageHash,
            expectedOriginStorageHash: origin.storageHash,
          },
        },
      );
    }
    if (origin.profileHash !== undefined && marker.profileHash !== origin.profileHash) {
      return runnerFailure(
        'MIGRATION.MARKER_ORIGIN_MISMATCH',
        `Existing contract marker profile hash (${marker.profileHash}) does not match plan origin profile hash (${origin.profileHash}).`,
        {
          meta: {
            markerProfileHash: marker.profileHash,
            expectedOriginProfileHash: origin.profileHash,
          },
        },
      );
    }
    return okVoid();
  }
}

export function createMysqlMigrationRunner(
  family: SqlControlFamilyInstance,
): SqlMigrationRunner<MysqlPlanTargetDetails> {
  return new MysqlMigrationRunner(family);
}
