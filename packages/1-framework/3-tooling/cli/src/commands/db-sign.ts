import { readFile } from 'node:fs/promises';
import { loadConfigForSections } from '@internal/config-loader';
import type {
  SignDatabaseResult,
  VerifyDatabaseSchemaResult,
} from '@internal/framework-components/control';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { Command } from 'commander';
import { relative, resolve } from 'pathe';
import { createControlClient } from '../control-api/client';
import { resolveContractRefToSnapshot } from '../control-api/operations/contract-snapshot-resolution';
import {
  CliStructuredError,
  errorContractValidationFailed,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorFileNotFound,
  errorUnexpected,
} from '../utils/cli-errors';
import {
  addGlobalOptions,
  maskConnectionUrl,
  resolveContractPath,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import { formatStyledHeader } from '../utils/formatters/styled';
import {
  formatSchemaVerifyJson,
  formatSchemaVerifyOutput,
  formatSignJson,
  formatSignOutput,
} from '../utils/formatters/verify';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { createProgressAdapter } from '../utils/progress-adapter';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface DbSignOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
  readonly contract?: string;
}

/**
 * Failure type for db sign command.
 * Either an infrastructure error (CliStructuredError) or a logical failure (schema verification failed).
 */
type DbSignFailure = CliStructuredError | VerifyDatabaseSchemaResult;

/**
 * Executes the db sign command and returns a structured Result.
 * Success: SignDatabaseResult (sign happened)
 * Failure: CliStructuredError (infra error) or VerifyDatabaseSchemaResult (schema mismatch)
 */
async function executeDbSignCommand(
  contractArg: string | undefined,
  options: DbSignOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<SignDatabaseResult, DbSignFailure>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'db',
    'migrations',
    'contract',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;
  const configPath = options.config
    ? relative(process.cwd(), resolve(options.config))
    : 'prisma-next.config.ts';
  const contractPathAbsolute = resolveContractPath(config);
  const contractPath = relative(process.cwd(), contractPathAbsolute);

  const effectiveContractArg = contractArg ?? options.contract;

  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
      { label: 'contract', value: effectiveContractArg ?? contractPath },
    ];
    if (options.db) {
      details.push({ label: 'database', value: maskConnectionUrl(options.db) });
    }
    const header = formatStyledHeader({
      command: 'db sign',
      description: 'Sign the database with your contract so you can safely run queries',
      url: 'https://pris.ly/db-sign',
      details,
      flags,
    });
    ui.stderr(header);
  }

  let contractJson: Record<string, unknown>;

  if (effectiveContractArg) {
    try {
      const { migrationsDir } = resolveMigrationPaths(options.config, config);
      const resolved = await resolveContractRefToSnapshot({
        config,
        migrationsDir,
        refInput: effectiveContractArg,
        contractPathAbsolute,
        fallbackToEmitted: true,
      });
      if (!resolved.ok) {
        return notOk(resolved.failure);
      }
      contractJson = resolved.value.contractJson;
    } catch (error) {
      if (error instanceof CliStructuredError) return notOk(error);
      return notOk(
        errorUnexpected(error instanceof Error ? error.message : String(error), {
          why: `Failed to resolve contract reference: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    }
  } else {
    let contractJsonContent: string;
    try {
      contractJsonContent = await readFile(contractPathAbsolute, 'utf-8');
    } catch (error) {
      if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
        return notOk(
          errorFileNotFound(contractPathAbsolute, {
            why: `Contract file not found at ${contractPathAbsolute}`,
            fix: `Run \`prisma-next contract emit\` to generate ${contractPath}, or update \`config.contract.output\` in ${configPath}`,
          }),
        );
      }
      return notOk(
        errorUnexpected(error instanceof Error ? error.message : String(error), {
          why: `Failed to read contract file: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    }

    try {
      contractJson = JSON.parse(contractJsonContent) as Record<string, unknown>;
    } catch (error) {
      return notOk(
        errorContractValidationFailed(
          `Contract JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
          { where: { path: contractPathAbsolute } },
        ),
      );
    }
  }

  // Resolve database connection (--db flag or config.db.connection)
  const dbConnection = options.db ?? config.db?.connection;
  if (!dbConnection) {
    return notOk(
      errorDatabaseConnectionRequired({
        why: `Database connection is required for db sign (set db.connection in ${configPath}, or pass --db <url>)`,
        commandName: 'db sign',
      }),
    );
  }

  // Check for driver
  if (!config.driver) {
    return notOk(errorDriverRequired({ why: 'Config.driver is required for db sign' }));
  }

  // Create control client
  const client = createControlClient({
    family: config.family,
    target: config.target,
    adapter: config.adapter,
    driver: config.driver,
    extensions: config.extensions ?? [],
  });

  // Create progress adapter
  const onProgress = createProgressAdapter({ ui, flags });

  try {
    // Step 1: Schema verification - connect here
    const schemaVerifyResult = await client.schemaVerify({
      contract: contractJson,
      strict: false,
      connection: dbConnection,
      onProgress,
    });

    // If schema verification failed, return as failure
    if (!schemaVerifyResult.ok) {
      return notOk(schemaVerifyResult);
    }

    // Step 2: Sign (already connected from schemaVerify)
    const signResult = await client.sign({
      contract: contractJson,
      contractPath,
      configPath,
      onProgress,
    });

    return ok(signResult);
  } catch (error) {
    // Driver already throws CliStructuredError for connection failures
    if (error instanceof CliStructuredError) {
      return notOk(error);
    }

    if (isStructuredError(error) && error.code === 'CONTRACT.VALIDATION_FAILED') {
      return notOk(
        errorContractValidationFailed(`Contract validation failed: ${error.message}`, {
          where: { path: contractPathAbsolute },
        }),
      );
    }

    // Wrap unexpected errors
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: `Unexpected error during db sign: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  } finally {
    await client.close();
  }
}

export function createDbSignCommand(): Command {
  const command = new Command('sign');
  setCommandDescriptions(
    command,
    'Sign the database with your contract so you can safely run queries',
    'Verifies that your database schema satisfies the emitted contract, and if so, writes or\n' +
      'updates the database signature. This command is idempotent and safe to run\n' +
      'in CI/deployment pipelines. The signature records that this database instance is aligned\n' +
      'with a specific contract version.',
  );
  setCommandExamples(command, [
    'prisma-next db sign --db $DATABASE_URL',
    'prisma-next db sign production --db $DATABASE_URL',
    'prisma-next db sign --contract production --db $DATABASE_URL',
  ]);
  addGlobalOptions(command)
    .argument('[contract]', 'Contract reference (hash, prefix, ref name, or migration dir name)')
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option(
      '--contract <contract>',
      'Contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path)',
    )
    .action(async (positionalContract: string | undefined, options: DbSignOptions) => {
      const flags = parseGlobalFlagsOrExit(options);

      if (positionalContract && options.contract) {
        process.stderr.write(
          'Cannot specify both a positional contract argument and --contract flag.\n',
        );
        process.exit(2);
        return;
      }

      const ui = createTerminalUI(flags);

      const result = await executeDbSignCommand(positionalContract, options, flags, ui);

      if (result.ok) {
        // Success - format sign output
        if (flags.json) {
          ui.output(formatSignJson(result.value));
        } else {
          const output = formatSignOutput(result.value, flags);
          if (output) {
            ui.log(output);
          }
        }
        process.exit(0);
      }

      // Failure - determine type and handle appropriately
      const failure = result.failure;

      if (failure instanceof CliStructuredError) {
        // Infrastructure error - use standard handler
        const exitCode = handleResult(result as Result<never, CliStructuredError>, flags, ui);
        process.exit(exitCode);
      }

      // Schema verification failed - format and print schema verification output
      if (flags.json) {
        ui.output(formatSchemaVerifyJson(failure));
      } else {
        const output = formatSchemaVerifyOutput(failure, flags);
        if (output) {
          ui.log(output);
        }
      }
      process.exit(1);
    });

  return command;
}
