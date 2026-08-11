/**
 * `migration new` — scaffolds a migration package with a `migration.ts` file
 * for manual authoring.
 *
 * The planner's `emptyMigration(context)` returns a
 * `MigrationPlanWithAuthoringSurface`, whose `renderTypeScript(resolver)`
 * produces the target-appropriate empty stub. The CLI writes the returned
 * source verbatim.
 *
 * The resolver is the one this project's own manifest implies, so the
 * scaffold names packages the project can resolve — the same resolver
 * `contract emit` hands to the emitter (ADR 242).
 */

import { loadConfigForSections } from '@internal/config-loader';
import { ifDefined } from '@internal/utils/defined';
import type { Result } from '@internal/utils/result';
import { Command } from 'commander';
import type { MigrationNewResult } from '../control-api/operations/migration-new';
import { executeMigrationNewCommand } from '../control-api/operations/migration-new';
import type { CliStructuredError } from '../utils/cli-errors';
import {
  addGlobalOptions,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { parseGlobalFlagsOrExit } from '../utils/global-flags';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI } from '../utils/terminal-ui';

interface MigrationNewCommandOptions extends CommonCommandOptions {
  readonly name?: string;
  readonly from?: string;
  readonly config?: string;
}

async function runMigrationNew(
  options: MigrationNewCommandOptions,
): Promise<Result<MigrationNewResult, CliStructuredError>> {
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
  return executeMigrationNewCommand({
    ...options,
    config: configResult.value,
    cwd: process.cwd(),
    ...ifDefined('configPath', options.config),
  });
}

export function createMigrationNewCommand(): Command {
  const command = new Command('new');
  setCommandDescriptions(
    command,
    'Scaffold a new migration for manual authoring',
    'Creates a migration package with a migration.ts file for manual authoring.\n' +
      'Write the migration body in migration.ts, then run the file with Node\n' +
      '(`node migration.ts`) to self-emit ops.json and attest the package.',
  );
  setCommandExamples(command, [
    'prisma-next migration new --name split-name',
    'prisma-next migration new --name custom-fk --from abc123...',
  ]);
  addGlobalOptions(command)
    .option('--name <slug>', 'Migration name (used in directory name)')
    .option('--from <hash>', 'Starting contract hash (default: latest migration target)')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(async (options: MigrationNewCommandOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);

      if (!flags.json && !flags.quiet) {
        const header = formatStyledHeader({
          command: 'migration new',
          description: 'Scaffold a new migration',
          details: [],
          flags,
        });
        ui.stderr(header);
      }

      const result = await runMigrationNew(options);

      const exitCode = handleResult(result, flags, ui, (value) => {
        if (flags.json) {
          ui.output(JSON.stringify(value, null, 2));
        } else if (!flags.quiet) {
          ui.output(`\nScaffolded migration at ${value.dir}`);
          ui.output(`  from: ${value.from}`);
          ui.output(`  to:   ${value.to}`);
          ui.output(
            `\nEdit migration.ts, then run it directly (\`node "${value.dir}/migration.ts"\`) to self-emit and attest.`,
          );
        }
      });

      process.exit(exitCode);
    });

  return command;
}
