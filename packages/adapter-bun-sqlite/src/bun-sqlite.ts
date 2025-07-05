import type {
  IsolationLevel,
  SqlDriverAdapter,
  SqlMigrationAwareDriverAdapterFactory,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from "@prisma/driver-adapter-utils";
import { Debug, DriverAdapterError } from "@prisma/driver-adapter-utils";
import { Mutex } from "async-mutex";
import { Database } from "bun:sqlite";

import { convertDriverError } from "./errors";
import { getColumnTypes, mapQueryArgs, mapRow, Row } from "./conversion";

const debug = Debug("prisma:driver-adapter:bun-sqlite");
const LOCK_TAG = Symbol();

type BunSQLiteResultSet = {
  declaredTypes: Array<string | null>;
  columnNames: string[];
  values: unknown[][];
};

// SqlQueryable implementation using bun:sqlite
class BunSQLiteQueryable implements SqlQueryable {
  readonly provider = "sqlite";
  readonly adapterName = "bun-sqlite";

  constructor(protected readonly db: Database) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = "[js::queryRaw]";
    debug(`${tag} %O`, query);

    const { columnNames, declaredTypes, values } = await this.performIO(query);
    const rows = values as Array<Row>;

    const columnTypes = getColumnTypes(declaredTypes, rows);

    return {
      columnNames,
      columnTypes,
      rows: rows.map((row) => mapRow(row, columnTypes)),
    };
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    const tag = "[js::executeRaw]";
    debug(`${tag} %O`, query);
    return (await this.executeIO(query)).changes;
  }

  private async executeIO(query: SqlQuery): Promise<{ changes: number }> {
    try {
      const stmt = this.db.query(query.sql);
      const result = stmt.run(...mapQueryArgs(query.args, query.argTypes));
      return Promise.resolve({ changes: result.changes });
    } catch (e) {
      this.onError(e);
    }
  }

  private async performIO(query: SqlQuery): Promise<BunSQLiteResultSet> {
    try {
      const stmt = this.db.query(query.sql);
      const args = mapQueryArgs(query.args, query.argTypes);

      const columns = stmt.columnNames;

      if (columns.length === 0) {
        stmt.run(...args);
        return Promise.resolve({
          columnNames: [],
          declaredTypes: [],
          values: [],
        });
      }

      const resultSet = {
        declaredTypes: columns.map((col: any) => null),
        columnNames: columns,
        values: stmt.values(...args) as unknown[][],
      };

      return Promise.resolve(resultSet);
    } catch (e) {
      this.onError(e);
    }
  }

  protected onError(error: any): never {
    debug("Error in performIO: %O", error);
    throw new DriverAdapterError(convertDriverError(error));
  }
}

// Transaction wrapper
class BunSQLiteTransaction extends BunSQLiteQueryable implements Transaction {
  constructor(
    db: Database,
    readonly options: TransactionOptions,
    readonly unlockParent: () => void,
  ) {
    super(db);
  }

  commit(): Promise<void> {
    debug(`[js::commit]`);
    this.unlockParent();
    return Promise.resolve();
  }

  rollback(): Promise<void> {
    debug(`[js::rollback]`);
    this.unlockParent();
    return Promise.resolve();
  }
}

// Primary adapter
export class PrismaBunSQLiteAdapter
  extends BunSQLiteQueryable
  implements SqlDriverAdapter
{
  [LOCK_TAG] = new Mutex();

  constructor(db: Database) {
    super(db);
  }

  executeScript(script: string): Promise<void> {
    try {
      this.db.exec(script);
    } catch (e) {
      this.onError(e);
    }
    return Promise.resolve();
  }

  async startTransaction(
    isolationLevel?: IsolationLevel,
  ): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== "SERIALIZABLE") {
      throw new DriverAdapterError({
        kind: "InvalidIsolationLevel",
        level: isolationLevel,
      });
    }

    const options: TransactionOptions = { usePhantomQuery: false };
    debug("[js::startTransaction] options: %O", options);

    const release = await this[LOCK_TAG].acquire();
    try {
      this.db.query("BEGIN").run();
      return new BunSQLiteTransaction(this.db, options, release);
    } catch (e) {
      release();
      this.onError(e);
    }
  }

  dispose(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }
}

// Factory for migrations and connections
type BunSQLiteFactoryParams = {
  url: ":memory:" | (string & {});
  shadowDatabaseURL?: ":memory:" | (string & {});
};

export class PrismaBunSQLiteAdapterFactory
  implements SqlMigrationAwareDriverAdapterFactory
{
  readonly provider = "sqlite";
  readonly adapterName = "bun-sqlite";

  constructor(private readonly config: BunSQLiteFactoryParams) {}

  connect(): Promise<SqlDriverAdapter> {
    const url = this.config.url.replace("file:", "").replace("//", "");
    const db = new Database(url);
    return Promise.resolve(new PrismaBunSQLiteAdapter(db));
  }

  connectToShadowDb(): Promise<SqlDriverAdapter> {
    const url = (this.config.shadowDatabaseURL ?? ":memory:")
      .replace("file:", "")
      .replace("//", "");
    const db = new Database(url);
    return Promise.resolve(new PrismaBunSQLiteAdapter(db));
  }
}
