import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { log } from './logger';
import type {
  TelemetryRequestHandler,
  TelemetryServer,
  TelemetryServerStartOptions,
} from './server-runtime';

export type NodeTelemetryServer = TelemetryServer;

function methodAllowsBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function toRequestUrl(request: IncomingMessage): string {
  const host = request.headers.host ?? 'localhost';
  return `http://${host}${request.url ?? '/'}`;
}

function toHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }
    headers.set(name, value);
  }
  return headers;
}

function toWebRequest(request: IncomingMessage): Request {
  const method = request.method ?? 'GET';
  const init: RequestInit & { duplex?: 'half' } = {
    headers: toHeaders(request),
    method,
  };

  if (methodAllowsBody(method)) {
    init.body = Readable.toWeb(request);
    init.duplex = 'half';
  }

  return new Request(toRequestUrl(request), init);
}

async function writeResponse(response: Response, serverResponse: ServerResponse): Promise<void> {
  serverResponse.statusCode = response.status;
  if (response.statusText.length > 0) {
    serverResponse.statusMessage = response.statusText;
  }
  for (const [name, value] of response.headers) {
    serverResponse.setHeader(name, value);
  }

  if (response.body === null) {
    serverResponse.end();
    return;
  }

  serverResponse.end(Buffer.from(await response.arrayBuffer()));
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function handleNodeRequest(
  handler: TelemetryRequestHandler,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const remoteAddress = request.socket.remoteAddress;
    const handlerInfo = remoteAddress !== undefined ? { remoteAddress } : undefined;
    const handlerResponse = await handler(toWebRequest(request), handlerInfo);
    await writeResponse(handlerResponse, response);
  } catch (error) {
    log.error({
      event: 'request-internal-error',
      error: error instanceof Error ? error.message : String(error),
    });
    if (response.writableEnded) {
      return;
    }
    if (response.headersSent) {
      response.destroy(toError(error));
      return;
    }
    response.statusCode = 500;
    response.end('Internal Server Error');
  }
}

function resolveServerPort(server: ReturnType<typeof createServer>, fallback: number): number {
  const address = server.address();
  return address !== null && typeof address !== 'string' ? address.port : fallback;
}

function waitForListening(server: ReturnType<typeof createServer>, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off('error', onError);
      server.off('listening', onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function startNodeTelemetryServer(
  options: TelemetryServerStartOptions,
): Promise<NodeTelemetryServer> {
  const server = createServer((request, response) => {
    void handleNodeRequest(options.handler, request, response);
  });
  await waitForListening(server, options.port);

  return {
    port: resolveServerPort(server, options.port),
    stop: () => closeServer(server),
  };
}
