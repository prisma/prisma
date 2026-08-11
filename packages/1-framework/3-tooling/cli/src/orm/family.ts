import { DOCS_BASE } from '@internal/utils/structured-error';
import type { AnyCommand } from '@prisma/cli-engine';
import { defineCommandFamily } from '@prisma/cli-engine';
import { ormConfigSection } from './config-section';
import { migrationListCommand } from './migration/list';
import { migrationLogCommand } from './migration/log';
import { migrationShowCommand } from './migration/show';

/**
 * The engine derives each diagnostic's docs link from this base plus the
 * dotted code.
 */
const DOCS_BASE_URL = `${DOCS_BASE}/`;

const commands: Readonly<Record<string, AnyCommand>> = {
  'migration list': migrationListCommand,
  'migration log': migrationLogCommand,
  'migration show': migrationShowCommand,
};

/**
 * The unit the ORM contributes to a CLI: its config section, its commands by
 * name, and where its diagnostics are documented. The shell owns the command
 * tree, so nothing here says where a command mounts.
 */
export const ormCommandFamily = defineCommandFamily({
  configSection: ormConfigSection,
  commands,
  docsBaseUrl: DOCS_BASE_URL,
});
