import type { Contract } from '@internal/contract/types';
import type { SqlStorage, StorageTable } from '@internal/sql-contract/types';
import type {
  CollectionMethodContribution,
  CollectionMethodIndex,
  CollectionMethodReceiver,
  CollectionMethodRegistry,
  ExecutionContext,
} from '@internal/sql-relational-core/query-lane-context';
import type { Filtered, Ordered } from './collection-types';
import { ormError } from './orm-errors';
import { storageTableForContract } from './storage-resolution';
import type { ModelIndexReferences } from './types';

type SignatureId = Exclude<keyof CollectionMethodRegistry, '__collectionMethodRegistry'>;

type ForTarget<Signature, Target> = Signature extends { readonly target: infer Owner }
  ? Target extends Owner
    ? true
    : false
  : true;

type MatchingSignatures<Ref, Target> = {
  [Id in SignatureId]: Ref extends CollectionMethodRegistry[Id]['match' &
    keyof CollectionMethodRegistry[Id]]
    ? ForTarget<CollectionMethodRegistry[Id], Target> extends true
      ? Id
      : never
    : never;
}[SignatureId];

type SignatureParameters<Signature, Ref> = Signature & { readonly index: Ref } extends {
  readonly parameters: infer Parameters extends readonly unknown[];
}
  ? Parameters
  : never;

type ParametersOf<Ref, Target> = {
  [Id in MatchingSignatures<Ref, Target>]: SignatureParameters<CollectionMethodRegistry[Id], Ref>;
}[MatchingSignatures<Ref, Target>];

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
      readonly [Name in keyof Refs as [
        MatchingSignatures<Refs[Name], TContract['target']>,
      ] extends [never]
        ? never
        : Name]: ParametersOf<Refs[Name], TContract['target']>;
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

type MethodEntry = readonly [indexName: string, contribution: CollectionMethodContribution];

const entriesByContext = new WeakMap<ExecutionContext, Map<string, ReadonlyArray<MethodEntry>>>();
const unambiguousContexts = new WeakSet<ExecutionContext>();

/** The contributions that apply to the context's contract: those for its target, and those for any target. */
function contributionsFor(context: ExecutionContext): ReadonlyArray<CollectionMethodContribution> {
  return (context.collectionMethods ?? []).filter(
    ({ target }) => target === undefined || target === context.contract.target,
  );
}

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
  const contributions = contributionsFor(context);
  const table = storageTableForContract(context.contract, namespaceId, tableName);
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

function assertUniqueIds(contributions: ReadonlyArray<CollectionMethodContribution>): void {
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

function assertOneContributionPerIndex(context: ExecutionContext): void {
  const contributions = contributionsFor(context);
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

/**
 * Throws `ORM.ARGUMENT_INVALID` when two contributions share an id, or when two match the same index of the contract, which would give the index two methods under one name. A context is checked once.
 */
export function assertCollectionMethodsUnambiguous(context: ExecutionContext): void {
  if (unambiguousContexts.has(context)) return;
  assertUniqueIds(context.collectionMethods ?? []);
  assertOneContributionPerIndex(context);
  unambiguousContexts.add(context);
}
