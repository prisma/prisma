import { createDevDatabase, timeouts } from '@repo/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTelemetryDb, type TelemetryDb } from '../src/db';
import { createHandler } from '../src/handler';
import { createTokenBucketRateLimiter } from '../src/rate-limiter';
import { resetTelemetrySchema } from './db-setup';

const validPayload = {
  installationId: 'install-rl',
  version: '0.8.0',
  command: 'init',
  runtimeName: 'node',
  runtimeVersion: '24.13.0',
  os: 'darwin',
  arch: 'arm64',
};

describe('rate-limited POST /events', () => {
  let database: Awaited<ReturnType<typeof createDevDatabase>>;
  let db: TelemetryDb;

  beforeAll(async () => {
    database = await createDevDatabase();
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    if (database) await database.close();
  }, timeouts.spinUpPpgDev);

  beforeEach(async () => {
    await resetTelemetrySchema(database.connectionString);
    db = createTelemetryDb(database.connectionString);
  });

  afterEach(async () => {
    await db.runtime().close();
  });

  function postFrom(handler: ReturnType<typeof createHandler>, ip: string): Promise<Response> {
    return handler(
      new Request('http://localhost/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
      { remoteAddress: ip },
    );
  }

  async function countRows(): Promise<number> {
    return (await db.orm.public.TelemetryEvent.all()).length;
  }

  it('ignores client-supplied x-forwarded-for by default and keys on the socket address', async () => {
    const keys: string[] = [];
    const handler = createHandler({
      db,
      rateLimiter: {
        allow(key) {
          keys.push(key);
          return true;
        },
      },
    });

    const response = await handler(
      new Request('http://localhost/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.77',
        },
        body: JSON.stringify(validPayload),
      }),
      { remoteAddress: '10.0.0.2' },
    );

    expect(response.status).toBe(202);
    expect(keys).toEqual(['10.0.0.2']);
  });

  it('honours the first x-forwarded-for address when trustForwardedFor is enabled', async () => {
    const keys: string[] = [];
    const handler = createHandler({
      db,
      rateLimiter: {
        allow(key) {
          keys.push(key);
          return true;
        },
      },
      trustForwardedFor: true,
    });

    const response = await handler(
      new Request('http://localhost/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ' 203.0.113.77, 198.51.100.10 ',
        },
        body: JSON.stringify(validPayload),
      }),
      { remoteAddress: '10.0.0.2' },
    );

    expect(response.status).toBe(202);
    expect(keys).toEqual(['203.0.113.77']);
  });

  it('falls back to the server socket address and then unknown', async () => {
    const keys: string[] = [];
    const handler = createHandler({
      db,
      rateLimiter: {
        allow(key) {
          keys.push(key);
          return true;
        },
      },
    });

    function request(): Request {
      return new Request('http://localhost/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
    }

    expect((await handler(request(), { remoteAddress: '10.0.0.3' })).status).toBe(202);
    expect((await handler(request())).status).toBe(202);
    expect(keys).toEqual(['10.0.0.3', 'unknown']);
  });

  it('falls back to the socket address in trusted-proxy mode when x-forwarded-for is absent', async () => {
    const keys: string[] = [];
    const handler = createHandler({
      db,
      rateLimiter: {
        allow(key) {
          keys.push(key);
          return true;
        },
      },
      trustForwardedFor: true,
    });

    const response = await handler(
      new Request('http://localhost/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
      { remoteAddress: '10.0.0.4' },
    );

    expect(response.status).toBe(202);
    expect(keys).toEqual(['10.0.0.4']);
  });

  it('rejects over-limit requests with 429 while continuing to accept compliant clients', async () => {
    const rateLimiter = createTokenBucketRateLimiter({
      capacity: 3,
      refillTokensPerMs: 0,
      now: () => 0,
    });
    const handler = createHandler({ db, rateLimiter });

    const compliantStatuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      compliantStatuses.push((await postFrom(handler, '203.0.113.10')).status);
    }
    expect(compliantStatuses).toEqual([202, 202, 202]);

    const burstStatuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      burstStatuses.push((await postFrom(handler, '203.0.113.10')).status);
    }
    expect(burstStatuses).toEqual([429, 429, 429, 429, 429]);

    const otherIpStatus = (await postFrom(handler, '198.51.100.20')).status;
    expect(otherIpStatus).toBe(202);

    expect(await countRows()).toBe(4);
  });

  it('admits new requests after the bucket refills', async () => {
    let now = 0;
    const rateLimiter = createTokenBucketRateLimiter({
      capacity: 2,
      refillTokensPerMs: 1 / 1000,
      now: () => now,
    });
    const handler = createHandler({ db, rateLimiter });

    expect((await postFrom(handler, '203.0.113.30')).status).toBe(202);
    expect((await postFrom(handler, '203.0.113.30')).status).toBe(202);
    expect((await postFrom(handler, '203.0.113.30')).status).toBe(429);

    now = 1000;
    expect((await postFrom(handler, '203.0.113.30')).status).toBe(202);

    expect(await countRows()).toBe(3);
  });
});
