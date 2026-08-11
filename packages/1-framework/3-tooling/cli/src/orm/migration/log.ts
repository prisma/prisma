import type { LedgerEntryRecord } from '@internal/contract/types';
import { ifDefined } from '@internal/utils/defined';
import type { Presentations } from '@prisma/cli-engine';
import { defineCommand, flag } from '@prisma/cli-engine';
import { notOk, ok } from '@prisma/cli-engine/protocol';
import type { MigrationLogResult } from '../../commands/json/schemas';
import { createControlClient } from '../../control-api/client';
import { mapCaughtMigrationError } from '../../control-api/operations/caught-errors';
import {
  errorTargetMigrationNotSupported,
  errorUnexpected,
  requireLiveDatabase,
} from '../../utils/cli-errors';
import { maskConnectionUrl, targetSupportsMigrations } from '../../utils/command-helpers';
import { createAnsiMigrationListStyler } from '../../utils/formatters/migration-list-styler';
import {
  MIGRATION_LOG_EMPTY_MESSAGE,
  renderMigrationLogTable,
  serializeLedgerEntriesForJson,
} from '../../utils/formatters/migration-log-table';
import type { GlyphMode } from '../../utils/glyph-mode';
import { ormConfigSection } from '../config-section';
import { dbFlag } from '../flags';
import { normalizeError } from '../normalize-error';

function logPresentations(inputs: {
  readonly document: MigrationLogResult;
  readonly lines: readonly string[];
  readonly database: string | undefined;
}): Presentations {
  return {
    human: () =>
      inputs.database === undefined
        ? []
        : [{ kind: 'fields', rows: [{ label: 'database', value: inputs.database }] }],
    stdout: () => inputs.lines,
    json: () => inputs.document,
  };
}

function logLines(
  entries: readonly LedgerEntryRecord[],
  options: { readonly utc: boolean; readonly glyphMode: GlyphMode },
): readonly string[] {
  if (entries.length === 0) {
    return [MIGRATION_LOG_EMPTY_MESSAGE];
  }
  return renderMigrationLogTable(entries, {
    utc: options.utc,
    styler: createAnsiMigrationListStyler({ useColor: false }),
    glyphMode: options.glyphMode,
  }).split('\n');
}

export const migrationLogCommand = defineCommand({
  help: {
    summary: 'Show executed migration history',
    description:
      'Reads the database ledger and displays every applied migration edge in\n' +
      'chronological order, including rollbacks and re-applies, merged across\n' +
      'all contract spaces. Requires a database connection.',
    examples: [
      'migration log',
      'migration log --db $DATABASE_URL',
      'migration log --utc',
      'migration log --json',
    ],
  },
  args: {
    flags: {
      db: dbFlag,
      utc: flag.boolean({ brief: 'Render human timestamps in UTC instead of local time' }),
      ascii: flag.boolean({ brief: 'Use ASCII glyphs (pipe-friendly)' }),
    },
  },
  needs: { config: ormConfigSection },
  handler: async (args, ctx) => {
    const dbConnection = args.flags.db ?? ctx.config.db?.connection;
    const missingDb = requireLiveDatabase({
      dbConnection,
      hasDriver: ctx.config.driver !== undefined,
      why: 'migration log needs a database connection and driver to read the ledger (set db.connection in prisma-next.config.ts, or pass --db <url>)',
      commandName: 'migration log',
    });
    if (missingDb !== null) {
      return notOk(normalizeError(missingDb));
    }
    if (!targetSupportsMigrations(ctx.config.target)) {
      return notOk(
        normalizeError(
          errorTargetMigrationNotSupported({
            why: 'migration log reads the ledger a migration runner writes, and the configured target provides no runner.',
          }),
        ),
      );
    }

    const client = createControlClient({
      family: ctx.config.family,
      target: ctx.config.target,
      adapter: ctx.config.adapter,
      ...ifDefined('driver', ctx.config.driver),
      extensions: ctx.config.extensions ?? [],
    });

    let entries: readonly LedgerEntryRecord[];
    try {
      await client.connect(dbConnection);
      entries = await client.readLedger();
    } catch (error) {
      const mapped = mapCaughtMigrationError(error);
      return notOk(
        normalizeError(
          mapped ??
            errorUnexpected(error instanceof Error ? error.message : String(error), {
              why: `Failed to read migration log: ${error instanceof Error ? error.message : String(error)}`,
            }),
        ),
      );
    } finally {
      await client.close();
    }

    const records = serializeLedgerEntriesForJson(entries);
    const document: MigrationLogResult = {
      ok: true,
      records,
      summary: `${records.length} migration(s) applied`,
    };
    const glyphMode: GlyphMode = args.flags.ascii ? 'ascii' : 'unicode';

    return ok(
      ctx.present(
        { data: document },
        logPresentations({
          document,
          lines: logLines(entries, { utc: args.flags.utc, glyphMode }),
          database: typeof dbConnection === 'string' ? maskConnectionUrl(dbConnection) : undefined,
        }),
      ),
    );
  },
});
