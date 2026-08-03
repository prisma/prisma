import { ifDefined } from '@internal/utils/defined';
import { Command } from 'commander';
import { relative, resolve } from 'pathe';
import { executeFormat } from '../control-api/operations/format';
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

interface FormatCommandOptions extends CommonCommandOptions {
  readonly config?: string;
}

export function createFormatCommand(): Command {
  const command = new Command('format');
  setCommandDescriptions(
    command,
    'Format your PSL contract source',
    'Formats the Prisma schema (PSL) contract source declared in your config\n' +
      '(contract.source.inputs[0]) in place. Only runs when contract.source.format\n' +
      "is 'psl'; a TypeScript or unset source is left untouched. Indent and newline are\n" +
      'read from the optional formatter config section, defaulting to two spaces and the\n' +
      'system newline.',
  );
  setCommandExamples(command, [
    'prisma-next format',
    'prisma-next format --config ./custom-config.ts',
  ]);
  addGlobalOptions(command)
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(async (options: FormatCommandOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);

      if (!flags.json && !flags.quiet) {
        const displayConfigPath = options.config
          ? relative(process.cwd(), resolve(options.config))
          : 'prisma-next.config.ts';
        ui.stderr(
          formatStyledHeader({
            command: 'format',
            description: 'Format your PSL contract source',
            details: [{ label: 'config', value: displayConfigPath }],
            flags,
          }),
        );
      }

      const result = await executeFormat({ ...ifDefined('configPath', options.config) });

      const exitCode = handleResult(result, flags, ui, (value) => {
        if (flags.json) {
          ui.output(JSON.stringify(value));
          return;
        }
        if (flags.quiet) {
          return;
        }
        if (value.formatted) {
          ui.success(`Formatted ${relative(process.cwd(), value.path ?? '')}`);
        } else {
          ui.info('Nothing to format (contract source is not PSL).');
        }
      });
      process.exit(exitCode);
    });

  return command;
}
