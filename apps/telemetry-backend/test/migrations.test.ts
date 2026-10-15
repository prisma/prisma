import { fileURLToPath } from 'node:url';
import { createPostgresControlClient } from '@prisma/orm-postgres/control';
import { createDevDatabase, timeouts, withClient } from '@repo/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTelemetryDb } from '../src/db';
import { createHandler } from '../src/handler';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

// The deploy workflow brings production up with `prisma migrate`, never
// `db init`, so the committed migrations — not the contract — decide which
// columns the handler can write. The handler tests build their schema from
// the contract and cannot see a migration that was never planned.
describe('committed migrations', () => {
  let database: Awaited<ReturnType<typeof createDevDatabase>>;

  beforeAll(async () => {
    database = await createDevDatabase();
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    if (database) await database.close();
  }, timeouts.spinUpPpgDev);

  it('migrate an empty database to the contract the handler writes', async () => {
    await withClient(database.connectionString, async (pg) => {
      await pg.query('drop schema if exists public cascade');
      await pg.query('drop schema if exists prisma_contract cascade');
      await pg.query('create schema public');
    });

    const client = createPostgresControlClient({ connection: database.connectionString });
    try {
      const result = await client.migrate({ contract: contractJson, migrationsDir });
      expect(result.ok, JSON.stringify(result)).toBe(true);
    } finally {
      await client.close();
    }

    const db = createTelemetryDb(database.connectionString);
    try {
      const response = await createHandler({ db })(
        new Request('http://localhost/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            installationId: 'install-migrated',
            version: '0.8.0',
            command: 'init',
            runtimeName: 'node',
            runtimeVersion: '24.13.0',
            os: 'linux',
            arch: 'x64',
            exitCode: 0,
            properties: { template: 'minimal' },
          }),
        }),
      );
      expect(response.status).toBe(202);

      const [row] = await db.orm.public.TelemetryEvent.all();
      expect(row?.exitCode).toBe(0);
      expect(row?.properties).toEqual({ template: 'minimal' });
    } finally {
      await db.runtime().close();
    }
  });
});
