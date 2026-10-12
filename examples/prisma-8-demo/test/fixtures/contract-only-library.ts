import { Collection } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../../src/prisma/contract.d';

type PostSearchQuery = Parameters<Collection<Contract, 'Post'>['using']['post_search']>[0];

export class SearchablePosts extends Collection<Contract, 'Post'> {
  search(query: PostSearchQuery) {
    return this.using.post_search(query);
  }

  misspelled(query: PostSearchQuery) {
    // @ts-expect-error no index of Post is named `search`
    return this.using.search(query);
  }
}
