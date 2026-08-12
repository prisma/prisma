import type { Contract } from '@internal/contract/types';
import type { RuntimeExecuteOptions } from '@internal/framework-components/runtime';
import { AsyncIterableResult } from '@internal/framework-components/runtime';
import { type PostgresRuntime, PostgresRuntimeImpl } from '@internal/postgres/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type {
  PreparedStatement,
  PreparedStatementImpl,
  RuntimeConnection,
  RuntimeTransaction,
} from '@internal/sql-runtime';
import { blindCast } from '@internal/utils/casts';
import type { SupabaseRole } from '../contract/roles';

export interface SupabaseRuntime extends PostgresRuntime {}

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

    const session: RoleSession = {
      execute<Row>(
        plan: (SqlExecutionPlan<unknown> | SqlQueryPlan<unknown>) & { readonly _row?: Row },
        options?: RuntimeExecuteOptions,
      ): AsyncIterableResult<Row> {
        return self.executeAgainstQueryable<Row>(plan, conn, { ...options, scope: 'connection' });
      },

      executePrepared<Params, Row>(
        ps: PreparedStatement<Params, Row>,
        params: Params,
        options?: RuntimeExecuteOptions,
      ): AsyncIterableResult<Row> {
        return self.executePreparedAgainstQueryable(
          blindCast<
            PreparedStatementImpl<Params, Row>,
            'PreparedStatement is PreparedStatementImpl; the impl class is the only concrete form'
          >(ps),
          blindCast<
            Record<string, unknown>,
            'params are structurally Record<string, unknown> at runtime'
          >(params),
          conn,
          { ...options, scope: 'connection' },
        );
      },

      async transaction(): Promise<RuntimeTransaction> {
        const tx = await conn.beginTransaction();
        return {
          async commit(): Promise<void> {
            await tx.commit();
          },
          async rollback(): Promise<void> {
            await tx.rollback();
          },
          execute<Row>(
            plan: (SqlExecutionPlan<unknown> | SqlQueryPlan<unknown>) & { readonly _row?: Row },
            options?: RuntimeExecuteOptions,
          ): AsyncIterableResult<Row> {
            return self.executeAgainstQueryable<Row>(plan, tx, {
              ...options,
              scope: 'transaction',
            });
          },
          executePrepared<Params, Row>(
            ps: PreparedStatement<Params, Row>,
            params: Params,
            options?: RuntimeExecuteOptions,
          ): AsyncIterableResult<Row> {
            return self.executePreparedAgainstQueryable(
              blindCast<
                PreparedStatementImpl<Params, Row>,
                'PreparedStatement is PreparedStatementImpl; the impl class is the only concrete form'
              >(ps),
              blindCast<
                Record<string, unknown>,
                'params are structurally Record<string, unknown> at runtime'
              >(params),
              tx,
              { ...options, scope: 'transaction' },
            );
          },
        };
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

    return session;
  }

  /**
   * Opens a role session, executes the plan, then releases after the stream drains.
   * On mid-stream error, destroys the session instead of releasing.
   */
  executeWithRole<Row>(
    plan: SqlExecutionPlan<Row> | SqlQueryPlan<Row>,
    binding: SupabaseRoleBinding,
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row> {
    const self = this;

    const generator = async function* (): AsyncGenerator<Row, void, unknown> {
      const session = await self.openRoleSession(binding);
      let errored = false;
      try {
        for await (const row of session.execute(plan, options)) {
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
}
