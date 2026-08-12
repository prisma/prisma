import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createServer } from './server';
import type { LanguageServerStreams } from './stdio-transport';
import { runServerOverStreams } from './stream-server';

/**
 * Starts the language server.
 *
 * Given the host's streams, it speaks LSP over those and resolves with an exit
 * code when the client disconnects. Given nothing, it builds its own transport
 * from the process arguments as before — and on that path
 * `vscode-languageserver/node` ends the process itself rather than returning,
 * so the promise never settles.
 */
export function startServer(streams?: LanguageServerStreams): Promise<number> {
  if (streams === undefined) {
    createServer(createConnection(ProposedFeatures.all));
    return new Promise<number>(() => undefined);
  }
  return runServerOverStreams(streams);
}
