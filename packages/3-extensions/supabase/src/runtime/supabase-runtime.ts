import type { Contract } from '@internal/contract/types';
import type { ActivityParent, RuntimeExecuteOptions } from '@internal/framework-components/runtime';
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
  ActivitySource,
  ActivitySourceTarget,
  PreparedExecution,
  PreparedExecutionImpl,
  PreparedStatement,
  PreparedStatementImpl,
  RuntimeConnection,
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
  queryWithRole<Row>(
    plan: SqlExecutionPlan<Row> | SqlQueryPlan<Row>,
    binding: SupabaseRoleBinding,
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row>;
  executeWithRole(
    plan: SqlExecutionPlan | SqlQueryPlan,
    binding: SupabaseRoleBinding,
    options?: RuntimeExecuteOptions,
  ): Promise<SqlStatementStats>;
  preparedQueryWithRole<Params, Row>(
    statement: PreparedStatement<Params, Row>,
    params: Params,
    binding: SupabaseRoleBinding,
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row>;
  preparedExecuteWithRole<Params>(
    statement: PreparedExecution<Params>,
    params: Params,
    binding: SupabaseRoleBinding,
    options?: RuntimeExecuteOptions,
  ): Promise<SqlStatementStats>;
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
   * Opens a raw connection and applies role + JWT claims via session-scoped set_config.
   * On bind failure, destroys the connection before rethrowing — no leaked connections.
   * Not on the `SupabaseRuntime` interface; consumed by the facade, not by app code.
   */
  async openRoleSession(binding: SupabaseRoleBinding): Promise<RoleSession> {
    return (await this.openRoleConnection(binding)).session;
  }

  private async openRoleConnection(binding: SupabaseRoleBinding): Promise<{
    readonly conn: SqlConnection;
    readonly session: RoleSession &
      TransactionStartTarget &
      PreparedStatementQueryTarget &
      PreparedStatementExecuteTarget;
  }> {
    const conn = await this.acquireRawConnection();

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

  /** The activity source the facade gives the role-bound ORM: activities whose statements and transaction run on role sessions bound to `binding`, and content hashes at the `'connection'` scope role sessions run at. Not on the `SupabaseRuntime` interface. */
  roleActivitySource(binding: SupabaseRoleBinding): ActivitySource {
    return {
      startActivity: (activity) =>
        this.startActivityOnRoute(this.roleRoute(binding), activity, undefined),
      planContentHash: (plan) => this.planContentHashFor(plan, 'connection', undefined),
    };
  }

  // Each statement of a role-bound activity runs on a role session of its own, as a role-bound query does; its transaction holds one session until it settles.
  private roleRoute(binding: SupabaseRoleBinding): ActivityRoute {
    return {
      scope: 'connection',
      parent: () => undefined,
      runtimeWork: true,
      query: <Row>(plan: SqlOrmPlan<Row>, options: ActivityExecuteOptions) =>
        this.streamOnRoleSession(binding, (session) => session.query<Row>(plan, options)),
      execute: (plan, options) => this.executeWithRole(plan, binding, options),
      preparedQuery: <Params, Row>(
        statement: PreparedStatementImpl<Params, Row>,
        params: Params,
        options: ActivityExecuteOptions,
      ) =>
        this.streamOnRoleSession<Row>(binding, (session) =>
          session[preparedStatementQuery](statement, params, options),
        ),
      preparedExecute: <Params>(
        statement: PreparedExecutionImpl<Params>,
        params: Params,
        options: ActivityExecuteOptions,
      ) =>
        this.executeOnRoleSession(binding, (session) =>
          session[preparedStatementExecute](statement, params, options),
        ),
      transaction: (parent: ActivityParent) => this.beginRoleTransaction(binding, parent),
    };
  }

  private async beginRoleTransaction(
    binding: SupabaseRoleBinding,
    parent: ActivityParent,
  ): Promise<RuntimeTransaction> {
    const { conn, session } = await this.openRoleConnection(binding);
    return this.ownTransaction(session, () => this.beginTransactionOn(conn, session, parent));
  }

  /**
   * Opens a role session, queries the plan, then releases after the stream drains.
   * On mid-stream error, destroys the session instead of releasing.
   */
  queryWithRole<Row>(
    plan: SqlExecutionPlan<Row> | SqlQueryPlan<Row>,
    binding: SupabaseRoleBinding,
    options?: ActivityExecuteOptions,
  ): AsyncIterableResult<Row> {
    return this.streamOnRoleSession(binding, (session) => session.query<Row>(plan, options));
  }

  executeWithRole(
    plan: SqlExecutionPlan | SqlQueryPlan,
    binding: SupabaseRoleBinding,
    options?: ActivityExecuteOptions,
  ): Promise<SqlStatementStats> {
    return this.executeOnRoleSession(binding, (session) => session.execute(plan, options));
  }

  /** Runs a prepared statement on a role session, as a role-bound query runs. */
  preparedQueryWithRole<Params, Row>(
    statement: PreparedStatement<Params, Row>,
    params: Params,
    binding: SupabaseRoleBinding,
    options?: ActivityExecuteOptions,
  ): AsyncIterableResult<Row> {
    return this.streamOnRoleSession<Row>(binding, (session) =>
      session[preparedStatementQuery](statement, params, options),
    );
  }

  /** Runs a prepared statement that reports affected rows on a role session. */
  preparedExecuteWithRole<Params>(
    statement: PreparedExecution<Params>,
    params: Params,
    binding: SupabaseRoleBinding,
    options?: ActivityExecuteOptions,
  ): Promise<SqlStatementStats> {
    return this.executeOnRoleSession(binding, (session) =>
      session[preparedStatementExecute](statement, params, options),
    );
  }

  private streamOnRoleSession<Row>(
    binding: SupabaseRoleBinding,
    rows: (
      session: RoleSession & PreparedStatementQueryTarget & PreparedStatementExecuteTarget,
    ) => AsyncIterable<Row>,
  ): AsyncIterableResult<Row> {
    const self = this;

    const generator = async function* (): AsyncGenerator<Row, void, unknown> {
      const { session } = await self.openRoleConnection(binding);
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
    run: (
      session: RoleSession & PreparedStatementQueryTarget & PreparedStatementExecuteTarget,
    ) => Promise<SqlStatementStats>,
  ): Promise<SqlStatementStats> {
    const { session } = await this.openRoleConnection(binding);
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
