import { type ServerOptions, startPrismaDevServer } from '@prisma/dev';
import { Client } from 'pg';

export * from '../application-domain-of';
export * from '../column-descriptors';
export * from '../contract-factories';
export * from '../lowered-params';
export * from '../operation-descriptors';
export * from '../timeouts';

function normalizeConnectionString(raw: string): string {
  const url = new URL(raw);
  if (url.hostname === 'localhost' || url.hostname === '::1') {
    url.hostname = '127.0.0.1';
  }
  return url.toString();
}

export interface DevDatabase {
  readonly connectionString: string;
  close(): Promise<void>;
}

/**
 * Creates a dev database instance for testing.
 * Automatically handles connection string normalization and cleanup.
 * @prisma/dev automatically assigns ports to avoid conflicts and enforces a single
 * active connection (second connections are rejected until the first is closed).
 */
export async function createDevDatabase(options?: ServerOptions): Promise<DevDatabase> {
  const server = await startPrismaDevServer({
    databaseConnectTimeoutMillis: 1000,
    databaseIdleTimeoutMillis: 1000,
    ...options,
  });
  return {
    ...server,
    connectionString: normalizeConnectionString(server.database.connectionString),
  };
}

/**
 * Executes a function with a dev database, automatically cleaning up afterward.
 * @prisma/dev automatically assigns ports and will reject any attempt to open a
 * second connection while the first is active, so ensure each helper call closes
 * before starting another.
 */
export async function withDevDatabase<T>(
  fn: (ctx: DevDatabase) => Promise<T>,
  options?: ServerOptions,
): Promise<T> {
  const database = await createDevDatabase(options);
  try {
    return await fn(database);
  } finally {
    await database.close();
  }
}

/**
 * Executes a function with a database client, automatically cleaning up afterward.
 */
export async function withClient<T>(
  connectionString: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  // A PGlite (WASM) dev server can abort mid-operation on the slower CI runners
  // (the same crash the suites' `retry` config re-runs). When it does, this
  // client's connection drops and `pg` emits an asynchronous 'error' event.
  // With no listener that becomes an *unhandled* error, which fails the whole
  // run even though the awaited query already rejected and the test is retried
  // on a fresh database. Absorb the connection-level event — query/connect
  // failures still reject their own promises, so nothing real is masked.
  client.on('error', () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    // On a dropped connection `end()` itself can reject; the caller already has
    // the real failure from `fn`, so don't let cleanup mask or replace it.
    await client.end().catch(() => {});
  }
}

/**
 * Drains an async iterable, consuming all values without collecting them.
 * Useful for testing side effects without memory overhead.
 */
export async function drainAsyncIterable<T>(iterable: AsyncIterable<T>): Promise<void> {
  for await (const _ of iterable) {
    // exhaust iterator
  }
}

/**
 * Collects all values from an async iterable into an array.
 * Useful for testing query results.
 */
export async function collectAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) {
    out.push(item);
  }
  return out;
}

/**
 * Tears down test database by dropping schema and tables.
 * This helper DRYs up the common pattern of database teardown in tests.
 */
export async function teardownTestDatabase(client: Client, tables?: string[]): Promise<void> {
  if (tables && tables.length > 0) {
    for (const table of tables) {
      await client.query(`drop table if exists "${table}"`);
    }
  }
  await client.query('drop schema if exists prisma_contract cascade');
}
