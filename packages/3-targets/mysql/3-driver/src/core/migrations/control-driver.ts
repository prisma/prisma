import { errorRuntime } from '@internal/errors/execution';
import type {
  ControlDriverConnectOptions,
  ControlDriverDescriptor,
} from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { blindCast } from '@internal/utils/casts';
import { redactDatabaseUrl } from '@internal/utils/redact-db-url';
import { type Connection, createConnection } from 'mysql2/promise';
import { mysqlConnectionOptions } from '../connection-options';
import { mysqlDriverDescriptorMeta } from '../descriptor-meta';
import { normalizeMysqlError } from '../normalize-error';
import { serverText } from '../server-text';

/**
 * A MySQL connection for the control plane. It runs each statement through mysql2's text protocol, `query()`, which escapes parameters on the client; `multipleStatements` stays off whatever the URL says, so a parameter can never end the statement it is in.
 */
export class MysqlControlDriver implements SqlControlDriverInstance<'mysql'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'mysql' as const;

  constructor(private readonly connection: Connection) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: Row[] }> {
    try {
      const [result] = await this.connection.query({
        sql,
        values: params === undefined ? [] : [...params],
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

/** The statements every new connection runs before any other. mysql2 escapes a quote in a parameter with a backslash, which MySQL reads as text under NO_BACKSLASH_ESCAPES, so the session clears that mode. The session runs in UTC, so `CURRENT_TIMESTAMP` writes the UTC time the codecs read. */
const SESSION_SETUP = [
  "SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', @@SESSION.sql_mode, ','), ',NO_BACKSLASH_ESCAPES,', ','))",
  "SET SESSION time_zone = '+00:00'",
] as const;

async function connect(url: string, options?: ControlDriverConnectOptions): Promise<Connection> {
  const connection = await createConnection(mysqlConnectionOptions(url, options?.connectTimeoutMs));
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
    try {
      return new MysqlControlDriver(await connect(url, options));
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
