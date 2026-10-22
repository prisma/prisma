import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { SqlConnectionError } from '@internal/sql-errors';
import { timeouts } from '@repo/test-utils';
import { Client, Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasStartedConnecting } from '../src/pg-client-state';
import { createBoundDriverFromBinding } from '../src/postgres-driver';
import { queryRows } from './sql-queryable-test-utils';

let db: PGlite;
let server: PGLiteSocketServer;
let port: number;

beforeEach(async () => {
  db = await PGlite.create();
  server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await server.start();
  const address = server.getServerConn();
  port = Number(address.slice(address.lastIndexOf(':') + 1));
}, timeouts.spinUpPpgDev);

afterEach(async () => {
  await server.stop();
  await db.close();
}, timeouts.spinUpPpgDev);

function newClient(): Client {
  return new Client({ host: '127.0.0.1', port, database: 'postgres', user: 'postgres' });
}

describe('pg client connection state', () => {
  it("reads pg's own connection fields", async () => {
    const client = newClient();
    expect(client).toHaveProperty('_connected', false);
    expect(client).toHaveProperty('_connecting', false);
    expect(hasStartedConnecting(client)).toBe(false);

    const connecting = client.connect();
    expect(hasStartedConnecting(client)).toBe(true);
    await connecting;
    expect(client).toHaveProperty('_connected', true);
    expect(hasStartedConnecting(client)).toBe(true);
    await client.end();
  });
});

describe('postgres driver client ownership', () => {
  it('uses a connected supplied client as-is and does not end it on close', async () => {
    const client = newClient();
    await client.connect();
    const connect = vi.spyOn(client, 'connect');
    const end = vi.spyOn(client, 'end');
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: false },
      { disabled: true },
    );

    expect(await queryRows(driver, 'select 1 as one')).toEqual([{ one: '1' }]);
    await driver.close();

    expect(connect).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    expect(await client.query('select 2 as two')).toMatchObject({ rows: [{ two: 2 }] });
    end.mockRestore();
    await client.end();
  });

  it('connects an unconnected supplied client and does not end it on close', async () => {
    const client = newClient();
    const end = vi.spyOn(client, 'end');
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: false },
      { disabled: true },
    );

    expect(await queryRows(driver, 'select 1 as one')).toEqual([{ one: '1' }]);
    await driver.close();

    expect(end).not.toHaveBeenCalled();
    expect(await client.query('select 2 as two')).toMatchObject({ rows: [{ two: 2 }] });
    end.mockRestore();
    await client.end();
  });

  it('connects a client it owns and ends it on close', async () => {
    const client = newClient();
    const end = vi.spyOn(client, 'end');
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: true },
      { disabled: true },
    );

    expect(await queryRows(driver, 'select 1 as one')).toEqual([{ one: '1' }]);
    await driver.close();

    expect(end).toHaveBeenCalledTimes(1);
  });

  it.each([
    [false, 0],
    [true, 1],
  ])('ends a pool on close only when it owns it (owns: %s)', async (ownsConnection, ends) => {
    const pool = new Pool({ host: '127.0.0.1', port, database: 'postgres', user: 'postgres' });
    const end = vi.spyOn(pool, 'end');
    const driver = createBoundDriverFromBinding(
      { kind: 'pgPool', pool, ownsConnection },
      { disabled: true },
    );

    expect(await queryRows(driver, 'select 1 as one')).toEqual([{ one: '1' }]);
    await driver.close();

    expect(end).toHaveBeenCalledTimes(ends);
    if (!ownsConnection) await pool.end();
  });

  it('uses an owned client that is already connected without connecting it again', async () => {
    const client = newClient();
    await client.connect();
    const connect = vi.spyOn(client, 'connect');
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: true },
      { disabled: true },
    );

    expect(await queryRows(driver, 'select 1 as one')).toEqual([{ one: '1' }]);
    await driver.close();

    expect(connect).not.toHaveBeenCalled();
  });

  it('uses a supplied client that is still connecting', async () => {
    const client = newClient();
    const connecting = client.connect();
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: false },
      { disabled: true },
    );

    expect(await queryRows(driver, 'select 1 as one')).toEqual([{ one: '1' }]);
    await connecting;
    await driver.close();
    await client.end();
  });

  it('connects once for concurrent first uses', async () => {
    const client = newClient();
    const connect = vi.spyOn(client, 'connect');
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: false },
      { disabled: true },
    );

    const results = await Promise.all([
      queryRows(driver, 'select 1 as one'),
      queryRows(driver, 'select 2 as two'),
    ]);

    expect(results).toEqual([[{ one: '1' }], [{ two: '2' }]]);
    expect(connect).toHaveBeenCalledTimes(1);
    await driver.close();
    await client.end();
  });

  it('reports a failed connect again on the next use instead of hanging', async () => {
    const client = new Client({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 1000 });
    const driver = createBoundDriverFromBinding(
      { kind: 'pgClient', client, ownsConnection: false },
      { disabled: true },
    );

    const [first, second] = await Promise.allSettled([
      queryRows(driver, 'select 1'),
      queryRows(driver, 'select 1'),
    ]);
    const third = await queryRows(driver, 'select 1').then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(first).toMatchObject({ status: 'rejected', reason: { kind: 'sql_connection' } });
    expect(second).toMatchObject({ status: 'rejected', reason: { kind: 'sql_connection' } });
    expect(third).toBeInstanceOf(SqlConnectionError);
    expect(third).toBe(first.status === 'rejected' ? first.reason : undefined);
  });
});
