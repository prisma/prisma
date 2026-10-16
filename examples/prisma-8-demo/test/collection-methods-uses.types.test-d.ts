import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { Collection, orm } from '@prisma/orm-postgres/orm-client';
import type { ExecutionContext } from '@prisma/orm-postgres/relational-core/query-lane-context';
import { websearchToTsquery } from '@prisma/orm-postgres/target/full-text';
import { expectTypeOf, test } from 'vitest';
import { createOrmClient } from '../src/orm-client/client';
import type { Contract } from '../src/prisma/contract.d';

declare const runtime: Runtime;
declare const context: ExecutionContext<Contract>;

const db = createOrmClient(runtime);
const plain = orm({ runtime, context }).public;
const q = websearchToTsquery('zebra');

export class SearchPosts extends Collection<Contract, 'Post'> {
  search() {
    return this.using.post_search(q);
  }
}

export const use1 = plain.Post.using.post_search(q);
export const use2 = db.Post.using.post_search(q);
export const use3 = plain.Post.where({ title: 'a' }).using.post_search(q);
export const use4 = plain.Post.limit(3).using.post_title_search(q);
export const use5 = plain.Post.select('id').using.post_search(q);
export const use6 = plain.User.include('posts', (posts) => posts.using.post_search(q));
export const use7 = SearchPosts;
export const use8 = plain.Post.orderBy((p) => p.id.asc()).using.post_search(q);
export const use9 = plain.Post.with((posts) => posts.using.post_title_search(q));
export const use10 = db.Post.forUser('u').using.post_search(q).newestFirst();

test('ten uses of a contributed method, one per site, type-check', () => {
  expectTypeOf(use1).not.toBeAny();
  expectTypeOf(use10).not.toBeAny();
});
