import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { orm } from '@internal/sql-orm-client';
import type { SqliteClient } from '@internal/sqlite/runtime';
import sqlite from '@internal/sqlite/runtime';
import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Contract } from './fixtures/nested-includes-sqlite/generated/contract';
import contractJson from './fixtures/nested-includes-sqlite/generated/contract.json' with {
  type: 'json',
};

// SQLite has no json equality problem the way Postgres does — its json_agg
// equivalent renders to TEXT, which compares fine. Without this guard,
// distinct() combined with include() would "succeed" there while silently
// deduping on the serialized child array instead of the scalar columns the
// caller meant. The guard has to fire on both targets for the same reason:
// this is not a database-specific limitation to route around per adapter.
//
// Driven through the real emitted fixture
// (`fixtures/nested-includes-sqlite/generated/`), not an in-source
// `defineContract` build — an in-source 3-level hasMany chain (Author ->
// Book -> Review) reached through an `.include()` refinement callback hits a
// pre-existing `.include()` relation-name inference gap that collapses to
// `never`, regardless of target (confirmed: the identical in-source shape
// also fails to typecheck against a Postgres contract, and fails the same
// way whether the collection is constructed directly or reached through the
// `orm()` namespace facet). The emitted contract does not hit that gap, so
// this fixture is the faithful way to prove the guard's nested-refinement
// case on SQLite.
describe('integration/distinct + include guard (sqlite)', () => {
  let directory: string | undefined;
  let database: DatabaseSync | undefined;
  let client: SqliteClient<Contract> | undefined;
  let db: ReturnType<typeof orm<Contract>> | undefined;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'pn-distinct-guard-'));
    const path = join(directory, 'test.db');
    database = new DatabaseSync(path);
    database.exec(`
      create table guard_authors (id integer primary key, name text not null);
      create table guard_books (
        id integer primary key,
        author_id integer not null,
        title text not null
      );
      create table guard_reviews (
        id integer primary key,
        book_id integer not null,
        body text not null
      );
    `);
    database.exec(`insert into guard_authors (id, name) values (1, 'Ada')`);
    database.exec(
      `insert into guard_books (id, author_id, title) values (10, 1, 'A'), (11, 1, 'A')`,
    );
    database.exec(`insert into guard_reviews (id, book_id, body) values (100, 10, 'great')`);

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

  it('rejects distinct() combined with a root-level include', async () => {
    const authors = db![UNBOUND_NAMESPACE_ID].Author;
    await expect(authors.include('books').distinct().all()).rejects.toThrow(
      "distinct() cannot combine with include('books')",
    );
  });

  it('rejects distinct() combined with a nested include inside a refinement', async () => {
    const authors = db![UNBOUND_NAMESPACE_ID].Author;
    await expect(
      authors.include('books', (books) => books.include('reviews').distinct()).all(),
    ).rejects.toThrow("distinct() cannot combine with include('reviews')");
  });

  it('distinct() without any include still works', async () => {
    const authors = db![UNBOUND_NAMESPACE_ID].Author;
    const rows = await authors.select('name').distinct().all();
    expect(rows).toEqual([{ name: 'Ada' }]);
  });
});
