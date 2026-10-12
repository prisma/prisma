import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import type { CollectionRowOf, HasOrderBy, HasWhere } from '@prisma/orm-postgres/orm-client';
import { websearchToTsquery } from '@prisma/orm-postgres/target/full-text';
import { describe, expectTypeOf, test } from 'vitest';
import { createOrmClient } from '../src/orm-client/client';
import type { PostCollection } from '../src/orm-client/collections';
import { db } from '../src/prisma/db';

declare const runtime: Runtime;

const custom = createOrmClient(runtime);
const plain = db.orm.public;
const q = websearchToTsquery('zebra');

describe('collection methods from the Postgres package, through built output', () => {
  test('one method for each full-text index, under its authored name', () => {
    expectTypeOf(plain.Post.using).not.toBeAny();
    expectTypeOf<keyof typeof plain.Post.using>().toEqualTypeOf<
      'post_search' | 'post_title_search'
    >();
    // @ts-expect-error the physical name is not a method name
    plain.Post.using.post_search_f03270be;
  });

  test('a model with no full-text index has no methods', () => {
    expectTypeOf(plain.User.using).toEqualTypeOf<Record<never, never>>();
    // @ts-expect-error User has no full-text index
    plain.User.using.post_search;
  });

  test('a method keeps the receiver and adds the filter and order facts', () => {
    const result = custom.Post.forUser('u').using.post_search(q);
    expectTypeOf(result).toExtend<PostCollection & HasWhere & HasOrderBy>();
    expectTypeOf(result.newestFirst()).toExtend<PostCollection>();
  });

  test('the row type chosen before the call is kept', () => {
    const result = plain.Post.select('id', 'title').using.post_search(q);
    expectTypeOf<CollectionRowOf<typeof result>>().toEqualTypeOf<{ id: string; title: string }>();
  });

  test('a method is offered inside an include refinement', () => {
    const result = plain.User.include('posts', (posts) =>
      posts.using.post_title_search(q).limit(3),
    );
    expectTypeOf(result).not.toBeAny();
  });

  test('a misspelled method name is an error', () => {
    // @ts-expect-error no index is named `search`
    plain.Post.using.search(q);
  });
});
