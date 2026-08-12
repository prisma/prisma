import { defineServerCommand, flag } from '@prisma/cli-engine';

/**
 * R-S5-12 asks every command to end at 143 for SIGTERM and 130 otherwise, and
 * a server command is the one kind the engine leaves to do it: it settles the
 * handler's code verbatim, on the reasoning that a protocol conclusion was
 * never the CLI's to author. The two readings are in tension — this one wins
 * here, and the tension is recorded for the engine's owners, because it means
 * a SIGTERM landing after a clean `shutdown` reports 143 for a conversation
 * that ended correctly at 0.
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
      // The only launch argument accepted. `vscode-languageclient` appends
      // `--clientProcessId=<pid>` to every server its NodeModule form spawns,
      // and that launch fails here — as it does on the commander shell, which
      // refuses it as an unknown option. Declaring the flag is not the fix on
      // its own: `vscode-languageserver/node` reads that argument off
      // `process.argv` when it is imported and starts a three-second interval
      // to watch the parent, which outlives the conversation and leaves this
      // bin — which returns rather than ending the process — hanging on a
      // settled run.
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
      stderr: io.stderr,
      signal: io.signal,
    });
    return io.signal.aborted ? signalExitCode(io.signal.reason) : exitCode;
  },
});
