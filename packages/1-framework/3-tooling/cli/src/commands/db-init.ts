import { ifDefined } from '@internal/utils/defined';
import { assertNever } from '@internal/utils/internal-error';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { Command } from 'commander';
import {
  type RefAdvancementFields,
  resolveRefAdvancementFields,
} from '../control-api/operations/ref-advancement';
import type { DbInitFailure } from '../control-api/types';
import {
  CliStructuredError,
  errorContractValidationFailed,
  errorMigrationPlanningFailed,
  errorRunnerFailed,
  errorRuntime,
  errorUnexpected,
} from '../utils/cli-errors';
import type { MigrationCommandOptions } from '../utils/command-helpers';
import {
  resolveMigrationPaths,
  sanitizeErrorMessage,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import {
  formatMigrationApplyOutput,
  formatMigrationJson,
  formatMigrationPlanOutput,
  type MigrationCommandResult,
} from '../utils/formatters/migrations';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import {
  addMigrationCommandOptions,
  prepareMigrationContext,
} from '../utils/migration-command-scaffold';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface DbInitOptions extends MigrationCommandOptions {
  readonly advanceRef?: string;
}

/**
 * Maps a DbInitFailure to a CliStructuredError for consistent error handling.
 */
function mapDbInitFailure(failure: DbInitFailure): CliStructuredError {
  if (failure.code === 'PLANNING_FAILED') {
    return errorMigrationPlanningFailed({ conflicts: failure.conflicts ?? [] });
  }

  if (failure.code === 'MIGRATION.MARKER_ORIGIN_MISMATCH') {
    const mismatchParts: string[] = [];
    if (
      failure.marker?.storageHash !== failure.destination?.storageHash &&
      failure.marker?.storageHash &&
      failure.destination?.storageHash
    ) {
      mismatchParts.push(
        `storageHash (marker: ${failure.marker.storageHash}, destination: ${failure.destination.storageHash})`,
      );
    }
    if (
      failure.marker?.profileHash !== failure.destination?.profileHash &&
      failure.marker?.profileHash &&
      failure.destination?.profileHash
    ) {
      mismatchParts.push(
        `profileHash (marker: ${failure.marker.profileHash}, destination: ${failure.destination.profileHash})`,
      );
    }

    return errorRuntime(
      'MIGRATION.MARKER_ORIGIN_MISMATCH',
      `Existing database signature does not match plan destination.${mismatchParts.length > 0 ? ` Mismatch in ${mismatchParts.join(' and ')}.` : ''}`,
      {
        why: 'Database has an existing signature (marker) that does not match the target contract',
        fix: 'If bootstrapping, drop/reset the database then re-run `prisma-next db init`; otherwise reconcile schema/marker using your migration workflow',
        meta: {
          ...ifDefined('markerStorageHash', failure.marker?.storageHash),
          ...ifDefined('destinationStorageHash', failure.destination?.storageHash),
          ...ifDefined('markerProfileHash', failure.marker?.profileHash),
          ...ifDefined('destinationProfileHash', failure.destination?.profileHash),
        },
      },
    );
  }

  if (failure.code === 'RUNNER_FAILED') {
    const runnerCode =
      typeof failure.meta?.['runnerErrorCode'] === 'string'
        ? failure.meta['runnerErrorCode']
        : undefined;
    const fix =
      runnerCode === 'MIGRATION.LEGACY_MARKER_SHAPE'
        ? 'Legacy marker-table shape detected. Drop `prisma_contract.marker` (Postgres) or `_prisma_marker` (SQLite) and re-run `prisma-next db init` to recreate it with the current per-space schema.'
        : 'Fix the schema mismatch (db init is additive-only), or drop/reset the database and re-run `prisma-next db init`';
    return errorRunnerFailed(failure.summary, {
      why: failure.why ?? 'Migration runner failed',
      fix,
      ...ifDefined('meta', failure.meta),
      ...ifDefined('cause', failure.cause),
    });
  }

  // Exhaustive check - TypeScript will error if a new code is added but not handled
  const exhaustive: never = failure.code;
  return assertNever(exhaustive, `Unhandled DbInitFailure code: ${String(exhaustive)}`);
}

/**
 * Executes the db init command and returns a structured Result.
 */
async function executeDbInitCommand(
  options: DbInitOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
): Promise<Result<MigrationCommandResult, CliStructuredError>> {
  // Prepare shared migration context (config, contract, connection, client)
  const ctxResult = await prepareMigrationContext(options, flags, ui, {
    commandName: 'db init',
    description: 'Bootstrap a database to match the current contract',
    url: 'https://pris.ly/db-init',
  });
  if (!ctxResult.ok) {
    return ctxResult;
  }
  const { client, config, contractJson, dbConnection, onProgress, contractPathAbsolute } =
    ctxResult.value;

  // The aggregate loader (loader → planner → runner pipeline) catches
  // layout / drift / disjointness violations on its own; the legacy
  // per-space precheck + marker-check helpers are no longer needed at
  // this surface. Marker-vs-on-disk drift surfaces through the planner's
  // graph-walk strategy.
  const { migrationsDir, refsDir } = resolveMigrationPaths(options.config, config, process.cwd());

  try {
    await client.connect(dbConnection);

    const result = await client.dbInit({
      contract: contractJson,
      mode: options.dryRun ? 'plan' : 'apply',
      migrationsDir,
      onProgress,
    });

    // Handle failures by mapping to CLI structured error
    if (!result.ok) {
      return notOk(mapDbInitFailure(result.failure));
    }

    const advancementHash =
      result.value.mode === 'apply'
        ? (result.value.marker?.storageHash ?? result.value.destination.storageHash)
        : result.value.destination.storageHash;

    const advancement = await resolveRefAdvancementFields({
      ...ifDefined('advanceRef', options.advanceRef),
      ...ifDefined('db', options.db),
      refsDir,
      migrationsDir,
      contractJson,
      contractJsonPath: contractPathAbsolute,
      mode: result.value.mode,
      hash: advancementHash,
    });
    if (!advancement.ok) {
      return notOk(advancement.failure);
    }
    const refAdvancementFields: RefAdvancementFields = advancement.value;

    // Convert success result to CLI output format
    const dbInitResult: MigrationCommandResult = {
      ok: true,
      mode: result.value.mode,
      plan: {
        targetId: ctxResult.value.config.target.targetId,
        destination: {
          storageHash: result.value.destination.storageHash,
          ...ifDefined('profileHash', result.value.destination.profileHash),
        },
        operations: result.value.plan.operations.map((op) => ({
          id: op.id,
          label: op.label,
          operationClass: op.operationClass,
        })),
        ...ifDefined('preview', result.value.plan.preview),
      },
      ...(result.value.execution
        ? {
            execution: {
              operationsPlanned: result.value.execution.operationsPlanned,
              operationsExecuted: result.value.execution.operationsExecuted,
            },
          }
        : {}),
      ...(result.value.marker
        ? {
            marker: {
              storageHash: result.value.marker.storageHash,
              ...ifDefined('profileHash', result.value.marker.profileHash),
            },
          }
        : {}),
      ...ifDefined('perSpace', result.value.perSpace),
      advancedRef: refAdvancementFields.advancedRef,
      plannedAdvanceRef: refAdvancementFields.plannedAdvanceRef,
      summary: result.value.summary,
      timings: { total: Date.now() - startTime },
    };

    return ok(dbInitResult);
  } catch (error) {
    // Driver already throws CliStructuredError for connection failures
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }

    if (isStructuredError(error) && error.code === 'CONTRACT.VALIDATION_FAILED') {
      return notOk(
        errorContractValidationFailed(`Contract validation failed: ${error.message}`, {
          where: { path: contractPathAbsolute },
        }),
      );
    }

    const rawMessage = error instanceof Error ? error.message : String(error);
    const safeMessage = sanitizeErrorMessage(
      rawMessage,
      typeof dbConnection === 'string' ? dbConnection : undefined,
    );
    return notOk(
      errorUnexpected(safeMessage, {
        why: `Unexpected error during db init: ${safeMessage}`,
      }),
    );
  } finally {
    await client.close();
  }
}

export function createDbInitCommand(): Command {
  const command = new Command('init');
  setCommandDescriptions(
    command,
    'Bootstrap a database to match the current contract and sign it',
    'Initializes a database to match your emitted contract using additive-only operations.\n' +
      'Creates any missing tables, columns, indexes, and constraints defined in your contract.\n' +
      'Leaves existing compatible structures in place, surfaces conflicts when destructive changes\n' +
      'would be required, and signs the database to track contract state. Use --dry-run to\n' +
      'preview changes without applying.',
  );
  setCommandExamples(command, [
    'prisma-next db init --db $DATABASE_URL',
    'prisma-next db init --db $DATABASE_URL --dry-run',
  ]);
  addMigrationCommandOptions(command);
  command.option('--advance-ref <name>', 'Ref to advance to the post-command contract hash');
  command.action(async (options: DbInitOptions) => {
    const flags = parseGlobalFlagsOrExit(options);
    const startTime = Date.now();

    const ui = createTerminalUI(flags);

    const result = await executeDbInitCommand(options, flags, ui, startTime);

    const exitCode = handleResult(result, flags, ui, (dbInitResult) => {
      if (flags.json) {
        ui.output(formatMigrationJson(dbInitResult));
      } else {
        const output =
          dbInitResult.mode === 'plan'
            ? formatMigrationPlanOutput(dbInitResult, flags)
            : formatMigrationApplyOutput(dbInitResult, flags);
        if (output) {
          ui.log(output);
        }
      }
    });

    process.exit(exitCode);
  });

  return command;
}
