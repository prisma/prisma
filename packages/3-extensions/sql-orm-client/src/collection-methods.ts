import type { Contract } from '@internal/contract/types';
import type { SqlStorage, StorageTable } from '@internal/sql-contract/types';
import type {
  CollectionMethodIndex,
  CollectionMethodReceiver,
  ExecutionContext,
  SqlCollectionMethodContribution,
} from '@internal/sql-relational-core/query-lane-context';
import type { Filtered, Ordered } from './collection-types';
import { ormError } from './orm-errors';
import { resolveTableForContract } from './storage-resolution';
import type { ModelIndexReferences } from './types';

/**
 * The type half of a collection method a package contributes. An index whose reference is assignable to `match` gets the method. `index` is filled with that index's reference, so `parameters` can read it. `parameters` is the method's parameter list; the ORM client decides what it returns.
 */
export interface CollectionMethodKind {
  readonly match: unknown;
  readonly index: unknown;
  readonly parameters: readonly unknown[];
}

/**
 * The contributed collection methods, keyed by the id of their run-time half. A package that owns an index type adds its method by declaration merging.
 */
export interface CollectionMethodRegistry {
  /** Keeps the interface from being empty, which would make it a type alias that cannot be merged. */
  readonly __collectionMethodRegistry?: never;
}

type KindId = Exclude<keyof CollectionMethodRegistry, '__collectionMethodRegistry'>;

type MatchingKinds<Ref> = {
  [Id in KindId]: Ref extends CollectionMethodRegistry[Id]['match' &
    keyof CollectionMethodRegistry[Id]]
    ? Id
    : never;
}[KindId];

type KindParameters<Kind, Ref> = Kind & { readonly index: Ref } extends {
  readonly parameters: infer Parameters extends readonly unknown[];
}
  ? Parameters
  : never;

type ParametersOf<Ref> = {
  [Id in MatchingKinds<Ref>]: KindParameters<CollectionMethodRegistry[Id], Ref>;
}[MatchingKinds<Ref>];

/** What a contributed method returns: the collection it was called on, filtered and ordered. */
export type CollectionMethodResult<Self> = Ordered<Filtered<Self>>;

export type CollectionMethod<Parameters, Self> = <Receiver extends Self = Self>(
  ...args: Extract<Parameters, readonly unknown[]>
) => CollectionMethodResult<Receiver>;

/** Each contributed method of a model, by index name, with its parameter list. It does not depend on the receiver, so TypeScript computes it once per model. */
export type ModelCollectionMethodTable<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
  NsId extends string,
  Refs = ModelIndexReferences<TContract, ModelName, NsId>,
> = string extends keyof Refs
  ? Record<never, never>
  : {
      readonly [Name in keyof Refs as [MatchingKinds<Refs[Name]>] extends [never]
        ? never
        : Name]: ParametersOf<Refs[Name]>;
    };

/** The contributed methods of a model's collection `Self`: one for each index of the model's table that a registered contribution matches. */
export type CollectionMethods<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
  NsId extends string,
  Self,
  Table = ModelCollectionMethodTable<TContract, ModelName, NsId>,
> = {
  readonly [Name in keyof Table]: CollectionMethod<Table[Name], Self>;
};

type MethodEntry = readonly [indexName: string, contribution: SqlCollectionMethodContribution];

const entriesByContext = new WeakMap<ExecutionContext, Map<string, ReadonlyArray<MethodEntry>>>();

function indexesByAuthoredName(table: StorageTable): Map<string, CollectionMethodIndex[]> {
  const byName = new Map<string, CollectionMethodIndex[]>();
  for (const index of table.indexes) {
    const name = index.prefix ?? index.name;
    byName.set(name, [...(byName.get(name) ?? []), index]);
  }
  return byName;
}

function tableEntries(
  context: ExecutionContext,
  namespaceId: string,
  tableName: string,
): ReadonlyArray<MethodEntry> {
  const contributions = context.collectionMethods ?? [];
  const table = resolveTableForContract(context.contract, namespaceId, tableName)?.table;
  if (contributions.length === 0 || table === undefined) return [];
  const entries: MethodEntry[] = [];
  for (const [name, [index, ...others]] of indexesByAuthoredName(table)) {
    if (index === undefined || others.length > 0) continue;
    const contribution = contributions.find((candidate) => candidate.matches(index));
    if (contribution !== undefined) entries.push([name, contribution]);
  }
  return entries;
}

/** The contributed methods of a table's collections, by index name, computed once per table. */
export function collectionMethodEntries(
  context: ExecutionContext,
  namespaceId: string,
  tableName: string,
): ReadonlyArray<MethodEntry> {
  let tables = entriesByContext.get(context);
  if (tables === undefined) {
    tables = new Map();
    entriesByContext.set(context, tables);
  }
  const key = JSON.stringify([namespaceId, tableName]);
  let entries = tables.get(key);
  if (entries === undefined) {
    entries = tableEntries(context, namespaceId, tableName);
    tables.set(key, entries);
  }
  return entries;
}

/** The run-time value of `collection.using`. */
export function createCollectionMethods(
  receiver: CollectionMethodReceiver,
  entries: ReadonlyArray<MethodEntry>,
): Readonly<Record<string, (...args: never[]) => CollectionMethodReceiver>> {
  return Object.freeze(
    Object.fromEntries(
      entries.map(([name, contribution]) => [
        name,
        (...args: never[]) => contribution.method(receiver, name, ...args),
      ]),
    ),
  );
}

function assertUniqueIds(contributions: ReadonlyArray<SqlCollectionMethodContribution>): void {
  const seen = new Set<string>();
  for (const { id } of contributions) {
    if (seen.has(id)) {
      throw ormError(
        'ORM.ARGUMENT_INVALID',
        `Two collection method contributions have the id "${id}".`,
        {
          why: 'A contribution is registered under its id in CollectionMethodRegistry, so an id names one contribution.',
          fix: 'List each extension once, or give one of the two contributions another id.',
          meta: { id },
        },
      );
    }
    seen.add(id);
  }
}

/**
 * Throws `ORM.ARGUMENT_INVALID` when two contributions share an id, or when two match the same index of the contract, which would give the index two methods under one name.
 */
export function assertCollectionMethodsUnambiguous(context: ExecutionContext): void {
  const contributions = context.collectionMethods ?? [];
  if (contributions.length === 0) return;
  assertUniqueIds(contributions);
  for (const [namespaceId, namespace] of Object.entries(context.contract.storage.namespaces)) {
    for (const [tableName, table] of Object.entries(namespace.entries.table ?? {})) {
      for (const index of table.indexes) {
        const ids = contributions
          .filter((contribution) => contribution.matches(index))
          .map(({ id }) => id);
        if (ids.length < 2) continue;
        const name = index.prefix ?? index.name;
        throw ormError(
          'ORM.ARGUMENT_INVALID',
          `Index "${name}" of table "${tableName}" is matched by more than one collection method contribution: ${ids.map((id) => `"${id}"`).join(', ')}.`,
          {
            why: 'An index gets one collection method under `using`, named after the index, so only one contribution may match it.',
            fix: 'Remove one of the extensions that contribute these methods.',
            meta: { namespaceId, tableName, index: name, contributions: ids },
          },
        );
      }
    }
  }
}
