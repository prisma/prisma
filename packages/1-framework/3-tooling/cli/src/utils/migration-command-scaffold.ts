import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { loadConfigForSections, type PrismaNextConfig } from '@internal/config-loader';
import { hasMigrations } from '@internal/framework-components/control';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { Command } from 'commander';
import { createControlClient } from '../control-api/client';
import type { ControlClient } from '../control-api/types';
import {
  CliStructuredError,
  errorContractValidationFailed,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorFileNotFound,
  errorTargetMigrationNotSupported,
  errorUnexpected,
} from './cli-errors';
import { addGlobalOptions, maskConnectionUrl, resolveContractPath } from './command-helpers';
import { formatStyledHeader } from './formatters/styled';
import type { GlobalFlags } from './global-flags';
import { createProgressAdapter } from './progress-adapter';
import type { TerminalUI } from './terminal-ui';

/**
 * Resolved context for a migration command.
 * Contains everything needed to invoke a control-api operation.
 */
export interface MigrationContext {
  readonly client: ControlClient;
  readonly contractJson: Record<string, unknown>;
  readonly dbConnection: unknown;
  readonly onProgress: ReturnType<typeof createProgressAdapter>;
  readonly configPath: string;
  readonly contractPath: string;
  readonly contractPathAbsolute: string;
  readonly config: PrismaNextConfig;
}

/**
 * Command-specific configuration for the shared scaffold.
 */
export interface MigrationCommandDescriptor {
  readonly commandName: string;
  readonly description: string;
  readonly url: string;
}

/**
 * Prepares the shared context for migration commands (db init, db update).
 *
 * Handles: config loading, contract file reading, JSON parsing, connection resolution,
 * driver/migration-support validation, client creation, and header output.
 *
 * Returns a Result with either the resolved context or a structured error.
 */
export async function prepareMigrationContext(
  options: { readonly db?: string; readonly config?: string; readonly dryRun?: boolean },
  flags: GlobalFlags,
  ui: TerminalUI,
  descriptor: MigrationCommandDescriptor,
): Promise<Result<MigrationContext, CliStructuredError>> {
  // Load config
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
  let contractPathAbsolute: string;
  try {
    contractPathAbsolute = resolveContractPath(config);
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }
    throw error;
  }
  const contractPath = relative(process.cwd(), contractPathAbsolute);

  // Output header to stderr (decoration)
  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
      { label: 'contract', value: contractPath },
    ];
    if (options.db) {
      details.push({ label: 'database', value: maskConnectionUrl(options.db) });
    }
    if (options.dryRun) {
      details.push({ label: 'mode', value: 'dry run' });
    }
    const header = formatStyledHeader({
      command: descriptor.commandName,
      description: descriptor.description,
      url: descriptor.url,
      details,
      flags,
    });
    ui.stderr(header);
  }

  // Load contract file
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

  // Parse contract JSON
  let contractJson: Record<string, unknown>;
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

  // Resolve database connection (--db flag or config.db.connection)
  const dbConnection = options.db ?? config.db?.connection;
  if (!dbConnection) {
    return notOk(
      errorDatabaseConnectionRequired({
        why: `Database connection is required for ${descriptor.commandName} (set db.connection in ${configPath}, or pass --db <url>)`,
        commandName: descriptor.commandName,
      }),
    );
  }

  // Check for driver
  if (!config.driver) {
    return notOk(
      errorDriverRequired({ why: `Config.driver is required for ${descriptor.commandName}` }),
    );
  }

  if (!hasMigrations(config.target)) {
    return notOk(
      errorTargetMigrationNotSupported({
        why: `Target "${config.target.id}" does not support migrations`,
      }),
    );
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

  return ok({
    client,
    contractJson,
    dbConnection,
    onProgress,
    configPath,
    contractPath,
    contractPathAbsolute,
    config,
  });
}

/**
 * Registers the shared CLI options for migration commands (db init, db update).
 */
export function addMigrationCommandOptions(command: Command): Command {
  addGlobalOptions(command);
  return command
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--dry-run', 'Preview planned operations without applying', false);
}
