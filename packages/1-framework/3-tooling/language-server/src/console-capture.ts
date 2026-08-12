import { Console } from 'node:console';
import { type TextSink, textOutputStream } from './stdio-transport';

/**
 * Sends everything written through the global `console` to the host's stderr
 * for the length of the run, and returns the undo.
 *
 * The client owns stdout: anything on it that is not a `Content-Length` frame
 * desynchronises the client for good. `console.log` and friends write straight
 * to the process's own stdout, so one call from anywhere in the dependency
 * graph — resolving a project's config reaches c12 and jiti — corrupts the
 * protocol. `vscode-languageserver/node` redirects the console for exactly
 * this reason when it takes stdio off `process.argv`; over injected streams
 * that never runs, so the redirect happens here.
 *
 * A dependency that writes to `process.stdout` directly still reaches the
 * client. Nothing short of replacing the process's own descriptor covers that,
 * and only the host owns the process.
 */
export function captureConsole(stderr: TextSink): () => void {
  const host = globalThis.console;
  const sink = textOutputStream(stderr);
  globalThis.console = new Console({ stdout: sink, stderr: sink });
  return () => {
    globalThis.console = host;
  };
}
