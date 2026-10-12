import { int4Column } from '@internal/adapter-postgres/column-types';
import { field } from '@internal/sql-contract-ts/contract-builder';
import { websearchToTsquery } from '@internal/target-postgres/full-text';
import { describe, expectTypeOf, test } from 'vitest';
import { Collection } from '../src/collection';
import type {
  CollectionMethodResult,
  CollectionMethods,
  ModelCollectionMethodTable,
} from '../src/collection-methods';
import type { CollectionRowOf, Filtered, HasOrderBy, HasWhere } from '../src/collection-types';
import {
  createCollectionMethodsOrm,
  type SearchableUserCollection,
} from './collection-methods-orm-fixture';
import type { TestContract } from './helpers';

const { db, plain, notes, unlisted, fragment } = createCollectionMethodsOrm();
const q = websearchToTsquery('alice');

describe('using', () => {
  test('has a method under the authored name of each index a registered contribution matches', () => {
    expectTypeOf(plain.User.using).not.toBeAny();
    expectTypeOf<keyof typeof plain.User.using>().toEqualTypeOf<'users_search'>();
    expectTypeOf<keyof typeof notes.Note.using>().toEqualTypeOf<
      'notes_search' | 'notes_title_trgm'
    >();
  });

  test('has no method under the physical name of an index', () => {
    // @ts-expect-error the hashed physical name is not a method name
    plain.User.using.users_search_1d1ec8a9;
  });

  test('has no members for a model with no matching index', () => {
    expectTypeOf(plain.Post.using).toEqualTypeOf<Record<never, never>>();
    expectTypeOf(notes.Tag.using).toEqualTypeOf<Record<never, never>>();
    // @ts-expect-error Post has no full-text index
    plain.Post.using.users_search;
  });

  test('refuses a misspelled method name', () => {
    // @ts-expect-error no index is named `search`
    plain.User.using.search(q);
  });

  test('refuses an argument of the wrong type', () => {
    // @ts-expect-error a full-text method takes a tsquery, not a string
    plain.User.using.users_search('alice');
  });

  test('has no members when the model name is not known', () => {
    expectTypeOf<ModelCollectionMethodTable<TestContract, string, 'public'>>().toEqualTypeOf<
      Record<never, never>
    >();
    expectTypeOf<ModelCollectionMethodTable<TestContract, 'User', string>>().toEqualTypeOf<
      Record<never, never>
    >();
  });

  test('is a member a custom class cannot redeclare', () => {
    class Redeclared extends Collection<TestContract, 'User'> {
      // @ts-expect-error `using` is an accessor of every collection
      using() {
        return 1;
      }
    }
    expectTypeOf<Redeclared>().not.toBeAny();
  });
});

describe('a contributed method', () => {
  test('returns the collection it was called on, filtered and ordered', () => {
    const result = plain.User.using.users_search(q);
    expectTypeOf(result).not.toBeAny();
    expectTypeOf(result).toEqualTypeOf<CollectionMethodResult<typeof plain.User>>();
    expectTypeOf(result).toExtend<HasWhere & HasOrderBy>();
    expectTypeOf(result.limit(3).all).toBeFunction();
  });

  test('keeps a custom collection class', () => {
    const result = db.User.using.users_search(q);
    expectTypeOf(result).toExtend<SearchableUserCollection & HasWhere & HasOrderBy>();
    expectTypeOf(result.named('a').relevant(q)).toExtend<SearchableUserCollection>();
  });

  test('keeps the row type chosen before the call', () => {
    const result = plain.User.select('id').using.users_search(q);
    expectTypeOf<CollectionRowOf<typeof result>>().toEqualTypeOf<{ id: number }>();
  });

  test('is offered after where, limit and orderBy', () => {
    expectTypeOf(db.User.named('a').limit(5).using.users_search(q)).toExtend<
      SearchableUserCollection & HasWhere & HasOrderBy
    >();
    expectTypeOf(plain.User.orderBy((u) => u.id.asc()).using.users_search(q)).toExtend<
      HasWhere & HasOrderBy
    >();
  });

  test('is offered inside an include refinement', () => {
    const result = plain.User.include('invitedUsers', (invited) =>
      invited.using.users_search(q).limit(3),
    );
    expectTypeOf(result).not.toBeAny();
  });

  test('is offered on this inside a custom collection method', () => {
    expectTypeOf(db.User.relevant(q)).toExtend<SearchableUserCollection & HasWhere & HasOrderBy>();
  });

  test('is offered inside with and inside a fragment for one model', () => {
    const viaWith = plain.User.with((users) => users.using.users_search(q));
    const search = plain.User.fragment((users) => users.using.users_search(q));
    const viaFragment = plain.User.with(search);
    expectTypeOf(viaWith).toExtend<HasWhere & HasOrderBy>();
    expectTypeOf(viaFragment).toExtend<HasWhere & HasOrderBy>();
  });

  test('is not offered inside a fragment for any model', () => {
    fragment({ id: field.column(int4Column) }, (rows) => {
      // @ts-expect-error a fragment for any model reads no indexes
      rows.using;
      return rows;
    });
  });

  test('serves the base model indexes on a collection narrowed by variant', () => {
    const memos = notes.Note.variant('memo');
    expectTypeOf<keyof typeof memos.using>().toEqualTypeOf<'notes_search' | 'notes_title_trgm'>();
  });

  test('infers its receiver from an expected subtype, but not from an unrelated type', () => {
    const subtype: Filtered<typeof plain.User> = plain.User.using.users_search(q);
    expectTypeOf(subtype).toExtend<HasWhere>();
    // @ts-expect-error a number is not a collection
    const unrelated: number = plain.User.using.users_search(q);
    expectTypeOf(unrelated).toBeNumber();
  });
});

describe('a second index type', () => {
  test('contributes its own method without a change to the ORM client', () => {
    expectTypeOf(notes.Note.using.notes_title_trgm('title', 'x')).toExtend<HasWhere & HasOrderBy>();
  });

  test('reads the literal index data', () => {
    // @ts-expect-error `body` is not a column of the trigram index
    notes.Note.using.notes_title_trgm('body', 'x');
  });

  test('adds no method to a contract whose packs do not include its index type', () => {
    expectTypeOf<keyof typeof unlisted.User.using>().toEqualTypeOf<'users_search'>();
  });
});

test('CollectionMethods names the model in its type arguments', () => {
  expectTypeOf(plain.User.using).toEqualTypeOf<
    CollectionMethods<TestContract, 'User', 'public', typeof plain.User>
  >();
});
