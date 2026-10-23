import { errorRuntime } from '@internal/errors/execution';
import type { RuntimeDriverInstance } from '@internal/framework-components/execution';
import type {
  SqlConnection,
  SqlDriver,
  SqlDriverState,
  SqlExecuteRequest,
  SqlQueryable,
  SqlStatementStats,
  SqlTransaction,
} from '@internal/sql-relational-core/ast';
import { blindCast } from '@internal/utils/casts';
import { createPool, type Pool, type PoolConnection, type ResultSetHeader } from 'mysql2';
import { mysqlConnectionOptions } from '../connection-options';
import { formatMysqlQuery } from '../format-query';
import { isFatal, normalizeMysqlError } from '../normalize-error';
import { serverText } from '../server-text';
import { SESSION_SETUP } from '../session-setup';

/** Where the runtime driver connects: a `mysql://` URL. */
export type MysqlBinding = { readonly kind: 'url'; readonly url: string };

export type MysqlRuntimeDriver = RuntimeDriverInstance<'sql', 'mysql'> & SqlDriver<MysqlBinding>;

function notConnected(message: string) {
  return errorRuntime('DRIVER.NOT_CONNECTED', message, {
    fix: 'Call connect(binding) before running queries, and do not use the driver after close().',
  });
}

function formatted(request: SqlExecuteRequest): string {
  return formatMysqlQuery(request.sql, request.params ?? []);
}

function run(connection: PoolConnection, request: SqlExecuteRequest): Promise<unknown> {
  const sql = formatted(request);
  return new Promise((resolve, reject) => {
    connection.query({ sql, typeCast: serverText }, (error, result) =>
      error ? reject(error) : resolve(result),
    );
  });
}

function isResultSetHeader(result: unknown): result is ResultSetHeader {
  return typeof result === 'object' && result !== null && 'affectedRows' in result;
}

/** Counts what the driver has handed out, a connection or a stream, so `close()` can wait until every one is back. */
class Leases {
  #count = 0;
  #idle: (() => void)[] = [];

  take(): () => void {
    this.#count += 1;
    let returned = false;
    return () => {
      if (returned) return;
      returned = true;
      this.#count -= 1;
      if (this.#count === 0) for (const resolve of this.#idle.splice(0)) resolve();
    };
  }

  idle(): Promise<void> {
    return this.#count === 0
      ? Promise.resolve()
      : new Promise((resolve) => this.#idle.push(resolve));
  }
}

/** A pooled connection lent to one caller. `done` gives it back to the pool, or evicts it when it may be in an unknown state. */
interface Lent {
  readonly connection: PoolConnection;
  done(evict: boolean): void;
}

/**
 * Streams the rows of `request` on `connection` as the text MySQL sends. A caller that stops reading early leaves the rest of the result unread; the connection reads and drops it before the stream finishes, so the connection stays usable.
 */
async function* streamRows<Row>(
  connection: PoolConnection,
  request: SqlExecuteRequest,
): AsyncGenerator<Row> {
  const command = connection.query({ sql: formatted(request), typeCast: serverText });
  const finished = new Promise<void>((resolve) => command.once('end', () => resolve()));
  const stream = command.stream();
  let completed = false;
  let failed = false;
  try {
    for await (const row of stream) {
      yield blindCast<Row, 'mysql2 streams the rows the statement produces, shaped by the query'>(
        row,
      );
    }
    completed = true;
  } catch (error) {
    failed = true;
    throw normalizeMysqlError(error);
  } finally {
    if (!completed && !failed) connection.resume();
    if (!failed) await finished;
  }
}

abstract class MysqlQueryable implements SqlQueryable {
  protected abstract lend(): Promise<Lent>;

  async *query<Row = Record<string, unknown>>(request: SqlExecuteRequest): AsyncIterable<Row> {
    const lent = await this.lend();
    let evict = false;
    try {
      yield* streamRows<Row>(lent.connection, request);
    } catch (error) {
      evict = isFatal(error);
      throw error;
    } finally {
      lent.done(evict);
    }
  }

  async execute(request: SqlExecuteRequest): Promise<SqlStatementStats> {
    const lent = await this.lend();
    let evict = false;
    try {
      const result = await run(lent.connection, request);
      return { affectedRows: isResultSetHeader(result) ? result.affectedRows : 0 };
    } catch (error) {
      evict = isFatal(error);
      throw normalizeMysqlError(error);
    } finally {
      lent.done(evict);
    }
  }
}

/** A connection held by one caller, whose statements all run on the same session. */
class MysqlConnectionImpl extends MysqlQueryable implements SqlConnection {
  readonly #connection: PoolConnection;
  readonly #giveBack: () => void;

  constructor(connection: PoolConnection, giveBack: () => void) {
    super();
    this.#connection = connection;
    this.#giveBack = giveBack;
  }

  protected async lend(): Promise<Lent> {
    return { connection: this.#connection, done: () => {} };
  }

  async beginTransaction(): Promise<SqlTransaction> {
    await this.execute({ sql: 'START TRANSACTION' });
    return new MysqlTransactionImpl(this.#connection);
  }

  async release(): Promise<void> {
    this.#connection.release();
    this.#giveBack();
  }

  async destroy(_reason?: unknown): Promise<void> {
    this.#connection.destroy();
    this.#giveBack();
  }
}

class MysqlTransactionImpl extends MysqlQueryable implements SqlTransaction {
  readonly #connection: PoolConnection;

  constructor(connection: PoolConnection) {
    super();
    this.#connection = connection;
  }

  protected async lend(): Promise<Lent> {
    return { connection: this.#connection, done: () => {} };
  }

  async commit(): Promise<void> {
    await this.execute({ sql: 'COMMIT' });
  }

  async rollback(): Promise<void> {
    await this.execute({ sql: 'ROLLBACK' });
  }
}

type DriverState =
  | { readonly kind: 'unbound' }
  | { readonly kind: 'connected'; readonly pool: Pool }
  | { readonly kind: 'closed' };

/**
 * The MySQL runtime driver: a mysql2 pool, queried through the text protocol so every value reaches its codec as the text MySQL sends (ADR 155). Each physical connection runs the session setup once, before its first statement. `close()` waits for every connection and stream it has handed out before it ends the pool.
 */
export class MysqlDriver extends MysqlQueryable implements MysqlRuntimeDriver {
  readonly familyId = 'sql' as const;
  readonly targetId = 'mysql' as const;

  #state: DriverState = { kind: 'unbound' };
  readonly #leases = new Leases();
  readonly #setUp = new WeakSet<PoolConnection>();

  get state(): SqlDriverState {
    return this.#state.kind;
  }

  async connect(binding: MysqlBinding): Promise<void> {
    if (this.#state.kind === 'connected') {
      throw errorRuntime('DRIVER.ALREADY_CONNECTED', 'MySQL driver already connected', {
        fix: 'Call close() before connecting again.',
      });
    }
    this.#state = { kind: 'connected', pool: createPool(mysqlConnectionOptions(binding.url)) };
  }

  async acquireConnection(): Promise<SqlConnection> {
    const giveBack = this.#leases.take();
    try {
      return new MysqlConnectionImpl(await this.#acquire(), giveBack);
    } catch (error) {
      giveBack();
      throw error;
    }
  }

  protected async lend(): Promise<Lent> {
    const giveBack = this.#leases.take();
    try {
      const connection = await this.#acquire();
      return {
        connection,
        done: (evict) => {
          if (evict) connection.destroy();
          else connection.release();
          giveBack();
        },
      };
    } catch (error) {
      giveBack();
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.#state.kind !== 'connected') return;
    const { pool } = this.#state;
    this.#state = { kind: 'closed' };
    await this.#leases.idle();
    await new Promise<void>((resolve) => pool.end(() => resolve()));
  }

  async #acquire(): Promise<PoolConnection> {
    if (this.#state.kind !== 'connected') {
      throw notConnected(
        this.#state.kind === 'closed' ? 'MySQL driver is closed' : 'MySQL driver not connected',
      );
    }
    const { pool } = this.#state;
    const connection = await new Promise<PoolConnection>((resolve, reject) =>
      pool.getConnection((error, acquired) => (error ? reject(error) : resolve(acquired))),
    ).catch((error: unknown) => {
      throw normalizeMysqlError(error);
    });
    if (this.#setUp.has(connection)) return connection;
    try {
      for (const sql of SESSION_SETUP) await run(connection, { sql });
    } catch (error) {
      connection.destroy();
      throw normalizeMysqlError(error);
    }
    this.#setUp.add(connection);
    return connection;
  }
}
