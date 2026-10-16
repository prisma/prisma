import { fileURLToPath } from 'node:url';
import { createPostgresControlClient } from '@prisma/orm-postgres/control';
import { createDevDatabase, timeouts } from '@repo/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

describe('committed migrations', () => {
  let database: Awaited<ReturnType<typeof createDevDatabase>>;

  beforeAll(async () => {
    database = await createDevDatabase();
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    if (database) await database.close();
  }, timeouts.spinUpPpgDev);

  it('bring an empty database to the contract', async () => {
    const client = createPostgresControlClient({ connection: database.connectionString });
    try {
      const result = await client.migrate({ contract: contractJson, migrationsDir });
      expect(result.ok, JSON.stringify(result)).toBe(true);
    } finally {
      await client.close();
    }
  });
});
