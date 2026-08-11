import { ifDefined } from '@internal/utils/defined';
import type { Presentations } from '@prisma/cli-engine';
import { flag } from '@prisma/cli-engine';
import { notOk, ok } from '@prisma/cli-engine/protocol';
import type {
  MigrationGraphJsonResult,
  MigrationSpaceGraphEntry,
} from '../../commands/json/schemas';
import { buildReadAggregate } from '../../control-api/operations/contract-space-aggregate-loader';
import { buildMigrationSpaceGraphEntries } from '../../control-api/operations/migration-graph';
import {
  migrationSpaceListEntriesFromAggregate,
  runMigrationList,
} from '../../control-api/operations/migration-list';
import { errorLegendHumanOnly } from '../../utils/cli-errors';
import { renderMigrationGraphLegend } from '../../utils/formatters/migration-graph-labels';
import {
  buildMigrationGraphTreeSections,
  renderMigrationGraphDot,
  renderMigrationGraphSections,
} from '../../utils/formatters/migration-graph-sections';
import type { GlyphMode } from '../../utils/glyph-mode';
import { ormConfigSection } from '../config-section';
import { defineOrmCommand } from '../define-command';
import { normalizeError } from '../normalize-error';
import { displayPath, migrationsDirFor } from './paths';

/**
 * The `--dot` document. DOT is not a `--format` value — the engine owns that
 * flag — so the DOT text is the stdout payload in human mode and rides the json
 * result as a `dot` field alongside the graph document.
 */
interface MigrationGraphDotResult extends MigrationGraphJsonResult {
  readonly dot: string;
}

function graphPresentations(inputs: {
  readonly document: MigrationGraphJsonResult | MigrationGraphDotResult;
  readonly lines: readonly string[];
  readonly migrationsDir: string;
  readonly space: string | undefined;
  readonly legendLines: readonly string[];
}): Presentations {
  return {
    human: () => [
      {
        kind: 'fields',
        rows: [
          { label: 'migrations', value: inputs.migrationsDir },
          ...(inputs.space === undefined ? [] : [{ label: 'space', value: inputs.space }]),
        ],
      },
      ...(inputs.legendLines.length === 0
        ? []
        : [{ kind: 'list' as const, items: [...inputs.legendLines] }]),
    ],
    stdout: () => inputs.lines,
    json: () => inputs.document,
  };
}

function graphSummary(spaces: readonly MigrationSpaceGraphEntry[]): string {
  const contracts = spaces.reduce((count, space) => count + space.contracts.length, 0);
  const migrations = spaces.reduce((count, space) => count + space.migrations.length, 0);
  return `${spaces.length} space(s), ${contracts} contract(s), ${migrations} migration(s)`;
}

export const migrationGraphCommand = defineOrmCommand({
  help: {
    summary: 'Show the migration graph topology',
    description:
      'Renders the migration graph topology. Offline — does not consult the\n' +
      'database. --ascii swaps box-drawing for pipe-friendly ASCII glyphs.\n' +
      '--dot emits Graphviz DOT for the app graph instead of the tree, and\n' +
      'ignores --space; in json mode the result carries the DOT text alongside\n' +
      'the graph document.',
    examples: [
      'migration graph',
      'migration graph --json',
      'migration graph --dot',
      'migration graph --ascii',
      'migration graph --legend',
      'migration graph --space app',
    ],
  },
  args: {
    flags: {
      space: flag.string({ brief: 'Narrow output to a single contract space', placeholder: 'id' }),
      dot: flag.boolean({ brief: 'Emit Graphviz DOT for the app graph' }),
      ascii: flag.boolean({ brief: 'Use ASCII glyphs (pipe-friendly)' }),
      legend: flag.boolean({ brief: 'Print a key for the tree glyphs and lane colors' }),
    },
  },
  needs: { config: ormConfigSection },
  handler: async (args, ctx) => {
    if (args.flags.legend && args.flags.dot) {
      return notOk(normalizeError(errorLegendHumanOnly('--dot')));
    }

    const migrationsDir = migrationsDirFor(ctx.config, ctx.cwd);
    const loaded = await buildReadAggregate(ctx.config, { migrationsDir });
    if (!loaded.ok) {
      return notOk(normalizeError(loaded.failure));
    }
    const { aggregate, contractHash: liveContractHash } = loaded.value;

    const spaces = await migrationSpaceListEntriesFromAggregate(aggregate, migrationsDir);
    const listed = runMigrationList({ spaces, ...ifDefined('spaceFilter', args.flags.space) });
    if (!listed.ok) {
      return notOk(normalizeError(listed.failure));
    }
    const scopedSpaces = listed.value.spaces;

    const glyphMode: GlyphMode = args.flags.ascii ? 'ascii' : 'unicode';
    const graphSpaces: MigrationSpaceGraphEntry[] = [
      ...buildMigrationSpaceGraphEntries({ aggregate, scopedSpaces }),
    ];
    const summary = graphSummary(graphSpaces);
    const graphDocument: MigrationGraphJsonResult = { ok: true, spaces: graphSpaces, summary };

    const dot = args.flags.dot ? renderMigrationGraphDot(aggregate.app.graph()) : undefined;
    const document = dot === undefined ? graphDocument : { ...graphDocument, dot };
    const lines =
      dot === undefined
        ? renderMigrationGraphSections(
            buildMigrationGraphTreeSections({
              aggregate,
              scopedSpaces,
              liveContractHash,
              glyphMode,
              colorize: false,
            }),
            summary,
          ).split('\n')
        : dot.split('\n');

    const legendLines = args.flags.legend
      ? renderMigrationGraphLegend({ colorize: false, glyphMode }).split('\n')
      : [];

    return ok(
      ctx.present(
        { data: document },
        graphPresentations({
          document,
          lines,
          migrationsDir: displayPath(migrationsDir, ctx.cwd),
          space: args.flags.space,
          legendLines,
        }),
      ),
    );
  },
});
