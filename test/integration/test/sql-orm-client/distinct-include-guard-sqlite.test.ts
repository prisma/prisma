import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { integerColumn, textColumn } from '@internal/adapter-sqlite/column-types';
import sqliteAdapter from '@internal/adapter-sqlite/runtime';
import { soleDomainNamespaceId } from '@internal/contract/types';
import sqliteDriver from '@internal/driver-sqlite/runtime';
import { instantiateExecutionStack } from '@internal/framework-components/execution';
import { Collection } from '@internal/sql-orm-client';
import { createExecutionContext, createSqlExecutionStack } from '@internal/sql-runtime';
import { defineContract, field, model, rel } from '@internal/sqlite/contract-builder';
import { SqliteRuntimeImpl } from '@internal/sqlite/runtime';
import sqliteTarget from '@internal/target-sqlite/runtime';
import { blindCast } from '@internal/utils/casts';
import { InternalError } from '@internal/utils/internal-error';
import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SQLite has no json equality problem the way Postgres does — its json_agg
// equivalent renders to TEXT, which compares fine. Without this guard,
// distinct() combined with include() would "succeed" there while silently
// deduping on the serialized child array instead of the scalar columns the
// caller meant. The guard has to fire on both targets for the same reason:
// this is not a database-specific limitation to route around per adapter.

const Author = model('Author', {
  fields: {
    id: field.column(integerColumn).id(),
    name: field.column(textColumn),
  },
}).sql({ table: 'guard_authors' });

const Book = model('Book', {
  fields: {
    id: field.column(integerColumn).id(),
    authorId: field.column(integerColumn).column('author_id'),
    title: field.column(textColumn),
  },
}).sql({ table: 'guard_books' });

const Review = model('Review', {
  fields: {
    id: field.column(integerColumn).id(),
    bookId: field.column(integerColumn).column('book_id'),
    body: field.column(textColumn),
  },
}).sql({ table: 'guard_reviews' });

const contract = defineContract({
  models: {
    Author: Author.relations({
      books: rel.hasMany(() => Book, { by: 'authorId' }),
    }),
    Book: Book.relations({
      reviews: rel.hasMany(() => Review, { by: 'bookId' }),
    }),
    Review,
  },
});
const namespaceId = soleDomainNamespaceId(contract.domain);

describe('integration/distinct + include guard (sqlite)', () => {
  let directory: string | undefined;
  let database: DatabaseSync | undefined;
  let runtime: SqliteRuntimeImpl | undefined;
  let authors: Collection<typeof contract, 'Author'> | undefined;

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

    const stack = createSqlExecutionStack({
      target: sqliteTarget,
      adapter: sqliteAdapter,
      driver: sqliteDriver,
    });
    const context = createExecutionContext({ contract, stack });
    const instance = instantiateExecutionStack(stack);
    const adapter = instance.adapter;
    const driver = instance.driver;
    if (adapter === undefined || driver === undefined) {
      throw new InternalError('SQLite execution stack is missing its adapter or driver');
    }
    await driver.connect({ kind: 'path', path });
    runtime = new SqliteRuntimeImpl({ context, adapter, driver });
    authors = new Collection({ runtime, context }, 'Author', { namespaceId });
  });

  afterAll(async () => {
    await runtime?.close();
    database?.close();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  });

  it('rejects distinct() combined with a root-level include', async () => {
    await expect(authors!.include('books').distinct().all()).rejects.toThrow(
      "distinct() cannot combine with include('books')",
    );
  });

  it('rejects distinct() combined with a nested include inside a refinement', async () => {
    // The relation name below is cast through `blindCast` because of a
    // pre-existing gap in `.include()`'s type-level relation-name resolution
    // for a 3-level hasMany chain (Author -> Book -> Review) reached through
    // a refinement callback on a SQLite contract: `books`'s inferred type
    // resolves `Book`'s own relations to `never`, even though the identical
    // contract shape typechecks fine on Postgres and the runtime call is
    // correct (confirmed by dropping `.distinct()` from this call, which
    // reproduces the same compile error with no relation to this guard).
    // Fixing that gap is outside the scope of the distinct()+include() guard
    // this test exercises; the runtime behavior below is what is under test.
    await expect(
      authors!
        .include('books', (books) =>
          books
            .include(
              blindCast<
                never,
                'pre-existing include() relation-name inference gap for 3-level SQLite hasMany chains through a refinement callback'
              >('reviews'),
            )
            .distinct(),
        )
        .all(),
    ).rejects.toThrow("distinct() cannot combine with include('reviews')");
  });

  it('distinct() without any include still works', async () => {
    const rows = await authors!.select('name').distinct().all();
    expect(rows).toEqual([{ name: 'Ada' }]);
  });
});
