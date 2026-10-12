import type { Index } from '@internal/sql-contract/types';
import type { IndexReference } from './index-reference';

/** An index of the contract, as a contribution's `matches` reads it. */
export type CollectionMethodIndex = Pick<Index, 'name' | 'type' | 'options'>;

/** The second argument of an ORM `where` or `orderBy` callback, as a contributed method reads it. */
export interface CollectionMethodTools {
  readonly fns: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly indexes: Readonly<Record<string, IndexReference>>;
}

/** The collection a contributed method refines: an ORM collection, seen only through `where` and `orderBy`. */
export interface CollectionMethodReceiver {
  where(
    condition: (model: unknown, tools: CollectionMethodTools) => unknown,
  ): CollectionMethodReceiver;
  orderBy(
    order: (model: unknown, tools: CollectionMethodTools) => unknown,
  ): CollectionMethodReceiver;
}

/** A contributed method's body: refines `collection` using the index named `indexName`. */
export type CollectionMethodBody = (
  collection: CollectionMethodReceiver,
  indexName: string,
  ...args: never[]
) => CollectionMethodReceiver;

/**
 * The run-time half of a collection method a package contributes for the indexes it `matches`. `id` is the key its type half registers under in the ORM client's `CollectionMethodRegistry`.
 */
export interface SqlCollectionMethodContribution {
  readonly id: string;
  matches(index: CollectionMethodIndex): boolean;
  readonly method: CollectionMethodBody;
}
