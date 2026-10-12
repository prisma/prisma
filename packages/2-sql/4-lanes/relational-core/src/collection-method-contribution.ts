import type { Index } from '@internal/sql-contract/types';
import type { IndexReference } from './index-reference';

/**
 * The type half of a collection method a package contributes. An index whose reference is assignable to `match`, in a contract whose `target` is assignable to `target` when one is given, gets the method. `index` is filled with that index's reference, so `parameters` can read it. `parameters` is the method's parameter list; the ORM client decides what it returns.
 */
export interface CollectionMethodSignature {
  readonly target?: string;
  readonly match: unknown;
  readonly index: unknown;
  readonly parameters: readonly unknown[];
}

/**
 * The type halves of the contributed collection methods, keyed by the id of their run-time half. A package that owns an index type adds its signature by declaration merging.
 */
export interface CollectionMethodRegistry {
  /** Keeps the interface from being empty, which would make it a type alias that cannot be merged. */
  readonly __collectionMethodRegistry?: never;
}

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
 * The run-time half of a collection method a package contributes for the indexes it `matches`, in contracts of `target` when one is given. `id` is the key its type half registers under in `CollectionMethodRegistry`.
 */
export interface CollectionMethodContribution {
  readonly id: string;
  readonly target?: string;
  matches(index: CollectionMethodIndex): boolean;
  readonly method: CollectionMethodBody;
}
