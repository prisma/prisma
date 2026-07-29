import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  bigintColumn,
  blobColumn,
  integerColumn,
  jsonColumn,
  textColumn,
} from '@prisma-next/adapter-sqlite/column-types';
import sqliteAdapter from '@prisma-next/adapter-sqlite/runtime';
import { type Contract, soleDomainNamespaceId } from '@prisma-next/contract/types';
import sqliteDriver from '@prisma-next/driver-sqlite/runtime';
import { instantiateExecutionStack } from '@prisma-next/framework-components/execution';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import { Collection } from '@prisma-next/sql-orm-client';
import { createExecutionContext, createSqlExecutionStack } from '@prisma-next/sql-runtime';
import { defineContract, field, model, rel } from '@prisma-next/sqlite/contract-builder';
import { SqliteRuntimeImpl } from '@prisma-next/sqlite/runtime';
import sqliteTarget from '@prisma-next/target-sqlite/runtime';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * SQLite's side of the cut, through a real ORM include.
 *
 * The include nests the child row set through a derived table, which is where
 * SQLite drops the JSON subtype — so this is the shape that exercises the retag,
 * rather than a flat projection over a base table.
 */

/** Past 2^53, where a JSON number stops carrying an int64. */
const WIDE_BIGINT = 9007199254740993n;
/** 80 bytes, and letter-bearing hex, since `hex()` emits uppercase. */
const WIDE_BLOB = Uint8Array.from({ length: 80 }, (_, index) => (index * 7) % 256);
/** A document, and a string that merely contains JSON — D6's sharp pair. */
const DOCUMENT = { nested: { list: [1, 2, 3] }, flag: true };
const STRING_CONTAINING_JSON = '{"not":"a document"}';

const Reading = model('Reading', {
  fields: {
    id: field.column(integerColumn).id(),
    counter: field.column(bigintColumn).optional(),
    payload: field.column(blobColumn).optional(),
    document: field.column(jsonColumn).optional(),
    label: field.column(textColumn).optional(),
  },
}).sql({ table: 'canon_readings' });

const Station = model('Station', {
  fields: {
    id: field.column(integerColumn).id(),
    readingId: field.column(integerColumn).column('reading_id'),
  },
  relations: {
    reading: rel.belongsTo(Reading, { from: 'readingId', to: 'id' }),
  },
}).sql({ table: 'canon_stations' });

const contract = defineContract({ models: { Reading, Station } });

describe('integration/sqlite include canonical JSON', () => {
  let directory: string | undefined;
  let database: DatabaseSync | undefined;
  let runtime: SqliteRuntimeImpl | undefined;
  let stations: Collection<typeof contract, 'Station'> | undefined;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'pn-sqlite-canonical-'));
    const path = join(directory, 'test.db');
    database = new DatabaseSync(path);
    database.exec(`
      create table canon_readings (
        id integer primary key,
        counter text,
        payload blob,
        document text,
        label text
      );
      create table canon_stations (
        id integer primary key,
        reading_id integer not null
      );
    `);

    const stack = createSqlExecutionStack({
      target: sqliteTarget,
      adapter: sqliteAdapter,
      driver: sqliteDriver,
    });
    const context = createExecutionContext<Contract<SqlStorage>>({ contract, stack });
    const instance = instantiateExecutionStack(stack);
    const adapter = instance.adapter;
    const driver = instance.driver;
    if (adapter === undefined || driver === undefined) {
      throw new Error('SQLite execution stack is missing its adapter or driver');
    }
    await driver.connect({ kind: 'path', path });
    runtime = new SqliteRuntimeImpl({ context, adapter, driver });
    // SQLite has no schema namespaces, so the contract builder leaves models in
    // the unbound namespace rather than `public`.
    stations = new Collection({ runtime, context }, 'Station', {
      namespaceId: soleDomainNamespaceId(contract.domain),
    });
  });

  afterAll(async () => {
    await runtime?.close();
    database?.close();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  });

  function seed(id: number, values: Record<string, unknown>): void {
    const columns = Object.keys(values);
    database!
      .prepare(
        `insert into canon_readings (id${columns.map((c) => `, ${c}`).join('')}) values (?${columns.map(() => ', ?').join('')})`,
      )
      .run(id, ...(Object.values(values) as Array<string | number | null | Uint8Array>));
    database!.prepare('insert into canon_stations (id, reading_id) values (?, ?)').run(id, id);
  }

  it('carries a bigint, a blob and a document through an include exactly', async () => {
    seed(1, {
      counter: WIDE_BIGINT.toString(),
      payload: WIDE_BLOB,
      document: JSON.stringify(DOCUMENT),
      label: 'present',
    });

    const rows = await stations!
      .select('id')
      .include('reading', (reading) => reading.select('counter', 'payload', 'document', 'label'))
      .all();

    expect(rows).toEqual([
      {
        id: 1,
        reading: {
          counter: WIDE_BIGINT,
          payload: WIDE_BLOB,
          document: DOCUMENT,
          label: 'present',
        },
      },
    ]);
  });

  // The pair D6 singled out: a document and a string that happens to contain
  // JSON must not converge. The retag applies to the document column because
  // its codec says so, not because its content looks like JSON, so a text
  // column holding the same characters stays a string.
  it('keeps a document apart from a string that merely contains JSON', async () => {
    seed(2, { document: JSON.stringify(DOCUMENT), label: STRING_CONTAINING_JSON });

    const rows = await stations!
      .select('id')
      .include('reading', (reading) => reading.select('document', 'label'))
      .all();

    expect(rows).toEqual([
      { id: 1, reading: { document: DOCUMENT, label: 'present' } },
      { id: 2, reading: { document: DOCUMENT, label: STRING_CONTAINING_JSON } },
    ]);
  });

  it('carries a NULL through as null, for every codec that projects', async () => {
    seed(3, { label: null });

    const rows = await stations!
      .select('id')
      .include('reading', (reading) => reading.select('counter', 'payload', 'document', 'label'))
      .all();

    expect(rows[2]).toEqual({
      id: 3,
      reading: { counter: null, payload: null, document: null, label: null },
    });
  });

  // An empty blob and an absent one both hex to `''`, and `decodeJson` accepts
  // `''` as a valid zero-length blob — so this is the pair the NULL guard on the
  // hex projection exists to keep apart, asserted where a user would see it.
  it('keeps an empty blob apart from an absent one', async () => {
    seed(4, { payload: new Uint8Array() });

    const rows = await stations!
      .select('id')
      .include('reading', (reading) => reading.select('payload'))
      .all();

    expect(rows.map((row) => row.reading)).toEqual([
      { payload: WIDE_BLOB },
      { payload: null },
      { payload: null },
      { payload: new Uint8Array() },
    ]);
  });
});
