import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { orm } from '@internal/sql-orm-client';
import type { SqliteClient } from '@internal/sqlite/runtime';
import sqlite from '@internal/sqlite/runtime';
import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Contract } from './fixtures/quoted-table-name-sqlite/generated/contract';
import contractJson from './fixtures/quoted-table-name-sqlite/generated/contract.json' with {
  type: 'json',
};

/**
 * ORM round-trip over a `@@map`ped table whose physical name contains a double
 * quote — the SQLite side of the Postgres bug in
 * https://github.com/prisma/orm/issues/30213.
 *
 * SQLite doubles an embedded quote inside a quoted identifier, so
 * `quoted"table` has to render as `"quoted""table"`. Table qualification
 * interpolated the name verbatim, producing `"quoted"table"` — a syntax error
 * in every statement the name reaches. The table here is created out of band
 * because the SQLite client executes queries only; the ORM writes and reads
 * prove the rendered SQL is valid.
 */
describe('integration/quote-containing table name on sqlite', () => {
  let directory: string | undefined;
  let database: DatabaseSync | undefined;
  let client: SqliteClient<Contract> | undefined;
  let db: ReturnType<typeof orm<Contract>> | undefined;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'pn-sqlite-quoted-table-'));
    const path = join(directory, 'test.db');
    database = new DatabaseSync(path);
    database.exec(`
      create table "quoted""table" (
        id integer primary key,
        value text
      );
    `);

    client = sqlite<Contract>({ contractJson, path, verifyMarker: false });
    const runtime = await client.connect();
    db = orm({
      context: client.context,
      runtime: {
        query(plan) {
          return runtime.query(plan);
        },
        execute(plan) {
          return runtime.execute(plan);
        },
        connection() {
          return runtime.connection();
        },
      },
    });
  });

  afterAll(async () => {
    await client?.close();
    database?.close();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  });

  it('writes and reads a @@map("quoted\\"table") model through the typed ORM', async () => {
    const rowsAccessor = db![UNBOUND_NAMESPACE_ID].QuotedRow;
    await rowsAccessor.create({ id: 1, value: 'written through the ORM' });
    await rowsAccessor.create({ id: 2, value: null });

    const rows = await rowsAccessor
      .select('id', 'value')
      .orderBy((row) => row.id.asc())
      .all();

    expect(rows).toEqual([
      { id: 1, value: 'written through the ORM' },
      { id: 2, value: null },
    ]);
  });
});
