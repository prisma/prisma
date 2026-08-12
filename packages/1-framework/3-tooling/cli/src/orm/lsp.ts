import { defineServerCommand, flag } from '@prisma/cli-engine';

/**
 * The engine applies its own signal codes to a settled result, but a server
 * command's exit code is taken verbatim, so this command owns the translation.
 */
function signalExitCode(reason: unknown): number {
  return reason === 'SIGTERM' ? 143 : 130;
}

export const lspCommand = defineServerCommand({
  help: {
    summary: 'Start the Prisma Next language server',
    description:
      'Launches a Language Server Protocol server that publishes PSL parse diagnostics\n' +
      'and handles whole-document PSL formatting for the schema inputs declared in\n' +
      'your config (contract.source.inputs). Formatting uses the Prisma Next PSL\n' +
      'formatter and the formatter block from the project config.\n' +
      'Communicates over stdio; intended to be spawned by an\n' +
      'editor, not run interactively. The server keeps running until the editor client\n' +
      'disconnects.',
    examples: ['lsp'],
  },
  args: {
    flags: {
      stdio: flag.boolean({
        brief: 'Communicate with the editor over stdio (the default and only transport)',
      }),
    },
  },
  handler: async (_args, io) => {
    // Lazy so `vscode-languageserver` stays off every other command's startup
    // path — only this command pays its load cost.
    const { startServer } = await import('@internal/language-server');
    const exitCode = await startServer({
      stdin: io.stdin,
      stdout: io.stdout,
      signal: io.signal,
    });
    return io.signal.aborted ? signalExitCode(io.signal.reason) : exitCode;
  },
});
