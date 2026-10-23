import { errorRuntime } from '@internal/errors/execution';
import type {
  ControlDriverConnectOptions,
  ControlDriverDescriptor,
} from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { blindCast } from '@internal/utils/casts';
import { redactDatabaseUrl } from '@internal/utils/redact-db-url';
import { type Connection, type ConnectionOptions, createConnection } from 'mysql2/promise';
import { mysqlConnectionOptions } from '../connection-options';
import { mysqlDriverDescriptorMeta } from '../descriptor-meta';
import { formatMysqlQuery } from '../format-query';
import { connectionLost, isFatal, normalizeMysqlError } from '../normalize-error';
import { serverText } from '../server-text';
import { SESSION_SETUP } from '../session-setup';

/**
 * A MySQL connection for the control plane. It runs each statement through mysql2's text protocol, `query()`, which escapes parameters on the client; `multipleStatements` stays off whatever the URL says, so a parameter can never end the statement it is in.
 */
export class MysqlControlDriver implements SqlControlDriverInstance<'mysql'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'mysql' as const;

  #lost: Error | undefined;

  constructor(private readonly connection: Connection) {
    connection.on('error', (error: Error) => {
      this.#lost = error;
    });
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: Row[] }> {
    if (this.#lost !== undefined) throw connectionLost(this.#lost);
    try {
      const [result] = await this.connection.query({
        sql: formatMysqlQuery(sql, params ?? []),
        typeCast: serverText,
      });
      return {
        rows: Array.isArray(result)
          ? blindCast<Row[], 'mysql2 returns the rows a SELECT produces, shaped by the query'>(
              result,
            )
          : [],
      };
    } catch (error) {
      if (isFatal(error)) {
        this.#lost = error;
        throw connectionLost(error);
      }
      throw normalizeMysqlError(error);
    }
  }

  async databaseName(): Promise<string | undefined> {
    const { rows } = await this.query<{ name: unknown }>('SELECT DATABASE() AS name');
    const name = rows[0]?.name;
    return typeof name === 'string' && name.length > 0 ? name : undefined;
  }

  async close(): Promise<void> {
    await this.connection.end().catch(() => {});
  }
}

async function connect(connectionOptions: ConnectionOptions): Promise<Connection> {
  const connection = await createConnection(connectionOptions);
  try {
    for (const statement of SESSION_SETUP) await connection.query(statement);
    return connection;
  } catch (error) {
    await connection.end().catch(() => {});
    throw error;
  }
}

const mysqlDriverDescriptor: ControlDriverDescriptor<'sql', 'mysql', MysqlControlDriver> = {
  ...mysqlDriverDescriptorMeta,
  async create(url: string, options?: ControlDriverConnectOptions): Promise<MysqlControlDriver> {
    const connectionOptions = mysqlConnectionOptions(url, options?.connectTimeoutMs);
    try {
      return new MysqlControlDriver(await connect(connectionOptions));
    } catch (error) {
      const normalized = normalizeMysqlError(error);
      throw errorRuntime('DRIVER.CONNECTION_FAILED', 'Database connection failed', {
        why: normalized instanceof Error ? normalized.message : String(normalized),
        fix: 'Verify the database URL, ensure the database is reachable, and confirm credentials/permissions',
        meta: { ...redactDatabaseUrl(url) },
        cause: error,
      });
    }
  },
};

export default mysqlDriverDescriptor;
