import { DOCS_BASE } from '@internal/utils/structured-error';
import type { AnyCommand, RedirectSpec } from '@prisma/cli-engine';
import { defineCommandFamily } from '@prisma/cli-engine';
import { ormConfigSection } from './config-section';
import { contractEmitCommand } from './contract/emit';
import { contractInferCommand } from './contract/infer';
import { dbInitCommand } from './db/init';
import { dbSchemaCommand } from './db/schema';
import { dbUpdateCommand } from './db/update';
import { formatCommand } from './format';
import { migrateCommand } from './migrate';
import { migrationGraphCommand } from './migration/graph';
import { migrationListCommand } from './migration/list';
import { migrationLogCommand } from './migration/log';
import { migrationShowCommand } from './migration/show';
import { refDeleteCommand } from './ref/delete';
import { refListCommand } from './ref/list';
import { refSetCommand } from './ref/set';

/**
 * The engine derives each diagnostic's docs link from this base plus the
 * dotted code.
 */
const DOCS_BASE_URL = `${DOCS_BASE}/`;

const commands: Readonly<Record<string, AnyCommand>> = {
  'contract emit': contractEmitCommand,
  'contract infer': contractInferCommand,
  'db init': dbInitCommand,
  'db schema': dbSchemaCommand,
  'db update': dbUpdateCommand,
  format: formatCommand,
  migrate: migrateCommand,
  'migration graph': migrationGraphCommand,
  'migration list': migrationListCommand,
  'migration log': migrationLogCommand,
  'migration show': migrationShowCommand,
  'ref delete': refDeleteCommand,
  'ref list': refListCommand,
  'ref set': refSetCommand,
};

/**
 * The invocations the ORM retired, so an old command line gets the replacement
 * rather than a spelling suggestion. Replacements name the binary as `{bin}`;
 * the engine substitutes the shell's own name.
 *
 * The four retired `migration status` flags (`--graph`, `--all`, `--limit`,
 * `--ref`) are missing on purpose: the engine only accepts a flag redirect
 * whose command is mounted, and `migration status` is not ported yet. They
 * belong with that command.
 */
const redirects: readonly RedirectSpec[] = [
  {
    from: 'migration apply',
    replacement: '{bin} migrate --to <contract>',
    reason: 'Applying a migration is a move to a target contract, not a verb of its own.',
  },
  {
    from: 'migration ref',
    replacement: '{bin} ref set|list|delete',
    reason: 'Refs are managed by their own command, for every space rather than migrations alone.',
  },
];

/**
 * The unit the ORM contributes to a CLI: its config section, its commands by
 * name, where its diagnostics are documented, and the invocations it retired.
 * The shell owns the command tree, so nothing here says where a command mounts.
 */
export const ormCommandFamily = defineCommandFamily({
  configSection: ormConfigSection,
  commands,
  docsBaseUrl: DOCS_BASE_URL,
  redirects,
});
