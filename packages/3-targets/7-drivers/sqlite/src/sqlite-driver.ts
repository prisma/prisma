import type { SQLInputValue } from 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import type { RuntimeDriverInstance } from '@internal/framework-components/execution';
import type {
  PreparedExecuteRequest,
  SqlConnection,
  SqlDriver,
  SqlDriverState,
  SqlExecuteRequest,
  SqlExplainResult,
  SqlQueryResult,
  SqlTransaction,
} from '@internal/sql-relational-core/ast';
import { normalizeSqliteError } from './normalize-error';

export type SqliteBinding = { readonly kind: 'path'; readonly path: string };

export type SqliteRuntimeDriver = RuntimeDriverInstance<'sql', 'sqlite'> & SqlDriver<SqliteBinding>;

interface DriverRuntimeError extends Error {
  readonly code: 'DRIVER.NOT_CONNECTED' | 'DRIVER.ALREADY_CONNECTED';
  readonly category: 'DRIVER';
  readonly severity: 'error';
  readonly details?: Record<string, unknown>;
}

function driverError(
  code: DriverRuntimeError['code'],
  message: string,
  details?: Record<string, unknown>,
): DriverRuntimeError {
  const error = new Error(message) as DriverRuntimeError;
  Object.defineProperty(error, 'name', {
    value: 'RuntimeError',
    configurable: true,
  });
  return Object.assign(error, {
    code,
    category: 'DRIVER' as const,
    severity: 'error' as const,
    message,
    details,
  });
}

const NOT_CONNECTED_MESSAGE =
  'SQLite driver not connected. Call connect(binding) before acquireConnection or execute.';
const ALREADY_CONNECTED_MESSAGE =
  'SQLite driver already connected. Call close() before reconnecting with a new binding.';

function toSqliteParams(params: readonly unknown[] | undefined): SQLInputValue[] {
  return (params ?? []) as SQLInputValue[];
}

function openConnection(path: string): DatabaseSync {
  try {
    const db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    return db;
  } catch (error) {
    throw normalizeSqliteError(error);
  }
}

export class SqliteConnectionImpl implements SqlConnection {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async *execute<Row = Record<string, unknown>>(request: SqlExecuteRequest): AsyncIterable<Row> {
    try {
      const stmt = this.#db.prepare(request.sql);
      for (const row of stmt.iterate(...toSqliteParams(request.params))) {
        yield row as Row;
      }
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  executePrepared<Row = Record<string, unknown>>(
    request: PreparedExecuteRequest,
  ): AsyncIterable<Row> {
    return this.execute<Row>({ sql: request.sql, params: request.params });
  }

  async explain(request: SqlExecuteRequest): Promise<SqlExplainResult> {
    try {
      const stmt = this.#db.prepare(`EXPLAIN QUERY PLAN ${request.sql}`);
      const rows = stmt.all(...toSqliteParams(request.params)) as ReadonlyArray<
        Record<string, unknown>
      >;
      return { rows };
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>> {
    try {
      const stmt = this.#db.prepare(sql);
      const rows = stmt.all(...toSqliteParams(params)) as Row[];
      return { rows };
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async beginTransaction(): Promise<SqlTransaction> {
    try {
      this.#db.exec('BEGIN');
      return new SqliteTransactionImpl(this.#db);
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async release(): Promise<void> {
    // SQLite connections are not pooled — release is equivalent to destroy
    // (close the underlying DatabaseSync handle).
    return this.destroy();
  }

  async destroy(_reason?: unknown): Promise<void> {
    try {
      this.#db.close();
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }
}

class SqliteTransactionImpl implements SqlTransaction {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async *execute<Row = Record<string, unknown>>(request: SqlExecuteRequest): AsyncIterable<Row> {
    try {
      const stmt = this.#db.prepare(request.sql);
      for (const row of stmt.iterate(...toSqliteParams(request.params))) {
        yield row as Row;
      }
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  executePrepared<Row = Record<string, unknown>>(
    request: PreparedExecuteRequest,
  ): AsyncIterable<Row> {
    return this.execute<Row>({ sql: request.sql, params: request.params });
  }

  async explain(request: SqlExecuteRequest): Promise<SqlExplainResult> {
    try {
      const stmt = this.#db.prepare(`EXPLAIN QUERY PLAN ${request.sql}`);
      const rows = stmt.all(...toSqliteParams(request.params)) as ReadonlyArray<
        Record<string, unknown>
      >;
      return { rows };
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>> {
    try {
      const stmt = this.#db.prepare(sql);
      const rows = stmt.all(...toSqliteParams(params)) as Row[];
      return { rows };
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async commit(): Promise<void> {
    try {
      this.#db.exec('COMMIT');
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }

  async rollback(): Promise<void> {
    try {
      this.#db.exec('ROLLBACK');
    } catch (error) {
      throw normalizeSqliteError(error);
    }
  }
}

interface ConnectedState {
  readonly kind: 'connected';
  readonly path: string;
  readonly conn: SqliteConnectionImpl;
}

type DriverState = { readonly kind: 'unbound' } | ConnectedState | { readonly kind: 'closed' };

export class SqliteDriver implements SqliteRuntimeDriver {
  readonly familyId = 'sql' as const;
  readonly targetId = 'sqlite' as const;

  #state: DriverState;

  constructor(initialState?: ConnectedState) {
    this.#state = initialState ?? { kind: 'unbound' };
  }

  #requireConnected(): ConnectedState {
    if (this.#state.kind !== 'connected') {
      throw driverError('DRIVER.NOT_CONNECTED', NOT_CONNECTED_MESSAGE);
    }
    return this.#state;
  }

  get state(): SqlDriverState {
    return this.#state.kind;
  }

  async connect(binding: SqliteBinding): Promise<void> {
    if (this.#state.kind === 'connected') {
      throw driverError('DRIVER.ALREADY_CONNECTED', ALREADY_CONNECTED_MESSAGE, {
        bindingKind: binding.kind,
      });
    }
    this.#state = {
      kind: 'connected',
      path: binding.path,
      conn: new SqliteConnectionImpl(openConnection(binding.path)),
    };
  }

  async acquireConnection(): Promise<SqliteConnectionImpl> {
    const { path } = this.#requireConnected();
    return new SqliteConnectionImpl(openConnection(path));
  }

  async close(): Promise<void> {
    if (this.#state.kind !== 'connected') return;
    const { conn } = this.#state;
    this.#state = { kind: 'closed' };
    await conn.release();
  }

  execute<Row = Record<string, unknown>>(request: SqlExecuteRequest): AsyncIterable<Row> {
    if (this.#state.kind !== 'connected') {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw driverError('DRIVER.NOT_CONNECTED', NOT_CONNECTED_MESSAGE);
            },
          };
        },
      };
    }
    return this.#state.conn.execute<Row>(request);
  }

  executePrepared<Row = Record<string, unknown>>(
    request: PreparedExecuteRequest,
  ): AsyncIterable<Row> {
    if (this.#state.kind !== 'connected') {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw driverError('DRIVER.NOT_CONNECTED', NOT_CONNECTED_MESSAGE);
            },
          };
        },
      };
    }
    return this.#state.conn.executePrepared<Row>(request);
  }

  async explain(request: SqlExecuteRequest): Promise<SqlExplainResult> {
    return this.#requireConnected().conn.explain(request);
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>> {
    return this.#requireConnected().conn.query<Row>(sql, params);
  }
}

export function createBoundDriverFromBinding(binding: SqliteBinding): SqliteDriver {
  return new SqliteDriver({
    kind: 'connected',
    path: binding.path,
    conn: new SqliteConnectionImpl(openConnection(binding.path)),
  });
}
