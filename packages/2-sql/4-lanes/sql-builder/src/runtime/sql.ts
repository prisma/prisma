import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { createRawSql, type RawCodecInferer } from '@internal/sql-relational-core/expression';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import { blindCast } from '@internal/utils/casts';
import { structuredError } from '@internal/utils/structured-error';
import type { Db, TableProxyContract } from '../types/db';
import type { RawTagFor } from '../types/raw-query';
import type { BuilderContext } from './builder-base';
import { resolveTableInNamespace } from './resolve-table';
import { TableProxyImpl } from './table-proxy-impl';

/** The key `raw`, which the SQL surface answers with the raw statement tag; no storage namespace may claim it. */
const RAW_TAG_KEY = 'raw';

export interface SqlOptions<C extends Contract<SqlStorage> & TableProxyContract> {
  readonly context: ExecutionContext<C>;
  readonly rawCodecInferer: RawCodecInferer;
}

export function sql<C extends Contract<SqlStorage> & TableProxyContract>(
  options: SqlOptions<C>,
): Db<C> {
  const { context, rawCodecInferer } = options;
  const ctx: BuilderContext = {
    capabilities: context.contract.capabilities,
    queryOperationTypes: context.queryOperations.entries(),
    target: context.contract.target ?? 'unknown',
    storageHash: context.contract.storage.storageHash ?? 'unknown',
    storage: context.contract.storage,
    applyMutationDefaults: (options) => context.applyMutationDefaults(options),
    rawCodecInferer,
    aggregates: context.aggregateDescriptors,
  };

  const { storage } = context.contract;

  // `db.raw` is the whole-query raw tag, so a namespace of that name would be
  // unreachable through the surface while still typing as one. Refuse the
  // contract here rather than answering `undefined` for every table in it.
  if (Object.hasOwn(storage.namespaces, RAW_TAG_KEY)) {
    throw structuredError(
      'ORM.NAMESPACE_RESERVED',
      `The SQL surface exposes the raw statement tag as "db.${RAW_TAG_KEY}", so a storage namespace named "${RAW_TAG_KEY}" cannot be reached through it. Rename the namespace in the schema.`,
      { meta: { namespaceId: RAW_TAG_KEY } },
    );
  }

  // Bound once, here: the tag carries the adapter's codec inferer and the
  // contract its plans are stamped from, so an authoring site states neither.
  // The row type each terminator mints is phantom — the contract resolves what
  // a declared column decodes to, which the target-agnostic tag types as
  // `unknown`.
  const raw = blindCast<
    RawTagFor<C>,
    'the row type a raw plan carries is phantom: the same builder mints it, and only the contract states what its declared columns decode to'
  >(createRawSql(rawCodecInferer, { contract: context.contract }));

  return new Proxy(
    blindCast<Db<C>, 'the handler answers every property; the target is an empty carrier'>({}),
    {
      get(_target, prop: string | symbol) {
        if (typeof prop !== 'string') {
          return undefined;
        }
        if (prop === RAW_TAG_KEY) {
          return raw;
        }
        if (!Object.hasOwn(storage.namespaces, prop)) {
          return undefined;
        }
        const namespaceId = prop;
        return new Proxy(
          {},
          {
            get(_facetTarget, tableName: string | symbol) {
              if (typeof tableName !== 'string') {
                return undefined;
              }
              const table = resolveTableInNamespace(storage, namespaceId, tableName);
              if (table) {
                // `namespaceId` is a dynamic Proxy key with no static literal here, so the
                // proxy's `NsId` type param lands on its `string` default at this boundary.
                // `TableProxyImpl` still forwards `NsId` through its `as()`/join chain.
                return new TableProxyImpl(tableName, table, tableName, ctx, namespaceId);
              }
              return undefined;
            },
          },
        );
      },
    },
  );
}
