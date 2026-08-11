import { ifDefined } from '@internal/utils/defined';
import { assertNever } from '@internal/utils/internal-error';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { Command } from 'commander';
import { resolveContractRefToSnapshot } from '../control-api/operations/contract-snapshot-resolution';
import {
  type RefAdvancementFields,
  resolveRefAdvancementFields,
} from '../control-api/operations/ref-advancement';
import type { DbUpdateFailure } from '../control-api/types';
import {
  CliStructuredError,
  ERROR_CODE_DESTRUCTIVE_CHANGES,
  errorContractValidationFailed,
  errorDestructiveChanges,
  errorMigrationPlanningFailed,
  errorRunnerFailed,
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

interface DbUpdateOptions extends MigrationCommandOptions {
  readonly to?: string;
  readonly advanceRef?: string;
}

/**
 * Maps a DbUpdateFailure to a CliStructuredError for consistent error handling.
 */
function mapDbUpdateFailure(failure: DbUpdateFailure): CliStructuredError {
  if (failure.code === 'PLANNING_FAILED') {
    return errorMigrationPlanningFailed({ conflicts: failure.conflicts ?? [] });
  }

  if (failure.code === 'RUNNER_FAILED') {
    const runnerCode =
      typeof failure.meta?.['runnerErrorCode'] === 'string'
        ? failure.meta['runnerErrorCode']
        : undefined;
    const fix =
      runnerCode === 'MIGRATION.LEGACY_MARKER_SHAPE'
        ? 'Legacy marker-table shape detected. Drop `prisma_contract.marker` (Postgres) or `_prisma_marker` (SQLite) and re-run `prisma-next db init` to recreate it with the current per-space schema.'
        : 'Inspect the reported conflict, reconcile schema drift if needed, then re-run `prisma-next db update`';
    return errorRunnerFailed(failure.summary, {
      why: failure.why ?? 'Migration runner failed',
      fix,
      meta: {
        ...failure.meta,
        ...(failure.warnings && failure.warnings.length > 0
          ? { plannerWarnings: failure.warnings }
          : {}),
      },
      ...ifDefined('cause', failure.cause),
    });
  }

  if (failure.code === 'DESTRUCTIVE_CHANGES') {
    return errorDestructiveChanges(failure.summary, {
      ...ifDefined('why', failure.why),
      fix: 'Re-run with `-y` to apply destructive changes, or use `--dry-run` to preview first',
      ...ifDefined('meta', failure.meta),
    });
  }

  const exhaustive: never = failure.code;
  return assertNever(exhaustive, `Unhandled DbUpdateFailure code: ${String(exhaustive)}`);
}

/**
 * Executes the db update command and returns a structured Result.
 */
async function executeDbUpdateCommand(
  options: DbUpdateOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
): Promise<Result<MigrationCommandResult, CliStructuredError>> {
  // Prepare shared migration context (config, contract, connection, client)
  const ctxResult = await prepareMigrationContext(options, flags, ui, {
    commandName: 'db update',
    description: 'Update your database schema to match your contract',
    url: 'https://pris.ly/db-update',
  });
  if (!ctxResult.ok) {
    return ctxResult;
  }
  const { client, config, dbConnection, onProgress, contractPathAbsolute } = ctxResult.value;
  let { contractJson } = ctxResult.value;
  let contractJsonPathForSnapshot = contractPathAbsolute;
  const { migrationsDir, refsDir } = resolveMigrationPaths(options.config, config, process.cwd());

  if (options.to) {
    const resolved = await resolveContractRefToSnapshot({
      config,
      migrationsDir,
      refInput: options.to,
      contractPathAbsolute,
      fallbackToEmitted: false,
      missingBundleFlag: '--to',
    });
    if (!resolved.ok) {
      return notOk(resolved.failure);
    }
    contractJson = resolved.value.contractJson;
    contractJsonPathForSnapshot = resolved.value.contractJsonPath;
  }

  try {
    await client.connect(dbConnection);

    const result = await client.dbUpdate({
      contract: contractJson,
      mode: options.dryRun ? 'plan' : 'apply',
      migrationsDir,
      ...(flags.yes ? { acceptDataLoss: true } : {}),
      onProgress,
    });

    // Handle failures by mapping to CLI structured error
    if (!result.ok) {
      return notOk(mapDbUpdateFailure(result.failure));
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
      contractJsonPath: contractJsonPathForSnapshot,
      mode: result.value.mode,
      hash: advancementHash,
    });
    if (!advancement.ok) {
      return notOk(advancement.failure);
    }
    const refAdvancementFields: RefAdvancementFields = advancement.value;

    // Convert success result to CLI output format
    const dbUpdateResult: MigrationCommandResult = {
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
      ...ifDefined(
        'execution',
        result.value.execution
          ? {
              operationsPlanned: result.value.execution.operationsPlanned,
              operationsExecuted: result.value.execution.operationsExecuted,
            }
          : undefined,
      ),
      ...ifDefined(
        'marker',
        result.value.marker
          ? {
              storageHash: result.value.marker.storageHash,
              ...ifDefined('profileHash', result.value.marker.profileHash),
            }
          : undefined,
      ),
      ...ifDefined('perSpace', result.value.perSpace),
      ...ifDefined('warnings', result.value.warnings),
      advancedRef: refAdvancementFields.advancedRef,
      plannedAdvanceRef: refAdvancementFields.plannedAdvanceRef,
      summary: result.value.summary,
      timings: { total: Date.now() - startTime },
    };

    return ok(dbUpdateResult);
  } catch (error) {
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
        why: `Unexpected error during db update: ${safeMessage}`,
      }),
    );
  } finally {
    await client.close();
  }
}

export function createDbUpdateCommand(): Command {
  const command = new Command('update');
  setCommandDescriptions(
    command,
    'Update your database schema to match your contract',
    'Compares your database schema to the emitted contract and applies the necessary\n' +
      'changes. Works on any database, whether or not it has been initialized with `db init`.\n' +
      'Destructive operations prompt for confirmation in interactive mode. Use -y to\n' +
      'auto-accept or --dry-run to preview first.',
  );
  setCommandExamples(command, [
    'prisma-next db update --db $DATABASE_URL',
    'prisma-next db update --db $DATABASE_URL --dry-run',
  ]);
  addMigrationCommandOptions(command);
  command.option(
    '--to <contract>',
    'Target contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path)',
  );
  command.option('--advance-ref <name>', 'Ref to advance to the post-command contract hash');
  command.action(async (options: DbUpdateOptions) => {
    const flags = parseGlobalFlagsOrExit(options);
    const startTime = Date.now();

    const ui = createTerminalUI(flags);

    let result = await executeDbUpdateCommand(options, flags, ui, startTime);

    // Interactive confirmation for destructive operations:
    // When the control API rejects destructive changes, prompt the user instead of failing.
    // In non-interactive mode (CI, piped, --no-interactive, --json), the error is returned as-is.
    if (
      !result.ok &&
      result.failure.code === ERROR_CODE_DESTRUCTIVE_CHANGES &&
      flags.interactive &&
      !flags.json &&
      !flags.yes
    ) {
      const meta = result.failure.meta as
        | { destructiveOperations?: readonly { id: string; label: string }[] }
        | undefined;
      const destructiveOps = meta?.destructiveOperations ?? [];

      if (destructiveOps.length > 0) {
        ui.warn(
          `${destructiveOps.length} destructive operation(s) that may cause data loss:\n${destructiveOps.map((op) => `  ${ui.yellow('▸')} ${op.label}`).join('\n')}`,
        );
      }

      const confirmed = await ui.confirm('Apply destructive changes? This cannot be undone.');

      if (confirmed) {
        result = await executeDbUpdateCommand(options, { ...flags, yes: true }, ui, Date.now());
      }
    }

    const exitCode = handleResult(result, flags, ui, (dbUpdateResult) => {
      if (flags.json) {
        ui.output(formatMigrationJson(dbUpdateResult));
      } else {
        const output =
          dbUpdateResult.mode === 'plan'
            ? formatMigrationPlanOutput(dbUpdateResult, flags)
            : formatMigrationApplyOutput(dbUpdateResult, flags);
        if (output) {
          ui.log(output);
        }
      }
    });
    process.exit(exitCode);
  });

  return command;
}
