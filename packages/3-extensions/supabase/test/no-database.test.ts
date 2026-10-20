import postgresDriver from '@internal/driver-postgres/runtime';
import { contractFromJson } from '@internal/postgres/static';
import { Collection } from '@internal/sql-orm-client';
import type { SqlMiddleware } from '@internal/sql-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const created = vi.hoisted(() => ({ pools: 0, clients: 0, poolConnects: 0 }));

vi.mock('pg', () => {
  class Pool {
    on = vi.fn().mockReturnThis();
    connect = vi.fn(async () => {
      created.poolConnects += 1;
      return {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
        on: vi.fn(),
      };
    });
    end = vi.fn().mockResolvedValue(undefined);
    constructor() {
      created.pools += 1;
    }
  }
  class Client {
    constructor() {
      created.clients += 1;
    }
  }
  return { Pool, Client };
});

import supabase from '../src/runtime/supabase';
import type { Contract } from './fixtures/example-app/contract';
import contractJson from './fixtures/example-app/contract.json' with { type: 'json' };

class ProfileCollection extends Collection<Contract, 'Profile'> {
  named(username: string) {
    return this.where({ username });
  }
}

const contract = contractFromJson<Contract>(contractJson);
const collections = { Profile: ProfileCollection };
const jwtSecret = 'fixture-jwt-signing-input-not-a-real-credential';
const url = 'postgres://localhost/db';

const selectIds = { sql: 'SELECT "id" AS "id" FROM "public"."profile" LIMIT 10', params: [] };
const renameAll = { sql: 'UPDATE profile SET username = $1', params: ['ada'] };
const selectNamed = {
  sql: 'SELECT "profile"."id" AS "id" FROM "public"."profile" WHERE "profile"."username" = $1',
  params: ['ada'],
};

let driverCreate: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  created.pools = 0;
  created.clients = 0;
  created.poolConnects = 0;
  driverCreate = vi.spyOn(postgresDriver, 'create');
});

afterEach(() => {
  driverCreate.mockRestore();
});

describe('a supabase client with no database', () => {
  it('builds and renders plans from sql, raw and orm without a pool, driver or connection', async () => {
    const db = await supabase({ contract, jwtSecret, collections });
    const anon = db.asAnon();

    expect(db.context.contract.target).toBe('postgres');
    expect(db.stack).toBeDefined();
    expect(anon.toSql(anon.sql.public.profile.select('id').limit(10).build())).toEqual(selectIds);
    expect(
      anon.toSql(anon.raw.sql`UPDATE profile SET username = ${'ada'}`.affectedCount().build()),
    ).toEqual(renameAll);
    expect(
      anon.toSql(anon.orm.public.Profile.named('ada').select('id').prepared.all().plan),
    ).toEqual(selectNamed);
    expect(created).toEqual({ pools: 0, clients: 0, poolConnects: 0 });
    expect(driverCreate).not.toHaveBeenCalled();
  });
});

describe('a supabase client given a URL', () => {
  it('creates its pool and driver on the first query', async () => {
    const db = await supabase({ contract, url, jwtSecret, verifyMarker: false });
    const anon = db.asAnon();
    anon.toSql(anon.sql.public.profile.select('id').build());
    db.asServiceRole();

    expect(created.pools).toBe(0);
    expect(driverCreate).not.toHaveBeenCalled();

    await anon.query(anon.sql.public.profile.select('id').build()).toArray();
    await db.asServiceRole().query(anon.sql.public.profile.select('id').build()).toArray();
    await db.close();

    expect(created.pools).toBe(1);
    expect(driverCreate).toHaveBeenCalledTimes(1);
  });

  it('creates no pool when it is closed before a query', async () => {
    const db = await supabase({ contract, url, jwtSecret });

    await db.close();

    expect(created.pools).toBe(0);
    expect(() => db.asAnon().query(db.asAnon().sql.public.profile.select('id').build())).toThrow(
      expect.objectContaining({ code: 'DRIVER.NOT_CONNECTED' }),
    );
    expect(created.pools).toBe(0);
  });

  it('passes the mode option to middleware', async () => {
    const modes: string[] = [];
    const recordMode: SqlMiddleware = {
      name: 'record-mode',
      familyId: 'sql',
      async beforeEncode(_plan, ctx) {
        modes.push(ctx.mode);
      },
    };
    const db = await supabase({
      contract,
      url,
      jwtSecret,
      verifyMarker: false,
      middleware: [recordMode],
      mode: 'permissive',
    });
    const anon = db.asAnon();

    await anon.query(anon.sql.public.profile.select('id').build()).toArray();
    await db.close();

    expect(modes).toEqual(['permissive']);
  });
});
