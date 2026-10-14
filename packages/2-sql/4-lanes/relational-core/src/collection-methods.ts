import type { ContractField, ContractRelation } from '@internal/contract/types';
import type { StorageTable } from '@internal/sql-contract/types';
import type { IndexReference } from './index-reference';

/**
 * One model, as a contribution reads it: the contract's target, the model's name, its fields with their codec ids and type parameters, its relations, and its storage table with columns and indexes.
 */
export interface CollectionMethodModel {
  readonly target: string;
  readonly name: string;
  readonly fields: object;
  readonly relations: object;
  readonly table: { readonly columns: object; readonly indexes: readonly unknown[] };
}

/**
 * The type half of a package's collection methods. The ORM client fills `model` with one model's `CollectionMethodModel` and reads `methods` back: an object type whose keys are method names and whose values are parameter lists. An entry computes `methods` from `this['model']`.
 */
export interface CollectionMethodsEntry {
  readonly model: CollectionMethodModel;
  readonly methods: object;
}

/**
 * The type halves of the contributed collection methods, keyed by the id of their run-time half. A package adds its entry by declaration merging, in a module the package's own entry point loads.
 */
export interface CollectionMethodRegistry {
  /** Keeps the interface from being empty, which would make it a type alias that cannot be merged. */
  readonly __collectionMethodRegistry?: never;
}

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

/** A contributed method's body: refines `collection` with the method's arguments. */
export type CollectionMethodBody = (
  collection: CollectionMethodReceiver,
  ...args: never[]
) => CollectionMethodReceiver;

/** One model, as a contribution's run-time half reads it. */
export interface CollectionMethodModelView {
  readonly target: string;
  readonly name: string;
  readonly fields: Readonly<Record<string, ContractField>>;
  readonly relations: Readonly<Record<string, ContractRelation>>;
  readonly table: StorageTable;
}

/**
 * The run-time half of a package's collection methods. `methodsFor` returns one model's methods by name; the ORM client calls it once for each model of the contract. `id` is the key its type half registers under in `CollectionMethodRegistry`.
 */
export interface CollectionMethodContribution {
  readonly id: string;
  methodsFor(model: CollectionMethodModelView): Readonly<Record<string, CollectionMethodBody>>;
}
