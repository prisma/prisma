import { contractFromJson } from '@internal/postgres/static';
import { Collection } from '@internal/sql-orm-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const statements = vi.hoisted(() => [] as string[]);

vi.mock('pg', () => {
  const query = vi.fn(async (request: string | { readonly text: string }) => {
    statements.push(typeof request === 'string' ? request : request.text);
    return { rows: [], rowCount: 0 };
  });
  class Pool {
    on = vi.fn().mockReturnThis();
    connect = vi.fn().mockResolvedValue({ query, release: vi.fn(), on: vi.fn() });
    end = vi.fn().mockResolvedValue(undefined);
  }
  class Client {
    on = vi.fn().mockReturnThis();
    connect = vi.fn().mockResolvedValue(undefined);
    query = query;
    end = vi.fn().mockResolvedValue(undefined);
    release = vi.fn();
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

afterEach(() => {
  statements.length = 0;
});

describe('a transaction on a supabase role-bound client', () => {
  it('offers sql, raw, prepare and orm, and runs every statement inside the transaction under the role', async () => {
    const db = await supabase({
      contract,
      url: 'postgres://localhost/db',
      verifyMarker: false,
      jwtSecret: 'fixture-jwt-signing-input-not-a-real-credential',
      collections: { Profile: ProfileCollection },
    });

    await db.asAnon().transaction(async (tx) => {
      await tx.query(tx.sql.public.profile.select('id').build());
      await tx.execute(tx.raw.sql`UPDATE profile SET username = username`.affectedCount().build());
      const byName = await tx.prepare({ username: 'pg/text@1' }, (params) =>
        tx.sql.public.profile
          .select('id')
          .where((f, fns) => fns.eq(f.username, params.username))
          .build(),
      );
      await byName.query(tx, { username: 'ada' });
      await tx.orm.public.Profile.named('ada').all();
    });
    await db.close();

    expect(statements).toEqual([
      'SELECT set_config($1, $2, false)',
      'SELECT set_config($1, $2, false)',
      'BEGIN',
      'SELECT "id" AS "id" FROM "public"."profile"',
      'UPDATE profile SET username = username',
      'SELECT "id" AS "id" FROM "public"."profile" WHERE "username" = $1',
      'SELECT "profile"."id" AS "id", "profile"."userId" AS "userId", "profile"."username" AS "username" FROM "public"."profile" WHERE "profile"."username" = $1',
      'COMMIT',
      'RESET ALL',
    ]);
  });

  it('prepares a statement on a role-bound client that runs under its role', async () => {
    const db = await supabase({
      contract,
      url: 'postgres://localhost/db',
      verifyMarker: false,
      jwtSecret: 'fixture-jwt-signing-input-not-a-real-credential',
    });
    const anon = db.asAnon();

    const byName = await anon.prepare({ username: 'pg/text@1' }, (params) =>
      anon.sql.public.profile
        .select('id')
        .where((f, fns) => fns.eq(f.username, params.username))
        .build(),
    );
    await byName.query(anon, { username: 'ada' });
    await db.close();

    expect(statements).toEqual([
      'SELECT set_config($1, $2, false)',
      'SELECT set_config($1, $2, false)',
      'SELECT "id" AS "id" FROM "public"."profile" WHERE "username" = $1',
      'RESET ALL',
    ]);
  });
});
