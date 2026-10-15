import { int4Column, rawColumn } from '@internal/adapter-postgres/column-types';
import postgresAdapter from '@internal/adapter-postgres/runtime';
import { defineContract, field, model, rel } from '@internal/postgres/contract-builder';
import { Collection } from '@internal/sql-orm-client';
import { createExecutionContext, createSqlExecutionStack } from '@internal/sql-runtime';
import postgresTarget from '@internal/target-postgres/runtime';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { timeouts, withPushedContractRuntime } from './integration-helpers';

const ShelfBase = model('Shelf', {
  fields: {
    id: field.column(int4Column).id(),
    search: field.column(rawColumn('tsvector')),
    net: field.column(rawColumn('cidr')).optional(),
  },
}).sql({ table: 'raw_shelves' });

const Book = model('Book', {
  fields: {
    id: field.column(int4Column).id(),
    shelfId: field.column(int4Column).column('shelf_id'),
    search: field.column(rawColumn('tsvector')),
  },
  relations: { shelf: rel.belongsTo(ShelfBase, { from: 'shelfId', to: 'id' }) },
}).sql({ table: 'raw_books' });

const Shelf = ShelfBase.relations({
  books: rel.hasMany(() => Book, { by: 'shelfId' }),
}).sql({ table: 'raw_shelves' });

const contract = defineContract({ models: { Shelf, Book } });
const context = createExecutionContext({
  contract,
  stack: createSqlExecutionStack({ target: postgresTarget, adapter: postgresAdapter }),
});
const namespace = { namespaceId: 'public' };

describe('raw fields through the ORM', () => {
  it(
    'creates a row and reads it back flat and through includes, as the database writes the values',
    async () => {
      await withPushedContractRuntime(contract, async (runtime) => {
        const shelves = new Collection({ runtime, context }, 'Shelf', namespace);
        const books = new Collection({ runtime, context }, 'Book', namespace);
        await shelves.create({ id: 1, search: 'b a', net: '10.0.0.0/8' });
        await books.create({ id: 1, shelfId: 1, search: 'c' });

        const flat = await shelves.select('id', 'search', 'net').all();
        const toMany = await shelves
          .select('id')
          .include('books', (book) => book.select('id', 'search'))
          .all();
        const toOne = await books
          .select('id')
          .include('shelf', (shelf) => shelf.select('id', 'search', 'net'))
          .all();

        expectTypeOf(flat).toEqualTypeOf<{ id: number; search: unknown; net: unknown }[]>();
        expect({ flat, toMany, toOne }).toEqual({
          flat: [{ id: 1, search: "'a' 'b'", net: '10.0.0.0/8' }],
          toMany: [{ id: 1, books: [{ id: 1, search: "'c'" }] }],
          toOne: [{ id: 1, shelf: { id: 1, search: "'a' 'b'", net: '10.0.0.0/8' } }],
        });
      });
    },
    timeouts.spinUpPpgDev,
  );
});
