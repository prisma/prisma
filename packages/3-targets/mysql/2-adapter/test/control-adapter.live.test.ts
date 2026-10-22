import mysqlDriver from '@internal/driver-mysql/control';
import { timeouts } from '@repo/test-utils';
import { withMysqlDatabase } from '@repo/test-utils/mysql-database';
import { describe, expect, it } from 'vitest';
import { createAdapter } from './helpers';

describe('MysqlControlAdapter against a MySQL server', {
  timeout: timeouts.databaseOperation,
}, () => {
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
        expect(Object.keys((await adapter.introspect(driver)).tables)).toEqual([]);
      } finally {
        await driver.close();
      }
    });
  });

  it('stamps control-table rows with the current time in UTC', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const adapter = createAdapter();
      const driver = await mysqlDriver.create(url);
      try {
        for (const node of adapter.bootstrapControlTableQueries()) {
          await driver.query((await adapter.lowerToExecuteRequest(node)).sql);
        }
        const before = Date.now() - 1000;
        await driver.query('INSERT INTO `_prisma_marker` (core_hash, profile_hash) VALUES (?, ?)', [
          'sha256:core',
          'sha256:profile',
        ]);
        await driver.query(
          'INSERT INTO `_prisma_ledger` (space, migration_name, migration_hash, destination_core_hash, operations) VALUES (?, ?, ?, ?, ?)',
          ['app', 'init', 'sha256:m', 'sha256:core', '[]'],
        );
        const after = Date.now() + 1000;
        const updatedAt = (await adapter.readMarker(driver, 'app'))?.updatedAt.getTime() ?? 0;
        const appliedAt = (await adapter.readLedger(driver))[0]?.appliedAt.getTime() ?? 0;
        const within = (time: number) => time >= before && time <= after;
        expect({ marker: within(updatedAt), ledger: within(appliedAt) }).toEqual({
          marker: true,
          ledger: true,
        });
      } finally {
        await driver.close();
      }
    });
  });

  it('names the database a foreign key into another database references', async (test) => {
    await withMysqlDatabase(test, async ({ url, name }) => {
      const adapter = createAdapter();
      const driver = await mysqlDriver.create(url);
      const other = `${name}_other`;
      try {
        await driver.query(`CREATE DATABASE \`${other}\``);
        await driver.query(`CREATE TABLE \`${other}\`.\`User\` (id INT PRIMARY KEY)`);
        await driver.query(
          `CREATE TABLE Post (id INT PRIMARY KEY, authorId INT NOT NULL, CONSTRAINT Post_authorId_fkey FOREIGN KEY (authorId) REFERENCES \`${other}\`.\`User\` (id))`,
        );
        const post = (await adapter.introspect(driver)).tables['Post'];
        expect(
          post?.foreignKeys.map(({ referencedSchema, referencedTable }) => ({
            referencedSchema,
            referencedTable,
          })),
        ).toEqual([{ referencedSchema: other, referencedTable: 'User' }]);
      } finally {
        await driver.query('DROP TABLE IF EXISTS Post');
        await driver.query(`DROP DATABASE IF EXISTS \`${other}\``);
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
