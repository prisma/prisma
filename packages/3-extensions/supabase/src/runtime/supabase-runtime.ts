import type { Contract } from '@internal/contract/types';
import type { ActivityParent } from '@internal/framework-components/runtime';
import { AsyncIterableResult } from '@internal/framework-components/runtime';
import { type PostgresRuntime, PostgresRuntimeImpl } from '@internal/postgres/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import type {
  SqlConnection,
  SqlQueryable,
  SqlStatementStats,
} from '@internal/sql-relational-core/ast';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { SqlOrmPlan } from '@internal/sql-relational-core/types';
import type {
  ActivityExecuteOptions,
  ActivityRoute,
  ActivitySourceTarget,
  PreparedExecution,
  PreparedExecutionImpl,
  PreparedStatement,
  PreparedStatementImpl,
  RuntimeConnection,
  RuntimeQueryable,
  RuntimeTransaction,
} from '@internal/sql-runtime';
import { activitySource } from '@internal/sql-runtime';
import type {
  PreparedStatementExecuteTarget,
  PreparedStatementQueryTarget,
  TransactionStartTarget,
} from '@internal/sql-runtime/internal/prepared-query';
import {
  createTransactionStart,
  preparedStatementExecute,
  preparedStatementQuery,
  transactionStart,
} from '@internal/sql-runtime/internal/prepared-query';
import { blindCast } from '@internal/utils/casts';
import type { SupabaseRole } from '../contract/roles';

export interface SupabaseRuntime extends PostgresRuntime {
  /** The runtime operations under `binding`: each statement runs on a session bound to the role, and a transaction holds one session until it settles. */
  forRole(binding: SupabaseRoleBinding): SupabaseRoleRuntime;
}

/** The operations of a Supabase runtime under one role. */
export interface SupabaseRoleRuntime
  extends RuntimeQueryable,
    PreparedStatementQueryTarget,
    PreparedStatementExecuteTarget {
  /** Opens a session bound to the role; the caller releases it. */
  connection(): Promise<RoleSession>;
  /** Begins a transaction on a session bound to the role, released when the transaction settles. */
  transaction(): Promise<RuntimeTransaction>;
}

export interface SupabaseRoleBinding {
  readonly role: SupabaseRole;
  readonly claims?: Record<string, unknown>;
}

/**
 * A connection with a Supabase role already bound via session-scoped set_config.
 * Implements `RuntimeConnection` so it plugs into ORM scope machinery and `withTransaction`.
 */
export interface RoleSession extends RuntimeConnection {}

export class SupabaseRuntimeImpl<
  TContract extends Contract<SqlStorage> = Contract<SqlStorage>,
> extends PostgresRuntimeImpl<TContract> {
  /**
   * Opens a raw connection and applies role + JWT claims via session-scoped set_config. On bind failure, destroys the connection before rethrowing — no leaked connections. Every operation of `forRole(binding)` runs on a session opened here.
   */
  async openRoleSession(binding: SupabaseRoleBinding): Promise<RoleSession> {
    return (await this.openRoleConnection(binding)).session;
  }

  private async openRoleConnection(
    binding: SupabaseRoleBinding,
    options?: Pick<ActivityExecuteOptions, 'activityParent'>,
  ): Promise<{
    readonly conn: SqlConnection;
    readonly session: RoleSession &
      TransactionStartTarget &
      PreparedStatementQueryTarget &
      PreparedStatementExecuteTarget;
  }> {
    const conn = await this.acquireRawConnection(options);

    try {
      await conn.execute({
        sql: 'SELECT set_config($1, $2, false)',
        params: ['role', binding.role],
      });
      await conn.execute({
        sql: 'SELECT set_config($1, $2, false)',
        params: ['request.jwt.claims', JSON.stringify(binding.claims ?? {})],
      });
    } catch (err) {
      await conn.destroy(err).catch(() => undefined);
      throw err;
    }

    const self = this;

    const session: RoleSession &
      TransactionStartTarget &
      ActivitySourceTarget &
      PreparedStatementQueryTarget &
      PreparedStatementExecuteTarget = {
      [transactionStart]: createTransactionStart(),
      [activitySource]: self.connectionActivitySource(conn, () => session),
      query<Row>(
        plan: (SqlExecutionPlan<unknown> | SqlQueryPlan<unknown>) & { readonly _row?: Row },
        options?: ActivityExecuteOptions,
      ): AsyncIterableResult<Row> {
        return self.queryAgainstQueryable<Row>(plan, conn, { ...options, scope: 'connection' });
      },
      execute(
        plan: SqlExecutionPlan<unknown> | SqlQueryPlan<unknown>,
        options?: ActivityExecuteOptions,
      ): Promise<SqlStatementStats> {
        return self.executeStatisticsAgainstQueryable(plan, conn, {
          ...options,
          scope: 'connection',
        });
      },
      [preparedStatementQuery]<Params, Row>(
        prepared: PreparedStatement<Params, Row>,
        params: Params,
        options?: ActivityExecuteOptions,
      ): AsyncIterableResult<Row> {
        return self.runPreparedQueryAgainstRoleQueryable(prepared, params, conn, options);
      },
      [preparedStatementExecute]<Params>(
        prepared: PreparedExecution<Params>,
        params: Params,
        options?: ActivityExecuteOptions,
      ): Promise<SqlStatementStats> {
        return self.runPreparedExecuteAgainstRoleQueryable(prepared, params, conn, options);
      },

      async transaction(): Promise<RuntimeTransaction> {
        return self.beginTransactionOn(conn, session, undefined);
      },

      /**
       * Resets all session-local config then releases the connection back to the pool.
       * If RESET ALL fails, destroys the connection instead — pool-poisoning guarantee.
       */
      async release(): Promise<void> {
        try {
          await conn.execute({ sql: 'RESET ALL' });
          await conn.release();
        } catch (resetError) {
          await conn.destroy(resetError).catch(() => undefined);
        }
      },

      async destroy(reason?: unknown): Promise<void> {
        await conn.destroy(reason);
      },
    };

    return { conn, session };
  }

  forRole(binding: SupabaseRoleBinding): SupabaseRoleRuntime & ActivitySourceTarget {
    const self = this;
    const role: SupabaseRoleRuntime & ActivitySourceTarget = {
      query<Row>(
        plan: SqlOrmPlan<Row>,
        options?: ActivityExecuteOptions,
      ): AsyncIterableResult<Row> {
        return self.streamOnRoleSession(binding, options, (session) =>
          session.query<Row>(plan, options),
        );
      },
      execute(plan: SqlOrmPlan, options?: ActivityExecuteOptions): Promise<SqlStatementStats> {
        return self.executeOnRoleSession(binding, options, (session) =>
          session.execute(plan, options),
        );
      },
      [preparedStatementQuery]<Params, Row>(
        statement: PreparedStatement<Params, Row>,
        params: Params,
        options?: ActivityExecuteOptions,
      ): AsyncIterableResult<Row> {
        return self.streamOnRoleSession<Row>(binding, options, (session) =>
          session[preparedStatementQuery](statement, params, options),
        );
      },
      [preparedStatementExecute]<Params>(
        statement: PreparedExecution<Params>,
        params: Params,
        options?: ActivityExecuteOptions,
      ): Promise<SqlStatementStats> {
        return self.executeOnRoleSession(binding, options, (session) =>
          session[preparedStatementExecute](statement, params, options),
        );
      },
      connection: () => self.openRoleSession(binding),
      transaction: () => self.beginRoleTransaction(binding, undefined),
      [activitySource]: {
        startActivity: (activity) => self.startActivityOnRoute(route, activity, undefined),
        planContentHash: (plan) => self.planContentHashFor(plan, 'connection', undefined),
      },
    };
    // Each statement of a role-bound activity runs on a role session of its own, as a role-bound query does; its transaction holds one session until it settles.
    const route: ActivityRoute = {
      scope: 'connection',
      parent: () => undefined,
      runtimeWork: true,
      query: (plan, options) => role.query(plan, options),
      execute: (plan, options) => role.execute(plan, options),
      preparedQuery: (statement, params, options) =>
        role[preparedStatementQuery](statement, params, options),
      preparedExecute: (statement, params, options) =>
        role[preparedStatementExecute](statement, params, options),
      transaction: (parent) => self.beginRoleTransaction(binding, parent),
    };
    return role;
  }

  private async beginRoleTransaction(
    binding: SupabaseRoleBinding,
    parent: ActivityParent | undefined,
  ): Promise<RuntimeTransaction> {
    const { conn, session } = await this.openRoleConnection(binding, { activityParent: parent });
    return this.ownTransaction(session, () => this.beginTransactionOn(conn, session, parent));
  }

  private streamOnRoleSession<Row>(
    binding: SupabaseRoleBinding,
    options: ActivityExecuteOptions | undefined,
    rows: (
      session: RoleSession & PreparedStatementQueryTarget & PreparedStatementExecuteTarget,
    ) => AsyncIterable<Row>,
  ): AsyncIterableResult<Row> {
    const self = this;

    const generator = async function* (): AsyncGenerator<Row, void, unknown> {
      const { session } = await self.openRoleConnection(binding, options);
      let errored = false;
      try {
        for await (const row of rows(session)) {
          yield row;
        }
      } catch (err) {
        errored = true;
        await session.destroy(err).catch(() => undefined);
        throw err;
      } finally {
        if (!errored) {
          await session.release();
        }
      }
    };

    return new AsyncIterableResult(generator());
  }

  private async executeOnRoleSession(
    binding: SupabaseRoleBinding,
    options: ActivityExecuteOptions | undefined,
    run: (
      session: RoleSession & PreparedStatementQueryTarget & PreparedStatementExecuteTarget,
    ) => Promise<SqlStatementStats>,
  ): Promise<SqlStatementStats> {
    const { session } = await this.openRoleConnection(binding, options);
    try {
      const stats = await run(session);
      await session.release();
      return stats;
    } catch (err) {
      await session.destroy(err).catch(() => undefined);
      throw err;
    }
  }

  private runPreparedExecuteAgainstRoleQueryable<Params>(
    prepared: PreparedExecution<Params>,
    params: Params,
    queryable: SqlQueryable,
    options: ActivityExecuteOptions | undefined,
  ): Promise<SqlStatementStats> {
    return this.runPreparedExecuteAgainstQueryable<Params>(
      blindCast<
        PreparedExecutionImpl<Params>,
        'SQL runtime prepare returns PreparedExecutionImpl instances for statistics plans'
      >(prepared),
      blindCast<Record<string, unknown>, 'Prepared params follow their declared record shape'>(
        params,
      ),
      queryable,
      { ...options, scope: 'connection' },
    );
  }

  private runPreparedQueryAgainstRoleQueryable<Params, Row>(
    prepared: PreparedStatement<Params, Row>,
    params: Params,
    queryable: SqlQueryable,
    options: ActivityExecuteOptions | undefined,
  ): AsyncIterableResult<Row> {
    return this.runPreparedQueryAgainstQueryable<Params, Row>(
      blindCast<
        PreparedStatementImpl<Params, Row>,
        'SQL runtime prepare returns PreparedStatementImpl instances'
      >(prepared),
      blindCast<Record<string, unknown>, 'Prepared params follow their declared record shape'>(
        params,
      ),
      queryable,
      { ...options, scope: 'connection' },
    );
  }
}
