import type { NamespacedEnums } from '@internal/contract/enum-accessor';
import type { Contract } from '@internal/contract/types';
import { sql as sqlBuilder } from '@internal/sql-builder/runtime';
import type { Db } from '@internal/sql-builder/types';
import type { ExtractCodecTypes, SqlStorage } from '@internal/sql-contract/types';
import {
  type CollectionClasses,
  orm as ormBuilder,
  type PreparedFrom,
  prepareQuery,
} from '@internal/sql-orm-client';
import type { CodecTypesBase, RawCodecInferer } from '@internal/sql-relational-core/expression';
import type { Preparable, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type {
  BindSiteParams,
  Declaration,
  ExecutionContext,
  ParamsFromDeclaration,
  Runtime,
  SqlExecutionStackWithDriver,
  TransactionContext,
} from '@internal/sql-runtime';
import { activitySource, delegatingActivitySource, withTransaction } from '@internal/sql-runtime';
import { castAs } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import type { PostgresStaticContext } from '../static/postgres-static';
import type { NamespacedNativeEnums } from './native-enums';
import type { PostgresTargetId } from './postgres-target-id';

type OrmClient<
  TContract extends Contract<SqlStorage>,
  TCollections extends CollectionClasses,
> = ReturnType<typeof ormBuilder<TContract, TCollections>>;

export interface PostgresTransactionContext<
  TContract extends Contract<SqlStorage>,
  TCollections extends CollectionClasses = Record<never, never>,
> extends TransactionContext {
  readonly sql: Db<TContract>;
  readonly orm: OrmClient<TContract, TCollections>;
  readonly enums: NamespacedEnums<TContract>;
  readonly nativeEnums: NamespacedNativeEnums<TContract>;
}

export interface PostgresStaticMembers<TContract extends Contract<SqlStorage>>
  extends PostgresStaticContext<TContract> {
  readonly stack: SqlExecutionStackWithDriver<PostgresTargetId>;
}

export interface PostgresRuntimeBoundMembers<
  TContract extends Contract<SqlStorage>,
  TCollections extends CollectionClasses = Record<never, never>,
> {
  readonly orm: OrmClient<TContract, TCollections>;
  runtime(): Runtime;
  transaction<R>(
    fn: (tx: PostgresTransactionContext<TContract, TCollections>) => PromiseLike<R>,
  ): Promise<R>;
  prepare<
    D extends Declaration<CT>,
    Q extends SqlQueryPlan | Preparable<unknown, unknown>,
    CT extends CodecTypesBase = ExtractCodecTypes<TContract>,
  >(
    declaration: D,
    callback: (params: BindSiteParams<D>) => Q,
  ): Promise<PreparedFrom<ParamsFromDeclaration<D, CT>, Q>>;
}

export interface PostgresLifecycleMembers {
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}

export interface PostgresRuntimeBoundMembersOptions<
  TContract extends Contract<SqlStorage>,
  TCollections extends CollectionClasses,
> {
  readonly context: ExecutionContext<TContract>;
  readonly collections: TCollections | undefined;
  readonly rawCodecInferer: RawCodecInferer;
  readonly enums: NamespacedEnums<TContract>;
  readonly nativeEnums: NamespacedNativeEnums<TContract>;
  readonly getRuntime: () => Runtime;
  // The runtime that ORM queries, transaction() and prepare() run on. An owner whose close() should let continuing work finish returns its runtime even after close(), so the runtime's own rule decides; otherwise it is getRuntime.
  readonly getRuntimeForWork: () => Runtime;
}

export function buildPostgresRuntimeBoundMembers<
  TContract extends Contract<SqlStorage>,
  TCollections extends CollectionClasses,
>(
  options: PostgresRuntimeBoundMembersOptions<TContract, TCollections>,
): PostgresRuntimeBoundMembers<TContract, TCollections> {
  const {
    context,
    collections,
    rawCodecInferer,
    enums,
    nativeEnums,
    getRuntime,
    getRuntimeForWork,
  } = options;

  const orm: OrmClient<TContract, TCollections> = ormBuilder<TContract, TCollections>({
    runtime: {
      query(plan) {
        return getRuntimeForWork().query(plan);
      },
      execute(plan) {
        return getRuntimeForWork().execute(plan);
      },
      connection() {
        return getRuntimeForWork().connection();
      },
      [activitySource]: delegatingActivitySource(() => getRuntimeForWork()),
    },
    context,
    ...ifDefined('collections', collections),
  });

  function prepare<
    D extends Declaration<CT>,
    Q extends SqlQueryPlan | Preparable<unknown, unknown>,
    CT extends CodecTypesBase = ExtractCodecTypes<TContract>,
  >(
    declaration: D,
    callback: (params: BindSiteParams<D>) => Q,
  ): Promise<PreparedFrom<ParamsFromDeclaration<D, CT>, Q>> {
    return prepareQuery<D, Q, CT>(getRuntimeForWork(), declaration, callback);
  }

  return {
    orm,

    runtime() {
      return getRuntime();
    },

    prepare,

    transaction<R>(
      fn: (tx: PostgresTransactionContext<TContract, TCollections>) => PromiseLike<R>,
    ): Promise<R> {
      return withTransaction(getRuntimeForWork(), (txCtx) => {
        const txSql: Db<TContract> = sqlBuilder<TContract>({
          context,
          rawCodecInferer,
        });

        const txOrm: OrmClient<TContract, TCollections> = ormBuilder<TContract, TCollections>({
          runtime: {
            query(plan) {
              return txCtx.query(plan);
            },
            execute(plan) {
              return txCtx.execute(plan);
            },
            [activitySource]: delegatingActivitySource(() => txCtx),
          },
          context,
          ...ifDefined('collections', collections),
        });

        // Use `txCtx` as the prototype instead of spreading it so that live
        // accessors (notably the `invalidated` getter, which reads a closure
        // variable in `withTransaction`) remain wired to the original object.
        // Spreading would evaluate the getter once and freeze its value.
        const tx: PostgresTransactionContext<TContract, TCollections> = Object.assign(
          castAs<TransactionContext>(Object.create(txCtx)),
          { sql: txSql, orm: txOrm, enums, nativeEnums },
        );

        return fn(tx);
      });
    },
  };
}
