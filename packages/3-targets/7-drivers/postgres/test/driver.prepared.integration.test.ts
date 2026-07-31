import type { SqlConnection, SqlQueryable } from '@prisma-next/sql-relational-core/ast';
import { createDevDatabase, timeouts } from '@repo/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createBoundDriverFromBinding } from '../src/postgres-driver';

function makeSlot(initial?: unknown) {
  let value: unknown = initial;
  return {
    slot: {
      get: () => value,
      set: (v: unknown) => {
        value = v;
      },
    },
    snapshot: () => value,
  };
}

async function consume<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const row of iterable) {
    out.push(row);
  }
  return out;
}

async function preparedNames(queryable: SqlQueryable): Promise<string[]> {
  const result = await queryable.query<{ name: string }>(
    'select name from pg_prepared_statements order by name',
  );
  return result.rows.map((r) => r.name);
}

describe('@prisma-next/driver-postgres prepared statements', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  }, timeouts.spinUpPpgDev);

  it(
    'reuses the server-side prepared statement across executes on the same connection',
    async () => {
      const database = await createDevDatabase();
      const Pg = await import('pg');
      const client = new Pg.Client({ connectionString: database.connectionString });
      const driver = createBoundDriverFromBinding({ kind: 'pgClient', client }, undefined);
      cleanups.push(async () => {
        await driver.close();
        await database.close();
      });

      await driver.query('create table t (id serial primary key, label text)');
      await driver.query("insert into t (label) values ('a'), ('b')");

      const { slot, snapshot } = makeSlot();
      expect(await preparedNames(driver)).toEqual([]);

      const r1 = await consume(
        driver.executePrepared<{ id: number; label: string }>({
          sql: 'select id, label from t where label = $1',
          params: ['a'],
          handle: slot,
        }),
      );
      expect(r1).toEqual([{ id: 1, label: 'a' }]);

      const handleName = snapshot() as string;
      expect(handleName).toMatch(/^pn_\d+$/);
      expect(await preparedNames(driver)).toEqual([handleName]);

      const r2 = await consume(
        driver.executePrepared<{ id: number; label: string }>({
          sql: 'select id, label from t where label = $1',
          params: ['b'],
          handle: slot,
        }),
      );
      expect(r2).toEqual([{ id: 2, label: 'b' }]);

      expect(await preparedNames(driver)).toEqual([handleName]);
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'a different connection re-Parses the same handle name',
    async () => {
      // Two isolated dev databases — @prisma/dev shares server-side state
      // across sequential reconnects to a single instance, which would
      // surface as 42P05 "duplicate prepared statement".
      const databaseA = await createDevDatabase();
      const databaseB = await createDevDatabase();
      const Pg = await import('pg');

      async function setup(connectionString: string): Promise<void> {
        const c = new Pg.Client({ connectionString });
        await c.connect();
        await c.query('create table t2 (id serial primary key, label text)');
        await c.query("insert into t2 (label) values ('a')");
        await c.end();
      }
      await setup(databaseA.connectionString);
      await setup(databaseB.connectionString);

      const sql = 'select id, label from t2 where label = $1';
      const { slot, snapshot } = makeSlot();

      const clientA = new Pg.Client({ connectionString: databaseA.connectionString });
      const driverA = createBoundDriverFromBinding(
        { kind: 'pgClient', client: clientA },
        undefined,
      );
      cleanups.push(async () => {
        await driverA.close();
        await databaseA.close();
      });

      await consume(driverA.executePrepared({ sql, params: ['a'], handle: slot }));
      const name = snapshot() as string;
      expect(name).toMatch(/^pn_\d+$/);
      expect(await preparedNames(driverA)).toEqual([name]);

      const clientB = new Pg.Client({ connectionString: databaseB.connectionString });
      const driverB = createBoundDriverFromBinding(
        { kind: 'pgClient', client: clientB },
        undefined,
      );
      cleanups.push(async () => {
        await driverB.close();
        await databaseB.close();
      });

      await consume(driverB.executePrepared({ sql, params: ['a'], handle: slot }));
      expect(snapshot()).toBe(name);
      expect(await preparedNames(driverB)).toEqual([name]);
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'retries with a fresh handle on SQLSTATE 26000 after DEALLOCATE ALL',
    async () => {
      const database = await createDevDatabase();
      const Pg = await import('pg');
      const client = new Pg.Client({ connectionString: database.connectionString });
      const driver = createBoundDriverFromBinding({ kind: 'pgClient', client }, undefined);
      cleanups.push(async () => {
        await driver.close();
        await database.close();
      });

      await driver.query('create table t3 (id serial primary key, label text)');
      await driver.query("insert into t3 (label) values ('a'), ('b')");

      const { slot, snapshot } = makeSlot();
      const sql = 'select id, label from t3 where label = $1';

      const r1 = await consume(driver.executePrepared({ sql, params: ['a'], handle: slot }));
      expect(r1).toHaveLength(1);
      const firstHandle = snapshot() as string;

      // Forget every prepared statement server-side. pg's parsedStatements
      // still records firstHandle, so the next execute under the old name
      // would skip Parse on the wire and surface 26000 from the server.
      await driver.query('deallocate all');

      const r2 = await consume(driver.executePrepared({ sql, params: ['b'], handle: slot }));
      expect(r2).toHaveLength(1);
      expect((r2[0] as { label: string }).label).toBe('b');

      const retryHandle = snapshot() as string;
      expect(retryHandle).toMatch(/^pn_\d+$/);
      expect(retryHandle).not.toBe(firstHandle);
      expect(await preparedNames(driver)).toEqual([retryHandle]);
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'retries with a fresh handle on SQLSTATE 0A000 after a column type change',
    async () => {
      const database = await createDevDatabase();
      const Pg = await import('pg');
      const client = new Pg.Client({ connectionString: database.connectionString });
      const driver = createBoundDriverFromBinding({ kind: 'pgClient', client }, undefined);
      cleanups.push(async () => {
        await driver.close();
        await database.close();
      });

      await driver.query('create table t4 (id serial primary key, label text)');
      await driver.query("insert into t4 (label) values ('a'), ('b')");

      const { slot, snapshot } = makeSlot();
      // SELECT * so a column-shape change invalidates the cached plan.
      const sql = 'select * from t4 where id = $1';

      const r1 = await consume(driver.executePrepared({ sql, params: [1], handle: slot }));
      expect(r1).toHaveLength(1);
      const firstHandle = snapshot() as string;

      await driver.query('alter table t4 drop column label');
      await driver.query('alter table t4 add column label varchar(50)');
      await driver.query("update t4 set label = 'b' where id = 2");

      const r2 = await consume(driver.executePrepared({ sql, params: [2], handle: slot }));
      expect(r2).toHaveLength(1);
      const retryHandle = snapshot() as string;
      expect(retryHandle).toMatch(/^pn_\d+$/);
      expect(retryHandle).not.toBe(firstHandle);
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'works inside an explicit transaction',
    async () => {
      const database = await createDevDatabase();
      const Pg = await import('pg');
      const client = new Pg.Client({ connectionString: database.connectionString });
      const driver = createBoundDriverFromBinding({ kind: 'pgClient', client }, undefined);
      cleanups.push(async () => {
        await driver.close();
        await database.close();
      });

      await driver.query('create table t5 (id serial primary key, label text)');

      const connection: SqlConnection = await driver.acquireConnection();
      const tx = await connection.beginTransaction();

      await tx.query("insert into t5 (label) values ('a'), ('b'), ('c')");

      const { slot, snapshot } = makeSlot();
      const sql = 'select id, label from t5 where label = $1';

      const r1 = await consume(tx.executePrepared({ sql, params: ['a'], handle: slot }));
      expect(r1).toEqual([{ id: 1, label: 'a' }]);

      const handle = snapshot() as string;
      expect(handle).toMatch(/^pn_\d+$/);

      const r2 = await consume(tx.executePrepared({ sql, params: ['b'], handle: slot }));
      expect(r2).toEqual([{ id: 2, label: 'b' }]);
      expect(snapshot()).toBe(handle);

      await tx.commit();

      // PREPARE survives the transaction; only DEALLOCATE / end-of-session
      // discards it. The handle still resolves on the parent connection.
      const r3 = await consume(connection.executePrepared({ sql, params: ['c'], handle: slot }));
      expect(r3).toEqual([{ id: 3, label: 'c' }]);
      expect(snapshot()).toBe(handle);

      await connection.release();
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'cursor.disabled buffers via the named-query path',
    async () => {
      const database = await createDevDatabase();
      const Pg = await import('pg');
      const client = new Pg.Client({ connectionString: database.connectionString });
      const driver = createBoundDriverFromBinding({ kind: 'pgClient', client }, { disabled: true });
      cleanups.push(async () => {
        await driver.close();
        await database.close();
      });

      await driver.query('create table t7 (id serial primary key, label text)');
      await driver.query("insert into t7 (label) values ('a'), ('b')");

      const { slot, snapshot } = makeSlot();
      const sql = 'select id, label from t7 where label = $1';

      const r1 = await consume(driver.executePrepared({ sql, params: ['a'], handle: slot }));
      expect(r1).toEqual([{ id: 1, label: 'a' }]);
      const handle = snapshot() as string;
      expect(handle).toMatch(/^pn_\d+$/);

      const r2 = await consume(driver.executePrepared({ sql, params: ['b'], handle: slot }));
      expect(r2).toEqual([{ id: 2, label: 'b' }]);

      expect(await preparedNames(driver)).toEqual([handle]);
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'preparedStatements: false issues anonymous queries',
    async () => {
      const database = await createDevDatabase();
      const Pg = await import('pg');
      const client = new Pg.Client({ connectionString: database.connectionString });
      const driver = createBoundDriverFromBinding({ kind: 'pgClient', client }, undefined, {
        preparedStatements: false,
      });
      cleanups.push(async () => {
        await driver.close();
        await database.close();
      });

      await driver.query('create table t6 (id serial primary key, label text)');
      await driver.query("insert into t6 (label) values ('a'), ('b')");

      const { slot, snapshot } = makeSlot();
      const sql = 'select id, label from t6 where label = $1';

      await consume(driver.executePrepared({ sql, params: ['a'], handle: slot }));
      await consume(driver.executePrepared({ sql, params: ['b'], handle: slot }));

      expect(snapshot()).toBeUndefined();
      expect(await preparedNames(driver)).toEqual([]);
    },
    timeouts.spinUpPpgDev,
  );
});
