import { loadConfigForSections } from '@internal/config-loader';
import type { ContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { buildReadAggregate } from '../control-api/operations/contract-space-aggregate-loader';
import {
  migrationSpaceListEntriesFromAggregate,
  runMigrationList,
} from '../control-api/operations/migration-list';
import type { CliStructuredError } from '../utils/cli-errors';
import {
  addGlobalOptions,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
  setCommandSeeAlso,
} from '../utils/command-helpers';
import { renderMigrationGraphLegend } from '../utils/formatters/migration-graph-labels';
import { renderMigrationListWithStyle } from '../utils/formatters/migration-list-render';
import { createAnsiMigrationListStyler } from '../utils/formatters/migration-list-styler';
import type { MigrationListResult } from '../utils/formatters/migration-list-types';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import type { GlyphMode } from '../utils/glyph-mode';
import { shouldShowLegend, validateLegendOptions } from '../utils/legend';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface MigrationListOptions extends CommonCommandOptions {
  readonly config?: string;
  readonly space?: string;
  readonly ascii?: boolean;
  readonly legend?: boolean;
}

export interface MigrationListExecuteResult {
  readonly list: MigrationListResult;
  readonly liveContractHash: string;
  readonly aggregate: ContractSpaceAggregate;
}

export interface MigrationListHumanRenderOptions {
  readonly glyphMode: GlyphMode;
  readonly useColor: boolean;
  readonly liveContractHash: string;
  readonly graphForSpace: (spaceId: string) => MigrationGraph | undefined;
  readonly appSpaceId?: string;
}

export function renderMigrationListHumanOutput(
  result: MigrationListResult,
  options: MigrationListHumanRenderOptions,
): string {
  const styler = createAnsiMigrationListStyler({ useColor: options.useColor });
  return renderMigrationListWithStyle(result, styler, options.glyphMode, {
    colorize: options.useColor,
    liveContractHash: options.liveContractHash,
    graphForSpace: options.graphForSpace,
    ...(options.appSpaceId !== undefined ? { appSpaceId: options.appSpaceId } : {}),
  });
}

/**
 * CLI shell: loads config, resolves paths, prints the styled header on
 * stderr (interactive mode only), and delegates to {@link runMigrationList}.
 * Kept intentionally thin so the unit-testable surface lives in the core.
 */
export async function executeMigrationListCommand(
  options: MigrationListOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<MigrationListExecuteResult, CliStructuredError>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'extensions',
    'migrations',
    'contract',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;
  const { configPath, migrationsDir, migrationsRelative } = resolveMigrationPaths(
    options.config,
    config,
  );

  if (!flags.json && !flags.quiet) {
    const header = formatStyledHeader({
      command: 'migration list',
      description: 'List on-disk migrations per contract space',
      details: [
        { label: 'config', value: configPath },
        { label: 'migrations', value: migrationsRelative },
        ...(options.space !== undefined ? [{ label: 'space', value: options.space }] : []),
      ],
      flags,
    });
    ui.stderr(header);
    if (shouldShowLegend(options, flags)) {
      ui.stderr(
        renderMigrationGraphLegend({
          colorize: flags.color !== false,
          glyphMode: ui.resolveGlyphMode(options.ascii === true),
        }),
      );
      ui.stderr('');
    }
  }

  const loaded = await buildReadAggregate(config, { migrationsDir });
  if (!loaded.ok) {
    return notOk(loaded.failure);
  }

  const { aggregate, contractHash: liveContractHash } = loaded.value;

  const spaces = await migrationSpaceListEntriesFromAggregate(aggregate, migrationsDir);

  const listResult = runMigrationList({
    spaces,
    ...ifDefined('spaceFilter', options.space),
  });
  if (!listResult.ok) {
    return listResult;
  }
  return ok({ list: listResult.value, liveContractHash, aggregate });
}

export function createMigrationListCommand(): Command {
  const command = new Command('list');
  setCommandDescriptions(
    command,
    'List on-disk migrations per contract space',
    'Enumerates every on-disk migration under migrations/<space>/ for every\n' +
      'contract space found on disk. Offline — does not consult the database.\n' +
      'Human output draws the shared migration graph tree with operation counts,\n' +
      'invariants on each migration row, and refs on destination contract nodes.\n' +
      'Pass --space <id> to narrow to one contract space. --ascii forces ASCII\n' +
      'tree glyphs (orthogonal to --no-color).',
  );
  setCommandExamples(command, [
    'prisma-next migration list',
    'prisma-next migration list --space app',
    'prisma-next migration list --ascii',
    'prisma-next migration list --legend',
    'prisma-next migration list --json',
  ]);
  setCommandSeeAlso(command, [
    { verb: 'migration status', oneLiner: 'Show migration path and pending status' },
    { verb: 'migration log', oneLiner: 'Show executed migration history' },
    { verb: 'migration graph', oneLiner: 'Show the migration graph topology' },
    { verb: 'migration show', oneLiner: 'Display migration package contents' },
  ]);
  addGlobalOptions(command)
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--space <id>', 'Narrow output to a single contract space')
    .option('--ascii', 'Use ASCII kind glyphs (pipe-friendly)')
    .option('--legend', 'Print a key for the tree glyphs and lane colors')
    .action(async (options: MigrationListOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);
      const legendValidation = validateLegendOptions(options, flags);
      if (!legendValidation.ok) {
        process.exit(handleResult(legendValidation, flags, ui));
      }
      const result = await executeMigrationListCommand(options, flags, ui);
      const exitCode = handleResult(result, flags, ui, ({ list, liveContractHash, aggregate }) => {
        if (flags.json) {
          ui.output(JSON.stringify(list, null, 2));
        } else if (!flags.quiet) {
          ui.output(
            renderMigrationListHumanOutput(list, {
              glyphMode: ui.resolveGlyphMode(options.ascii === true),
              useColor: ui.useColor,
              liveContractHash,
              graphForSpace: (spaceId) => aggregate.space(spaceId)?.graph(),
              appSpaceId: aggregate.app.spaceId,
            }),
          );
        }
      });
      process.exit(exitCode);
    });
  return command;
}
