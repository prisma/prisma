import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createServer, type LanguageServer } from './server';

export function startServer(): LanguageServer {
  const connection = createConnection(ProposedFeatures.all);
  return createServer(connection);
}
