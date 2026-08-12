import type { SQLInputValue } from 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import { errorRuntime } from '@internal/errors/execution';
import type { ControlDriverDescriptor } from '@internal/framework-components/control';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { normalizeSqliteError } from '../normalize-error';
import { sqliteDriverDescriptorMeta } from './descriptor-meta';

export class SqliteControlDriver implements SqlControlDriverInstance<'sqlite'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'sqlite' as const;

  constructor(private readonly db: DatabaseSync) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ readonly rows: Row[] }> {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...((params ?? []) as SQLInputValue[])) as Row[];
      return { rows };
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

const sqliteDriverDescriptor: ControlDriverDescriptor<'sql', 'sqlite', SqliteControlDriver> = {
  ...sqliteDriverDescriptorMeta,
  async create(pathOrMemory: string): Promise<SqliteControlDriver> {
    try {
      const db = new DatabaseSync(pathOrMemory);
      db.exec('PRAGMA foreign_keys = ON');
      return new SqliteControlDriver(db);
    } catch (error) {
      throw errorRuntime('DRIVER.CONNECTION_FAILED', 'Database connection failed', {
        why: error instanceof Error ? error.message : String(error),
        fix: 'Verify the database file path exists and is accessible',
        meta: {
          path: pathOrMemory,
        },
        cause: error,
      });
    }
  },
};

export default sqliteDriverDescriptor;
