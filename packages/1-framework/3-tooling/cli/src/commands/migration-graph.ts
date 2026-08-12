import { loadConfigForSections } from '@internal/config-loader';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { ifDefined } from '@internal/utils/defined';
import { ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { buildReadAggregate } from '../control-api/operations/contract-space-aggregate-loader';
import { buildMigrationSpaceGraphEntries } from '../control-api/operations/migration-graph';
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
import {
  buildMigrationGraphTreeSections,
  type MigrationGraphTreeSection,
  renderMigrationGraphDot,
  renderMigrationGraphSections,
} from '../utils/formatters/migration-graph-sections';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { shouldShowLegend, validateLegendOptions } from '../utils/legend';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';
import type { MigrationGraphJsonResult, MigrationSpaceGraphEntry } from './json/schemas';

interface MigrationGraphOptions extends CommonCommandOptions {
  readonly config?: string;
  readonly dot?: boolean;
  readonly space?: string;
  readonly ascii?: boolean;
  readonly legend?: boolean;
}

export interface MigrationGraphResult {
  readonly ok: true;
  /** App-space graph for the `--dot` Graphviz output. */
  readonly graph: MigrationGraph;
  /** Nested per-space contracts + migrations for `--json`. */
  readonly spaces: readonly MigrationSpaceGraphEntry[];
  readonly treeSections: readonly MigrationGraphTreeSection[];
  readonly summary: string;
}

function computeGraphSummary(spaces: readonly MigrationSpaceGraphEntry[]): string {
  const contractCount = spaces.reduce((count, space) => count + space.contracts.length, 0);
  const migrationCount = spaces.reduce((count, space) => count + space.migrations.length, 0);
  return `${spaces.length} space(s), ${contractCount} contract(s), ${migrationCount} migration(s)`;
}

export function formatMigrationGraphHumanOutput(result: MigrationGraphResult): string {
  return renderMigrationGraphSections(result.treeSections, result.summary);
}

export async function executeMigrationGraphCommand(
  options: MigrationGraphOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<MigrationGraphResult, CliStructuredError>> {
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
  const { configPath, migrationsRelative, migrationsDir } = resolveMigrationPaths(
    options.config,
    config,
    process.cwd(),
  );

  if (!flags.json && !flags.quiet) {
    const header = formatStyledHeader({
      command: 'migration graph',
      description: 'Show the migration graph topology',
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
    return loaded;
  }

  const { aggregate, contractHash: liveContractHash } = loaded.value;
  const appGraph = aggregate.app.graph();

  const listSpaces = await migrationSpaceListEntriesFromAggregate(aggregate, migrationsDir);
  const listResult = runMigrationList({
    spaces: listSpaces,
    ...ifDefined('spaceFilter', options.space),
  });
  if (!listResult.ok) {
    return listResult;
  }

  const scopedSpaces = listResult.value.spaces;
  const treeSections = buildMigrationGraphTreeSections({
    aggregate,
    scopedSpaces,
    liveContractHash,
    glyphMode: ui.resolveGlyphMode(options.ascii === true),
    colorize: flags.color !== false,
  });

  const spaces: MigrationSpaceGraphEntry[] = [
    ...buildMigrationSpaceGraphEntries({ aggregate, scopedSpaces }),
  ];

  return ok({
    ok: true,
    graph: appGraph,
    spaces,
    treeSections,
    summary: computeGraphSummary(spaces),
  });
}

export function createMigrationGraphCommand(): Command {
  const command = new Command('graph');
  setCommandDescriptions(
    command,
    'Show the migration graph topology',
    'Renders the migration graph topology.\n' +
      'Offline — does not consult the database.\n' +
      '--ascii swaps box-drawing for pipe-friendly ASCII glyphs.\n' +
      'Use --json for machine-readable output, or --dot for Graphviz DOT\n' +
      'format.',
  );
  setCommandExamples(command, [
    'prisma-next migration graph',
    'prisma-next migration graph --json',
    'prisma-next migration graph --dot',
    'prisma-next migration graph --ascii',
    'prisma-next migration graph --legend',
    'prisma-next migration graph --space app',
  ]);
  setCommandSeeAlso(command, [
    { verb: 'migration status', oneLiner: 'Show migration path and pending status' },
    { verb: 'migration log', oneLiner: 'Show executed migration history' },
    { verb: 'migration list', oneLiner: 'List on-disk migrations' },
    { verb: 'migration show', oneLiner: 'Display migration package contents' },
  ]);
  addGlobalOptions(command)
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--space <id>', 'Narrow output to a single contract space')
    .option('--dot', 'Output in Graphviz DOT format')
    .option('--ascii', 'Use ASCII glyphs (pipe-friendly)')
    .option('--legend', 'Print a key for the tree glyphs and lane colors')
    .action(async (options: MigrationGraphOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);
      const legendValidation = validateLegendOptions(options, flags);
      if (!legendValidation.ok) {
        process.exit(handleResult(legendValidation, flags, ui));
      }
      const result = await executeMigrationGraphCommand(options, flags, ui);
      const exitCode = handleResult(result, flags, ui, (graphResult) => {
        if (options.dot) {
          ui.output(renderMigrationGraphDot(graphResult.graph));
        } else if (flags.json) {
          const jsonResult: MigrationGraphJsonResult = {
            ok: true,
            spaces: [...graphResult.spaces],
            summary: graphResult.summary,
          };
          ui.output(JSON.stringify(jsonResult, null, 2));
        } else if (!flags.quiet) {
          ui.output(formatMigrationGraphHumanOutput(graphResult));
        }
      });
      process.exit(exitCode);
    });
  return command;
}
