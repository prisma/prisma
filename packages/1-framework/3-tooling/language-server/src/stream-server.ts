import {
  createConnection,
  type DataCallback,
  type Message,
  type MessageReader,
  type MessageWriter,
  ProposedFeatures,
  type WatchDog,
} from 'vscode-languageserver';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-languageserver/node';
import { createServer } from './server';
import { byteInputStream, type LanguageServerStreams, textOutputStream } from './stdio-transport';

/**
 * Runs the server over the host's streams and resolves with the exit code the
 * client's departure implies. The host owns the process, so nothing here ends
 * it; every route out settles the promise instead.
 */
export function runServerOverStreams(streams: LanguageServerStreams): Promise<number> {
  const input = byteInputStream(streams.stdin);
  const inputMessages = new StreamMessageReader(input);
  const outputMessages = new StreamMessageWriter(textOutputStream(streams.stdout));

  return new Promise<number>((resolve) => {
    let settled = false;
    /**
     * Every step a message takes — decoded by the reader, dispatched by the
     * connection, written back out — bumps this. Each step takes its own turn of
     * the event loop, so neither an `exit` notification nor the end of the input
     * means the work is done: the reply to the message before it may still be on
     * its way out.
     */
    let progress = 0;

    function settle(code: number): void {
      if (settled) {
        return;
      }
      settled = true;
      server.dispose();
      input.destroy();
      resolve(code);
    }

    /** Settles once a turn passes with the conversation standing still. */
    function settleWhenQuiet(code: () => number): void {
      const seen = progress;
      setImmediate(() => {
        if (settled) {
          return;
        }
        if (progress === seen) {
          settle(code());
          return;
        }
        settleWhenQuiet(code);
      });
    }

    /** LSP reserves 0 for a client that asked to shut down before leaving. */
    function departureCode(): number {
      return watchDog.shutdownReceived ? 0 : 1;
    }

    const reader: MessageReader = {
      onError: inputMessages.onError,
      onClose: inputMessages.onClose,
      onPartialMessage: inputMessages.onPartialMessage,
      listen: (callback: DataCallback) =>
        inputMessages.listen((message) => {
          progress += 1;
          callback(message);
        }),
      dispose: () => inputMessages.dispose(),
    };

    const writer: MessageWriter = {
      onError: outputMessages.onError,
      onClose: outputMessages.onClose,
      write: (message: Message) => {
        progress += 1;
        return outputMessages.write(message).finally(() => {
          progress += 1;
        });
      },
      end: () => outputMessages.end(),
      dispose: () => outputMessages.dispose(),
    };

    const watchDog: WatchDog = {
      shutdownReceived: false,
      // The node transport polls the client's process id here and exits when
      // the editor dies. Over injected stdio that arrives as end of input.
      initialize: () => undefined,
      exit: (code) => settleWhenQuiet(() => code),
    };
    const server = createServer(
      createConnection(
        (logger) =>
          createProtocolConnection(reader, writer, logger, {
            messageStrategy: {
              handleMessage: (message, next) => {
                progress += 1;
                return next(message);
              },
            },
          }),
        watchDog,
        ProposedFeatures.all,
      ),
    );

    inputMessages.onClose(() => settleWhenQuiet(departureCode));

    const hostShutdown = streams.signal;
    if (hostShutdown?.aborted === true) {
      settleWhenQuiet(departureCode);
    } else {
      hostShutdown?.addEventListener('abort', () => settleWhenQuiet(departureCode), { once: true });
    }
  });
}
