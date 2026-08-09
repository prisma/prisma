import { errorRuntime } from '@internal/errors/execution';
import type { ControlDriverDescriptor } from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { SqlQueryError } from '@internal/sql-errors';
import { ifDefined } from '@internal/utils/defined';
import { redactDatabaseUrl } from '@internal/utils/redact-db-url';
import { Client } from 'pg';
import { postgresDriverDescriptorMeta } from '../core/descriptor-meta';
import { normalizePgError } from '../normalize-error';

export class PostgresControlDriver implements SqlControlDriverInstance<'postgres'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'postgres' as const;

  constructor(private readonly client: Client) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: Row[] }> {
    try {
      const result = await this.client.query(sql, params as unknown[] | undefined);
      return { rows: result.rows as Row[] };
    } catch (error) {
      throw normalizePgError(error);
    }
  }

  async close(): Promise<void> {
    // On a dropped connection end() itself can reject; the caller already has
    // the real failure.
    await this.client.end().catch(() => {});
  }
}

/**
 * Postgres driver descriptor for CLI config.
 */
const postgresDriverDescriptor: ControlDriverDescriptor<'sql', 'postgres', PostgresControlDriver> =
  {
    ...postgresDriverDescriptorMeta,
    async create(url: string): Promise<PostgresControlDriver> {
      const client = new Client({ connectionString: url });
      // Connection-level events become unhandled errors with no listener;
      // query/connect failures still reject their own promises, so nothing
      // real is masked.
      client.on('error', () => {});
      try {
        await client.connect();
        return new PostgresControlDriver(client);
      } catch (error) {
        const normalized = normalizePgError(error);
        const redacted = redactDatabaseUrl(url);
        try {
          await client.end();
        } catch {
          // ignore
        }

        const codeFromSqlState = SqlQueryError.is(normalized) ? normalized.sqlState : undefined;
        const causeCode =
          'cause' in normalized && normalized.cause
            ? (normalized.cause as { code?: unknown }).code
            : undefined;
        const sqlState = codeFromSqlState ?? causeCode;

        throw errorRuntime('DRIVER.CONNECTION_FAILED', 'Database connection failed', {
          why: normalized.message,
          fix: 'Verify the database URL, ensure the database is reachable, and confirm credentials/permissions',
          meta: {
            ...ifDefined('sqlState', sqlState),
            ...redacted,
          },
          cause: error,
        });
      }
    },
  };

export default postgresDriverDescriptor;
