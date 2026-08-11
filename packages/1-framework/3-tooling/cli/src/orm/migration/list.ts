import { ifDefined } from '@internal/utils/defined';
import type { Presentations } from '@prisma/cli-engine';
import { flag } from '@prisma/cli-engine';
import { notOk, ok } from '@prisma/cli-engine/protocol';
import { buildReadAggregate } from '../../control-api/operations/contract-space-aggregate-loader';
import {
  migrationSpaceListEntriesFromAggregate,
  runMigrationList,
} from '../../control-api/operations/migration-list';
import { renderMigrationGraphLegend } from '../../utils/formatters/migration-graph-labels';
import { renderMigrationListWithStyle } from '../../utils/formatters/migration-list-render';
import { createAnsiMigrationListStyler } from '../../utils/formatters/migration-list-styler';
import type { MigrationListResult } from '../../utils/formatters/migration-list-types';
import type { GlyphMode } from '../../utils/glyph-mode';
import { ormConfigSection } from '../config-section';
import { defineOrmCommand } from '../define-command';
import { normalizeError } from '../normalize-error';
import { displayPath, migrationsDirFor } from './paths';

function listPresentations(inputs: {
  readonly list: MigrationListResult;
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
    json: () => inputs.list,
  };
}

export const migrationListCommand = defineOrmCommand({
  help: {
    summary: 'List on-disk migrations per contract space',
    description:
      'Enumerates every on-disk migration under migrations/<space>/ for every\n' +
      'contract space found on disk. Offline — does not consult the database.\n' +
      'Human output draws the shared migration graph tree with operation counts,\n' +
      'invariants on each migration row, and refs on destination contract nodes.\n' +
      'Pass --space <id> to narrow to one contract space. --ascii forces ASCII\n' +
      'tree glyphs.',
    examples: [
      'migration list',
      'migration list --space app',
      'migration list --ascii',
      'migration list --legend',
      'migration list --json',
    ],
  },
  args: {
    flags: {
      space: flag.string({ brief: 'Narrow output to a single contract space', placeholder: 'id' }),
      ascii: flag.boolean({ brief: 'Use ASCII kind glyphs (pipe-friendly)' }),
      legend: flag.boolean({ brief: 'Print a key for the tree glyphs and lane colors' }),
    },
  },
  needs: { config: ormConfigSection },
  handler: async (args, ctx) => {
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

    const glyphMode: GlyphMode = args.flags.ascii ? 'ascii' : 'unicode';
    const lines = renderMigrationListWithStyle(
      listed.value,
      createAnsiMigrationListStyler({ useColor: false }),
      glyphMode,
      {
        colorize: false,
        liveContractHash,
        graphForSpace: (spaceId) => aggregate.space(spaceId)?.graph(),
        appSpaceId: aggregate.app.spaceId,
      },
    ).split('\n');

    const legendLines = args.flags.legend
      ? renderMigrationGraphLegend({ colorize: false, glyphMode }).split('\n')
      : [];

    return ok(
      ctx.present(
        { data: listed.value },
        listPresentations({
          list: listed.value,
          lines,
          migrationsDir: displayPath(migrationsDir, ctx.cwd),
          space: args.flags.space,
          legendLines,
        }),
      ),
    );
  },
});
