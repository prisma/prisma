import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createConnection,
  ExitNotification,
  InitializedNotification,
  InitializeRequest,
  type InitializeResult,
  ShutdownRequest,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { startServer } from '../src/start-server';

const rootUri = pathToFileURL(tmpdir()).toString();

/** A non-ASCII string whose UTF-8 encoding is longer than its length. */
const multiByteText = 'ünïcødé π 日本語 🎉';

function framed(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]);
}

interface Frame {
  readonly contentLength: number;
  readonly body: string;
}

function parseFrames(text: string): readonly Frame[] {
  const bytes = Buffer.from(text, 'utf8');
  const frames: Frame[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const headerEnd = bytes.indexOf('\r\n\r\n', offset, 'ascii');
    if (headerEnd === -1) {
      break;
    }
    const declared = /content-length: *(\d+)/i.exec(
      bytes.toString('ascii', offset, headerEnd),
    )?.[1];
    if (declared === undefined) {
      throw new Error(`Frame without a Content-Length header: ${text.slice(offset)}`);
    }
    const contentLength = Number(declared);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;
    if (bytes.length < bodyEnd) {
      break;
    }
    frames.push({ contentLength, body: bytes.toString('utf8', bodyStart, bodyEnd) });
    offset = bodyEnd;
  }
  return frames;
}

/** The `stdout` half of the pair, plus the ability to await frames on it. */
function serverOutput(): {
  readonly write: (text: string) => void;
  readonly frames: () => readonly Frame[];
  readonly waitForFrames: (count: number) => Promise<readonly Frame[]>;
} {
  let text = '';
  const waiters: { count: number; resolve: () => void }[] = [];
  const frames = (): readonly Frame[] => parseFrames(text);
  return {
    write: (chunk) => {
      text += chunk;
      for (const waiter of [...waiters]) {
        if (frames().length >= waiter.count) {
          waiters.splice(waiters.indexOf(waiter), 1);
          waiter.resolve();
        }
      }
    },
    frames,
    waitForFrames: async (count) => {
      if (frames().length < count) {
        await new Promise<void>((resolve) => waiters.push({ count, resolve }));
      }
      return frames();
    },
  };
}

/** A client speaking real LSP over the injected pair. */
function connectedClient(stdin: PassThrough): {
  readonly client: ReturnType<typeof createConnection>;
  readonly stdout: { readonly write: (text: string) => void };
} {
  const serverToClient = new PassThrough();
  const client = createConnection(
    new StreamMessageReader(serverToClient),
    new StreamMessageWriter(stdin),
  );
  client.listen();
  return { client, stdout: { write: (text) => void serverToClient.write(text, 'utf8') } };
}

const initializeParams = {
  processId: null,
  rootUri,
  capabilities: {},
  workspaceFolders: [{ uri: rootUri, name: multiByteText }],
};

describe('startServer over injected streams', () => {
  it('answers initialize and exits 0 after shutdown', async () => {
    const stdin = new PassThrough();
    const { client, stdout } = connectedClient(stdin);
    const exitCode = startServer({ stdin, stdout });

    const initialized = await client.sendRequest(InitializeRequest.type, initializeParams);
    client.sendNotification(InitializedNotification.type, {});
    await client.sendRequest(ShutdownRequest.type, undefined);
    client.sendNotification(ExitNotification.type);

    expect(initialized.capabilities).toMatchObject({
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentFormattingProvider: true,
      foldingRangeProvider: true,
    });
    await expect(exitCode).resolves.toBe(0);
  });

  it('exits 1 when the client disconnects without shutting down', async () => {
    const stdin = new PassThrough();
    const { client, stdout } = connectedClient(stdin);
    const exitCode = startServer({ stdin, stdout });

    await client.sendRequest(InitializeRequest.type, initializeParams);
    stdin.end();

    await expect(exitCode).resolves.toBe(1);
  });

  it('exits 0 when the client disconnects after asking to shut down', async () => {
    const stdin = new PassThrough();
    const { client, stdout } = connectedClient(stdin);
    const exitCode = startServer({ stdin, stdout });

    await client.sendRequest(InitializeRequest.type, initializeParams);
    await client.sendRequest(ShutdownRequest.type, undefined);
    stdin.end();

    await expect(exitCode).resolves.toBe(0);
  });

  it('stops the server when the host had already aborted', async () => {
    const host = new AbortController();
    host.abort('SIGTERM');

    const exitCode = startServer({
      stdin: new PassThrough(),
      stdout: { write: () => undefined },
      signal: host.signal,
    });

    await expect(exitCode).resolves.toBe(1);
  });

  it('stops the server when the host aborts the run', async () => {
    const stdin = new PassThrough();
    const { client, stdout } = connectedClient(stdin);
    const host = new AbortController();
    const exitCode = startServer({ stdin, stdout, signal: host.signal });

    await client.sendRequest(InitializeRequest.type, initializeParams);
    host.abort('SIGTERM');

    await expect(exitCode).resolves.toBe(1);
  });
});

describe('startServer byte framing', () => {
  it('reads a request whose frame is split mid-character across two chunks', async () => {
    const stdin = new PassThrough();
    const out = serverOutput();
    const exitCode = startServer({ stdin, stdout: out });

    const request = framed({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: initializeParams,
    });
    const splitAt = request.indexOf(Buffer.from('ü', 'utf8')) + 1;
    expect(splitAt).toBeGreaterThan(0);
    stdin.write(request.subarray(0, splitAt));
    stdin.write(request.subarray(splitAt));

    const [response] = await out.waitForFrames(1);
    expect(response).toBeDefined();
    const parsed: { readonly id: number; readonly result: InitializeResult } = JSON.parse(
      response?.body ?? '',
    );
    expect(parsed.id).toBe(1);
    expect(parsed.result.capabilities.documentFormattingProvider).toBe(true);

    stdin.end();
    await expect(exitCode).resolves.toBe(1);
  });

  it('declares the byte length, not the character length, of a multi-byte response', async () => {
    const stdin = new PassThrough();
    const out = serverOutput();
    const exitCode = startServer({ stdin, stdout: out });

    stdin.write(framed({ jsonrpc: '2.0', id: 1, method: 'initialize', params: initializeParams }));
    await out.waitForFrames(1);
    stdin.write(framed({ jsonrpc: '2.0', id: 2, method: `prisma/${multiByteText}` }));

    const frames = await out.waitForFrames(2);
    const response = frames[1];
    expect(response).toBeDefined();
    const parsed: { readonly error: { readonly message: string } } = JSON.parse(
      response?.body ?? '',
    );
    expect(parsed.error.message).toContain(multiByteText);
    expect(response?.contentLength).toBe(Buffer.byteLength(response?.body ?? '', 'utf8'));
    expect(response?.contentLength).toBeGreaterThan(response?.body.length ?? 0);

    stdin.end();
    await expect(exitCode).resolves.toBe(1);
  });

  it('reads a host that yields plain Uint8Array chunks rather than Buffers', async () => {
    const script = Buffer.concat([
      framed({ jsonrpc: '2.0', id: 1, method: 'initialize', params: initializeParams }),
      framed({ jsonrpc: '2.0', id: 2, method: 'shutdown' }),
      framed({ jsonrpc: '2.0', method: 'exit' }),
    ]);
    const bytes = new TextEncoder().encode(script.toString('utf8'));
    const out = serverOutput();

    const exitCode = await startServer({
      stdin: {
        async *[Symbol.asyncIterator]() {
          yield bytes;
        },
      },
      stdout: out,
    });

    expect(out.frames()).toHaveLength(2);
    expect(exitCode).toBe(0);
  });
});
