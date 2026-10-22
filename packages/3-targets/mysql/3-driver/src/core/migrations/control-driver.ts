import { errorRuntime } from '@internal/errors/execution';
import type {
  ControlDriverConnectOptions,
  ControlDriverDescriptor,
} from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { redactDatabaseUrl } from '@internal/utils/redact-db-url';
import { type Connection, createConnection } from 'mysql2/promise';
import { mysqlDriverDescriptorMeta } from '../descriptor-meta';
import { normalizeMysqlError } from '../normalize-error';
import { serverText } from '../server-text';

/**
 * A MySQL connection for the control plane. It runs each statement through mysql2's text protocol, `query()`, which escapes parameters on the client; `multipleStatements` stays off, so a parameter can never end the statement it is in.
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

const mysqlDriverDescriptor: ControlDriverDescriptor<'sql', 'mysql', MysqlControlDriver> = {
  ...mysqlDriverDescriptorMeta,
  async create(url: string, options?: ControlDriverConnectOptions): Promise<MysqlControlDriver> {
    try {
      const connection = await createConnection({
        uri: url,
        multipleStatements: false,
        timezone: 'Z',
        ...ifDefined('connectTimeout', options?.connectTimeoutMs),
      });
      return new MysqlControlDriver(connection);
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
