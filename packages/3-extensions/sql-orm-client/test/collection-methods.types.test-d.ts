import { int4Column } from '@internal/adapter-postgres/column-types';
import { field } from '@internal/sql-contract-ts/contract-builder';
import {
  type PostgresTsqueryArgument,
  websearchToTsquery,
} from '@internal/target-postgres/full-text';
import { describe, expectTypeOf, test } from 'vitest';
import { Collection } from '../src/collection';
import type {
  CollectionMethodNameClash,
  CollectionMethodResult,
  CollectionMethods,
  ModelCollectionMethodTable,
} from '../src/collection-methods';
import type { CollectionRowOf, Filtered, HasOrderBy, HasWhere } from '../src/collection-types';
import { orm } from '../src/orm';
import type { TestVector } from './collection-methods-fixture';
import {
  createCollectionMethodsOrm,
  type SearchableUserCollection,
} from './collection-methods-orm-fixture';
import { createMockRuntime, getTestContext, type TestContract } from './helpers';

const { db, plain, notes, fragment } = createCollectionMethodsOrm();
const q = websearchToTsquery('alice');

describe('using', () => {
  test('has the methods each contribution gives the model, under the names it chose', () => {
    expectTypeOf(plain.User.using).not.toBeAny();
    expectTypeOf<keyof typeof plain.User.using>().toEqualTypeOf<'users_search' | 'as_of'>();
    expectTypeOf<keyof typeof plain.Post.using>().toEqualTypeOf<'embedding_closest'>();
    expectTypeOf<keyof typeof notes.Note.using>().toEqualTypeOf<'notes_search'>();
  });

  test('serves a collection narrowed by variant from the base model table', () => {
    const memos = notes.Note.variant('memo');
    expectTypeOf<keyof typeof memos.using>().toEqualTypeOf<'notes_search'>();
    expectTypeOf(memos.using.notes_search(q)).toExtend<HasWhere & HasOrderBy>();
  });

  test('has no method under the physical name of an index', () => {
    // @ts-expect-error the hashed physical name is not a method name
    plain.User.using.users_search_1d1ec8a9;
  });

  test('has no members for a model no contribution gives a method', () => {
    expectTypeOf(plain.Comment.using).toEqualTypeOf<Record<never, never>>();
    // @ts-expect-error Comment has no full-text index
    plain.Comment.using.users_search;
  });

  test('refuses a misspelled method name', () => {
    // @ts-expect-error no contribution gives User a method `search`
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

describe('a contribution that reads the whole model', () => {
  test('names a method after a field of a codec, and types its argument from the field', () => {
    expectTypeOf(plain.Post.using.embedding_closest).parameter(0).toEqualTypeOf<TestVector<3>>();
    expectTypeOf(plain.Post.using.embedding_closest([1, 2, 3])).toExtend<HasWhere & HasOrderBy>();
  });

  test('offers a method with a fixed name on a model whose table has a column of a codec', () => {
    expectTypeOf(plain.User.using.as_of).parameter(0).toEqualTypeOf<Date>();
    // @ts-expect-error Post has no jsonb column, so it has no as_of
    plain.Post.using.as_of(new Date());
  });
});

describe('two contributions that give a model the same method name', () => {
  test('type the name as a clash that names the model and both contributions', () => {
    expectTypeOf(plain.Tag.using.labelled).toEqualTypeOf<
      CollectionMethodNameClash<'labelled', 'Tag', 'test/clash-a' | 'test/clash-b'>
    >();
  });

  test('make a call a compile error', () => {
    // @ts-expect-error the method name is contributed twice
    plain.Tag.using.labelled('x');
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
    expectTypeOf(db.User.relevant(q)).not.toBeAny();
  });

  test('is offered on this inside a generic collection subclass', () => {
    class Library<Model extends 'User' | 'Post'> extends Collection<TestContract, Model> {
      methods() {
        return this.using;
      }
    }
    class UserLibrary extends Library<'User'> {
      search(query: PostgresTsqueryArgument) {
        return this.using.users_search(query);
      }
    }
    const users = orm({
      runtime: createMockRuntime(),
      context: getTestContext(),
      collections: { User: UserLibrary },
    }).public.User;
    expectTypeOf(users.search(q)).not.toBeAny();
    expectTypeOf(users.search(q)).toExtend<UserLibrary & HasWhere & HasOrderBy>();
  });

  test('is offered inside with and inside a fragment for one model', () => {
    const viaWith = plain.User.with((users) => users.using.users_search(q));
    const search = plain.User.fragment((users) => users.using.users_search(q));
    const viaFragment = plain.User.with(search);
    expectTypeOf(viaWith).not.toBeAny();
    expectTypeOf(viaWith).toExtend<HasWhere & HasOrderBy>();
    expectTypeOf(viaFragment).toExtend<HasWhere & HasOrderBy>();
  });

  test('is not offered inside a fragment for any model', () => {
    fragment({ id: field.column(int4Column) }, (rows) => {
      // @ts-expect-error a fragment for any model reads no model
      rows.using;
      return rows;
    });
  });

  test('infers its receiver from an expected subtype, but not from an unrelated type', () => {
    const subtype: Filtered<typeof plain.User> = plain.User.using.users_search(q);
    expectTypeOf(subtype).toExtend<HasWhere>();
    // @ts-expect-error a number is not a collection
    const unrelated: number = plain.User.using.users_search(q);
    expectTypeOf(unrelated).toBeNumber();
  });
});

test('CollectionMethods names the model in its type arguments', () => {
  expectTypeOf(plain.User.using).toEqualTypeOf<
    CollectionMethods<TestContract, 'User', 'public', typeof plain.User>
  >();
});
