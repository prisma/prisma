import { timeouts } from '@repo/test-utils';
import { withMysqlDatabase } from '@repo/test-utils/mysql-database';
import { describe, expect, it } from 'vitest';
import mysqlControlDriver from '../src/core/migrations/control-driver';
import mysqlRuntimeDriver from '../src/core/runtime/runtime-driver';

async function collect<Row>(rows: AsyncIterable<Row>): Promise<Row[]> {
  const out: Row[] = [];
  for await (const row of rows) out.push(row);
  return out;
}

async function withDriver<T>(
  url: string,
  fn: (driver: ReturnType<typeof mysqlRuntimeDriver.create>) => Promise<T>,
): Promise<T> {
  const driver = mysqlRuntimeDriver.create();
  await driver.connect({ kind: 'url', url });
  try {
    return await fn(driver);
  } finally {
    await driver.close();
  }
}

const slowRows =
  "WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM s WHERE n < 200) SELECT CONNECTION_ID() AS cid, n, SLEEP(0.05) AS z, REPEAT('x', 40000) AS pad FROM s";

async function drain(rows: AsyncIterator<unknown>): Promise<void> {
  while (!(await rows.next()).done) {}
}

const numbers =
  'SELECT n FROM (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3) AS t ORDER BY n';

describe('MySQL runtime driver', { timeout: timeouts.databaseOperation }, () => {
  it('streams every column as the text MySQL sends', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        expect(
          await collect(
            driver.query({
              sql: "SELECT 42 AS i, CAST('2024-01-02 03:04:05.678' AS DATETIME(3)) AS d, JSON_ARRAY(1, 'a') AS j, ? AS p",
              params: ["it's"],
            }),
          ),
        ).toEqual([{ i: '42', d: '2024-01-02 03:04:05.678', j: '[1, "a"]', p: "it's" }]);
      }),
    );
  });

  it('fills only the placeholders outside quoted text, so a value cannot leave its literal', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        const value = "' OR 1=1 OR '";
        expect({
          rows: await collect(
            driver.query({
              sql: "SELECT 'why?' AS q, `a?` AS v FROM (SELECT ? AS `a?`) AS t /* ? */ WHERE \"?\" = '?'",
              params: [value],
            }),
          ),
          stats: await driver.execute({ sql: "SELECT 'why?', ?", params: [value] }),
        }).toEqual({ rows: [{ q: 'why?', v: value }], stats: { affectedRows: 0 } });
        await expect(
          collect(driver.query({ sql: "SELECT '?' AS q", params: [value] })),
        ).rejects.toMatchObject({ code: 'RUNTIME.AST_INVALID' });
      }),
    );
  });

  it('sets up every connection: no backslash escapes mode and UTC', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        const [row] = await collect(
          driver.query<Record<string, string>>({
            sql: "SELECT @@SESSION.time_zone AS tz, FIND_IN_SET('NO_BACKSLASH_ESCAPES', @@SESSION.sql_mode) AS nbe",
          }),
        );
        expect(row).toEqual({ tz: '+00:00', nbe: '0' });
      }),
    );
  });

  it('leaves a connection usable after its caller stops reading a stream early', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        const connection = await driver.acquireConnection();
        try {
          for await (const row of connection.query({ sql: numbers })) {
            expect(row).toEqual({ n: '1' });
            break;
          }
          expect(await collect(connection.query({ sql: 'SELECT 7 AS n' }))).toEqual([{ n: '7' }]);
        } finally {
          await connection.release();
        }
      }),
    );
  });

  it('stops a pooled stream the caller breaks out of without reading the rest of the result', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        const started = Date.now();
        for await (const _row of driver.query({ sql: slowRows })) break;
        const elapsedMs = Date.now() - started;
        expect({
          quick: elapsedMs < 3000,
          next: await collect(driver.query({ sql: 'SELECT 1 AS n' })),
        }).toEqual({ quick: true, next: [{ n: '1' }] });
      }),
    );
  });

  it('commits and rolls back a transaction on one connection, and reports affected rows', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        await driver.execute({ sql: 'CREATE TABLE t (id int PRIMARY KEY)' });
        const connection = await driver.acquireConnection();
        try {
          const rolledBack = await connection.beginTransaction();
          await rolledBack.execute({ sql: 'INSERT INTO t VALUES (?), (?)', params: [1, 2] });
          await rolledBack.rollback();
          const committed = await connection.beginTransaction();
          const stats = await committed.execute({
            sql: 'INSERT INTO t VALUES (?), (?)',
            params: [3, 4],
          });
          await committed.commit();
          expect({
            stats,
            rows: await collect(driver.query({ sql: 'SELECT id FROM t ORDER BY id' })),
          }).toEqual({ stats: { affectedRows: 2 }, rows: [{ id: '3' }, { id: '4' }] });
        } finally {
          await connection.release();
        }
      }),
    );
  });

  it('waits in close() for a stream in flight to finish', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const driver = mysqlRuntimeDriver.create();
      await driver.connect({ kind: 'url', url });
      const iterator = driver.query({ sql: numbers })[Symbol.asyncIterator]();
      const first = await iterator.next();
      let closed = false;
      const closing = driver.close().then(() => {
        closed = true;
      });
      const rest = [await iterator.next(), await iterator.next(), await iterator.next()];
      await closing;
      expect({ first, rest, closed, state: driver.state }).toEqual({
        first: { done: false, value: { n: '1' } },
        rest: [
          { done: false, value: { n: '2' } },
          { done: false, value: { n: '3' } },
          { done: true, value: undefined },
        ],
        closed: true,
        state: 'closed',
      });
    });
  });

  it('waits in close() for a connection it handed out to be released', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const driver = mysqlRuntimeDriver.create();
      await driver.connect({ kind: 'url', url });
      const connection = await driver.acquireConnection();
      let closed = false;
      const closing = driver.close().then(() => {
        closed = true;
      });
      const rows = await collect(connection.query({ sql: 'SELECT 1 AS n' }));
      const closedBeforeRelease = closed;
      await connection.release();
      await closing;
      expect({ rows, closedBeforeRelease, closed }).toEqual({
        rows: [{ n: '1' }],
        closedBeforeRelease: false,
        closed: true,
      });
    });
  });

  it('ends a stream whose connection is lost with DRIVER.NOT_CONNECTED, and close() still finishes', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const admin = await mysqlControlDriver.create(url);
      const driver = mysqlRuntimeDriver.create();
      await driver.connect({ kind: 'url', url });
      try {
        const rows = driver.query<{ cid: string }>({ sql: slowRows })[Symbol.asyncIterator]();
        const first = await rows.next();
        await admin.query(`KILL ${first.done ? '' : first.value.cid}`);
        await expect(drain(rows)).rejects.toMatchObject({ code: 'DRIVER.NOT_CONNECTED' });
        await driver.close();
        expect(driver.state).toBe('closed');
      } finally {
        await admin.close();
      }
    });
  });

  it('stops reading a held connection that is lost after the caller broke out of its stream', async (test) => {
    await withMysqlDatabase(test, async ({ url }) => {
      const admin = await mysqlControlDriver.create(url);
      const driver = mysqlRuntimeDriver.create();
      await driver.connect({ kind: 'url', url });
      try {
        const connection = await driver.acquireConnection();
        for await (const row of connection.query<{ cid: string }>({ sql: slowRows })) {
          await admin.query(`KILL ${row.cid}`);
          break;
        }
        await connection.destroy();
        await driver.close();
        expect(driver.state).toBe('closed');
      } finally {
        await admin.close();
      }
    });
  });

  it('reports a query error with its SQLSTATE', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withDriver(url, async (driver) => {
        await expect(collect(driver.query({ sql: 'SELECT * FROM missing' }))).rejects.toMatchObject(
          { sqlState: '42S02' },
        );
        expect(await collect(driver.query({ sql: 'SELECT 1 AS n' }))).toEqual([{ n: '1' }]);
      }),
    );
  });
});

describe('MySQL runtime driver before connect', () => {
  it('refuses to run anything', async () => {
    const driver = mysqlRuntimeDriver.create();
    await expect(collect(driver.query({ sql: 'SELECT 1' }))).rejects.toMatchObject({
      code: 'DRIVER.NOT_CONNECTED',
    });
    await expect(driver.execute({ sql: 'SELECT 1' })).rejects.toMatchObject({
      code: 'DRIVER.NOT_CONNECTED',
    });
    await expect(driver.acquireConnection()).rejects.toMatchObject({
      code: 'DRIVER.NOT_CONNECTED',
    });
    expect(driver.state).toBe('unbound');
  });
});
