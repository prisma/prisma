import mysqlDriver from '@internal/driver-mysql/control';
import { withMysqlDatabase } from '@repo/test-utils/mysql-database';
import { describe, expect, it } from 'vitest';
import { createAdapter } from './helpers';

describe('MysqlControlAdapter against a MySQL server', () => {
  it('creates the control tables, reads them back, and leaves them out of introspection', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const adapter = createAdapter();
      const driver = await mysqlDriver.create(url);
      try {
        expect(await adapter.readMarker(driver, 'app')).toBeNull();
        for (const node of adapter.bootstrapControlTableQueries()) {
          const { sql } = await adapter.lowerToExecuteRequest(node);
          await driver.query(sql);
          await driver.query(sql);
        }
        expect(await adapter.readMarker(driver, 'app')).toBeNull();
        await driver.query(
          'INSERT INTO `_prisma_marker` (core_hash, profile_hash, invariants) VALUES (?, ?, ?)',
          ['sha256:core', 'sha256:profile', '["inv"]'],
        );
        await driver.query(
          'INSERT INTO `_prisma_ledger` (space, migration_name, migration_hash, destination_core_hash, operations) VALUES (?, ?, ?, ?, ?)',
          ['app', 'init', 'sha256:m', 'sha256:core', '[{}]'],
        );
        expect(await adapter.readMarker(driver, 'app')).toMatchObject({
          storageHash: 'sha256:core',
          profileHash: 'sha256:profile',
          meta: {},
          invariants: ['inv'],
        });
        expect(await adapter.readLedger(driver)).toMatchObject([
          { space: 'app', migrationName: 'init', to: 'sha256:core', operationCount: 1 },
        ]);
        expect(await adapter.introspect(driver)).toMatchObject({ tables: {} });
      } finally {
        await driver.close();
      }
    });
  });

  it('commits and rolls back on one connection', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const adapter = createAdapter();
      const driver = await mysqlDriver.create(url);
      try {
        await driver.query('CREATE TABLE t (id INT PRIMARY KEY)');
        await adapter.withTransaction(driver, () => driver.query('INSERT INTO t VALUES (1)'));
        await expect(
          adapter.withTransaction(driver, async () => {
            await driver.query('INSERT INTO t VALUES (2)');
            throw new Error('undo');
          }),
        ).rejects.toThrow('undo');
        expect((await driver.query('SELECT id FROM t')).rows).toEqual([{ id: '1' }]);
      } finally {
        await driver.close();
      }
    });
  });
});
