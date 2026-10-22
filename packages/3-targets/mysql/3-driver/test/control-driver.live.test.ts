import { withMysqlDatabase } from '@repo/test-utils/mysql-database';
import { describe, expect, it } from 'vitest';
import mysqlDriver from '../src/core/migrations/control-driver';

describe('MysqlControlDriver against a MySQL server', () => {
  it('hands every column over as the text MySQL sends', async (test) => {
    await withMysqlDatabase(test, async ({ url, name }) => {
      const driver = await mysqlDriver.create(url);
      try {
        await driver.query(
          "CREATE TABLE t (i INT, b BIGINT, d DECIMAL(10,2), dt DATETIME(3), j JSON, bin VARBINARY(4), txt TEXT, e ENUM('A','B'))",
        );
        await driver.query('INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
          42,
          '9007199254740993',
          '1.50',
          '2024-01-02 03:04:05.678',
          '{"a": [1, 2]}',
          Buffer.from([0, 1, 2, 255]),
          'héllo',
          'B',
        ]);
        const { rows } = await driver.query('SELECT * FROM t');
        expect(rows).toEqual([
          {
            i: '42',
            b: '9007199254740993',
            d: '1.50',
            dt: '2024-01-02 03:04:05.678',
            j: '{"a": [1, 2]}',
            bin: Buffer.from([0, 1, 2, 255]),
            txt: 'héllo',
            e: 'B',
          },
        ]);
        expect(await driver.databaseName()).toBe(name);
      } finally {
        await driver.close();
      }
    });
  });

  it('returns no rows for a statement that is not a query', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const driver = await mysqlDriver.create(url);
      try {
        expect(await driver.query('CREATE TABLE u (id INT)')).toEqual({ rows: [] });
      } finally {
        await driver.close();
      }
    });
  });

  it('refuses two statements in one query even when the URL asks for multiple statements', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const withMultipleStatements = new URL(url);
      withMultipleStatements.searchParams.set('multipleStatements', 'true');
      withMultipleStatements.searchParams.set('flags', 'MULTI_STATEMENTS');
      const driver = await mysqlDriver.create(withMultipleStatements.toString());
      try {
        await expect(driver.query('SELECT 1; SELECT 2')).rejects.toMatchObject({
          kind: 'sql_query',
          sqlState: '42000',
        });
      } finally {
        await driver.close();
      }
    });
  });

  it('sends an object parameter as a string, not as SQL', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const driver = await mysqlDriver.create(url);
      try {
        expect(await driver.query('SELECT ? AS v', [{ id: 1 }])).toEqual({
          rows: [{ v: '[object Object]' }],
        });
      } finally {
        await driver.close();
      }
    });
  });

  it('reports a failed statement as a SqlQueryError with its SQLSTATE', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const driver = await mysqlDriver.create(url);
      try {
        await expect(driver.query('SELECT * FROM missing')).rejects.toMatchObject({
          kind: 'sql_query',
          sqlState: '42S02',
        });
      } finally {
        await driver.close();
      }
    });
  });

  it('reports a database it cannot reach as DRIVER.CONNECTION_FAILED with the URL redacted', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const missing = new URL(url);
      missing.pathname = '/no_such_database_for_prisma';
      missing.password = 'secret';
      const error = await mysqlDriver.create(missing.toString()).then(
        () => undefined,
        (reason: unknown) => reason,
      );
      expect(error).toMatchObject({ code: 'DRIVER.CONNECTION_FAILED' });
      const { message, why, meta } = error as { message: string; why: string; meta: unknown };
      expect(JSON.stringify({ message, why, meta })).not.toContain('secret');
      expect(JSON.stringify(meta)).toContain('no_such_database_for_prisma');
    });
  });
});
