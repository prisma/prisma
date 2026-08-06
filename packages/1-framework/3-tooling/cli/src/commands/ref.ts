import { Command } from 'commander';
import {
  executeRefDeleteCommand,
  executeRefListCommand,
  executeRefSetCommand,
} from '../control-api/operations/ref';
import { addGlobalOptions, setCommandDescriptions } from '../utils/command-helpers';
import { formatCommandHelp } from '../utils/formatters/help';
import { parseGlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI } from '../utils/terminal-ui';

function createRefSetCommand(): Command {
  const command = new Command('set');
  setCommandDescriptions(
    command,
    'Set a ref to a contract reference',
    'Sets a named ref to point to a resolved contract reference (hash, alias, or path) in migrations/refs/.',
  );
  addGlobalOptions(command)
    .argument('<name>', 'Ref name (e.g., staging, production)')
    .argument(
      '<contract>',
      'Contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path)',
    )
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(
      async (
        name: string,
        hash: string,
        options: { config?: string; json?: string | boolean; quiet?: boolean },
      ) => {
        const flags = parseGlobalFlagsOrExit(options);
        const ui = createTerminalUI(flags);
        const result = await executeRefSetCommand(name, hash, options);
        const exitCode = handleResult(result, flags, ui, (value) => {
          if (flags.json) {
            ui.output(JSON.stringify(value));
          } else if (!flags.quiet) {
            ui.output(`Set ref "${value.ref}" → ${value.hash}`);
          }
        });
        process.exit(exitCode);
      },
    );
  return command;
}

function createRefDeleteCommand(): Command {
  const command = new Command('delete');
  setCommandDescriptions(command, 'Delete a ref', 'Removes a named ref from migrations/refs/.');
  addGlobalOptions(command)
    .argument('<name>', 'Ref name to delete')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(
      async (
        name: string,
        options: { config?: string; json?: string | boolean; quiet?: boolean },
      ) => {
        const flags = parseGlobalFlagsOrExit(options);
        const ui = createTerminalUI(flags);
        const result = await executeRefDeleteCommand(name, options);
        const exitCode = handleResult(result, flags, ui, (value) => {
          if (flags.json) {
            ui.output(JSON.stringify(value));
          } else if (!flags.quiet) {
            ui.output(`Deleted ref "${value.ref}"`);
          }
        });
        process.exit(exitCode);
      },
    );
  return command;
}

function createRefListCommand(): Command {
  const command = new Command('list');
  setCommandDescriptions(command, 'List all refs', 'Lists all named refs from migrations/refs/.');
  addGlobalOptions(command)
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(async (options: { config?: string; json?: string | boolean; quiet?: boolean }) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);
      const result = await executeRefListCommand(options);
      const exitCode = handleResult(result, flags, ui, (value) => {
        if (flags.json) {
          ui.output(JSON.stringify(value));
        } else if (!flags.quiet) {
          const entries = Object.entries(value.refs);
          if (entries.length === 0) {
            ui.output('No refs defined');
          } else {
            for (const [refName, entry] of entries) {
              const invariantsSuffix =
                entry.invariants.length > 0 ? ` [invariants: ${entry.invariants.join(', ')}]` : '';
              ui.output(`${refName} → ${entry.hash}${invariantsSuffix}`);
            }
          }
        }
      });
      process.exit(exitCode);
    });
  return command;
}

export function createRefCommand(): Command {
  const command = new Command('ref');
  setCommandDescriptions(
    command,
    'Manage contract refs',
    'Manage named refs in migrations/refs/. Refs map logical environment\n' +
      'names (e.g., staging, production) to contract hashes.',
  );
  addGlobalOptions(command).configureHelp({
    formatHelp: (cmd) => formatCommandHelp({ command: cmd, flags: parseGlobalFlags({}) }),
    subcommandDescription: () => '',
  });
  command.addCommand(createRefSetCommand());
  command.addCommand(createRefDeleteCommand());
  command.addCommand(createRefListCommand());
  return command;
}
