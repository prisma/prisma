import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { type NodeTelemetryServer, startNodeTelemetryServer } from '../src/node-server';

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('ephemeral port server did not bind to a TCP address'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

describe('Node telemetry server adapter', () => {
  let server: NodeTelemetryServer | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it('serves handler responses over node:http and passes the socket address', async () => {
    const seen: Array<{
      readonly method: string;
      readonly url: string;
      readonly body: string;
      readonly remoteAddress: string | undefined;
    }> = [];

    server = await startNodeTelemetryServer({
      port: await freePort(),
      async handler(request, info) {
        seen.push({
          method: request.method,
          url: request.url,
          body: await request.text(),
          remoteAddress: info?.remoteAddress,
        });
        return new Response('accepted', {
          status: 202,
          headers: { 'x-telemetry-test': 'node' },
        });
      },
    });

    const response = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });

    expect(response.status).toBe(202);
    expect(response.headers.get('x-telemetry-test')).toBe('node');
    expect(await response.text()).toBe('accepted');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.url).toBe(`http://127.0.0.1:${server.port}/events`);
    expect(seen[0]?.body).toBe('{"ok":true}');
    expect(seen[0]?.remoteAddress).toEqual(expect.any(String));
  });
});
