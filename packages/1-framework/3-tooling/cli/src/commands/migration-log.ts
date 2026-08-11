import { loadConfigForSections } from '@internal/config-loader';
import type { LedgerEntryRecord } from '@internal/contract/types';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { createControlClient } from '../control-api/client';
import { mapCaughtMigrationError } from '../control-api/operations/caught-errors';
import { type CliStructuredError, errorUnexpected, requireLiveDatabase } from '../utils/cli-errors';
import {
  addGlobalOptions,
  maskConnectionUrl,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
  setCommandSeeAlso,
  targetSupportsMigrations,
} from '../utils/command-helpers';
import { createAnsiMigrationListStyler } from '../utils/formatters/migration-list-styler';
import {
  MIGRATION_LOG_EMPTY_MESSAGE,
  renderMigrationLogTable,
  serializeLedgerEntriesForJson,
} from '../utils/formatters/migration-log-table';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';
import type { MigrationLogResult } from './json/schemas';

export type { MigrationLogResult };

interface MigrationLogOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
  readonly utc?: boolean;
  readonly ascii?: boolean;
}

export async function executeMigrationLogCommand(
  options: MigrationLogOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<readonly LedgerEntryRecord[], CliStructuredError>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'db',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;
  const { configPath } = resolveMigrationPaths(options.config, config, process.cwd());

  const dbConnection = options.db ?? config.db?.connection;
  const missingDb = requireLiveDatabase({
    dbConnection,
    hasDriver: !!config.driver,
    why: `migration log needs a database connection and driver to read the ledger (set db.connection in ${configPath}, or pass --db <url>)`,
    commandName: 'migration log',
  });
  if (missingDb) {
    return notOk(missingDb);
  }
  if (!targetSupportsMigrations(config.target)) {
    return notOk(errorUnexpected('Target does not support migrations'));
  }

  if (!flags.json && !flags.quiet) {
    const header = formatStyledHeader({
      command: 'migration log',
      description: 'Show executed migration history from the database ledger',
      details: [
        { label: 'config', value: configPath },
        ...(typeof dbConnection === 'string'
          ? [{ label: 'database', value: maskConnectionUrl(dbConnection) }]
          : []),
      ],
      flags,
    });
    ui.stderr(header);
  }

  const client = createControlClient({
    family: config.family,
    target: config.target,
    adapter: config.adapter,
    ...ifDefined('driver', config.driver),
    extensions: config.extensions ?? [],
  });

  try {
    await client.connect(dbConnection);
    const ledger = await client.readLedger();
    return ok(ledger);
  } catch (error) {
    const mapped = mapCaughtMigrationError(error);
    if (mapped) return notOk(mapped);
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: `Failed to read migration log: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  } finally {
    await client.close();
  }
}

export function createMigrationLogCommand(): Command {
  const command = new Command('log');
  setCommandDescriptions(
    command,
    'Show executed migration history',
    'Reads the database ledger and displays every applied migration edge\n' +
      'in chronological order, including rollbacks and re-applies, merged\n' +
      'across all contract spaces. Requires a database connection.',
  );
  setCommandExamples(command, [
    'prisma-next migration log --db $DATABASE_URL',
    'prisma-next migration log --utc --db $DATABASE_URL',
    'prisma-next migration log --json --db $DATABASE_URL',
  ]);
  setCommandSeeAlso(command, [
    { verb: 'migration status', oneLiner: 'Show migration path and pending status' },
    { verb: 'migration list', oneLiner: 'List on-disk migrations' },
    { verb: 'migration graph', oneLiner: 'Show the migration graph topology' },
    { verb: 'migration show', oneLiner: 'Display migration package contents' },
  ]);
  addGlobalOptions(command)
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--utc', 'Render human timestamps in UTC instead of local time')
    .option('--ascii', 'Use ASCII glyphs (pipe-friendly)')
    .action(async (options: MigrationLogOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);
      const result = await executeMigrationLogCommand(options, flags, ui);
      const exitCode = handleResult(result, flags, ui, (entries) => {
        if (flags.json) {
          const records = serializeLedgerEntriesForJson(entries);
          const result: MigrationLogResult = {
            ok: true,
            records,
            summary: `${records.length} migration(s) applied`,
          };
          ui.output(JSON.stringify(result, null, 2));
        } else if (!flags.quiet) {
          if (entries.length === 0) {
            ui.output(MIGRATION_LOG_EMPTY_MESSAGE);
          } else {
            const styler = createAnsiMigrationListStyler({ useColor: ui.useColor });
            ui.output(
              renderMigrationLogTable(entries, {
                utc: options.utc === true,
                styler,
                glyphMode: ui.resolveGlyphMode(options.ascii === true),
              }),
            );
          }
        }
      });
      process.exit(exitCode);
    });
  return command;
}
