import { DOCS_BASE } from '@internal/utils/structured-error';
import type { AnyCommand, RedirectSpec } from '@prisma/cli-engine';
import { defineCommandFamily } from '@prisma/cli-engine';
import { ormConfigSection } from './config-section';
import { migrationGraphCommand } from './migration/graph';
import { migrationListCommand } from './migration/list';
import { migrationLogCommand } from './migration/log';
import { migrationNewCommand } from './migration/new';
import { migrationPlanCommand } from './migration/plan';
import { migrationShowCommand } from './migration/show';
import { migrationStatusCommand } from './migration/status';

/**
 * The engine derives each diagnostic's docs link from this base plus the
 * dotted code.
 */
const DOCS_BASE_URL = `${DOCS_BASE}/`;

const commands: Readonly<Record<string, AnyCommand>> = {
  'migration graph': migrationGraphCommand,
  'migration list': migrationListCommand,
  'migration log': migrationLogCommand,
  'migration new': migrationNewCommand,
  'migration plan': migrationPlanCommand,
  'migration show': migrationShowCommand,
  'migration status': migrationStatusCommand,
};

/**
 * The invocations the ORM retired, so an old command line gets the replacement
 * rather than a spelling suggestion. Replacements name the binary as `{bin}`;
 * the engine substitutes the shell's own name.
 *
 * The four flag redirects name `migration status`, which the engine requires
 * to be a mounted command.
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
  {
    from: 'migration status',
    flag: 'graph',
    replacement: '{bin} migration graph',
    reason: 'Topology is its own command rather than a mode of the status report.',
  },
  {
    from: 'migration status',
    flag: 'all',
    replacement: '{bin} migration log --db <url>',
    reason: 'Execution history is read from the database ledger, which is what migration log does.',
  },
  {
    from: 'migration status',
    flag: 'limit',
    replacement: '{bin} migration log --db <url>',
    reason: 'Execution history is read from the database ledger, which is what migration log does.',
  },
  {
    from: 'migration status',
    flag: 'ref',
    replacement: '{bin} migration status --to <contract>',
    reason: 'One flag names the target contract, whether it is a ref, a hash or a migration.',
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
