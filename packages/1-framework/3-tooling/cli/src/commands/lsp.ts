import { Command } from 'commander';
import {
  addGlobalOptions,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';

export function createLspCommand(): Command {
  const command = new Command('lsp');
  setCommandDescriptions(
    command,
    'Start the Prisma Next language server',
    'Launches a Language Server Protocol server that publishes PSL parse diagnostics\n' +
      'and handles whole-document PSL formatting for the schema inputs declared in\n' +
      'your config (contract.source.inputs). Formatting uses the Prisma Next PSL\n' +
      'formatter and the formatter block from the project config.\n' +
      'Communicates over stdio; intended to be spawned by an\n' +
      'editor, not run interactively. The server keeps running until the editor client\n' +
      'disconnects.',
  );
  setCommandExamples(command, ['prisma-next lsp --stdio']);
  addGlobalOptions(command)
    .option('--stdio', 'Communicate with the editor over stdio (the default and only transport)')
    // `vscode-languageclient` appends this to every server its NodeModule
    // form spawns. `vscode-languageserver/node` reads it off `process.argv`
    // itself and watches the parent; commander only needs to not refuse it.
    .option(
      '--clientProcessId <pid>',
      'Process id of the editor that spawned the server; the server ends when it dies',
    )
    .action(async () => {
      // Lazy import so `vscode-languageserver` stays off every other command's
      // startup path — only `prisma-next lsp` pays its load cost.
      const { startServer } = await import('@internal/language-server');
      startServer();
    });

  return command;
}
