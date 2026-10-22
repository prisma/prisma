import { randomBytes } from 'node:crypto';
import { createConnection } from 'mysql2/promise';

/** A MySQL database created for one test. */
export interface MysqlTestDatabase {
  /** The database's name, unique to this test. */
  readonly name: string;
  /** `MYSQL_URL` with this database as its path. */
  readonly url: string;
}

/** What a vitest test context offers to skip the test. */
interface SkippableTest {
  skip(note?: string): void;
}

/** The URL of the MySQL server tests run against, from `MYSQL_URL`, or `undefined` when it is not set. */
export function mysqlServerUrl(): string | undefined {
  const url = process.env['MYSQL_URL'];
  return url === undefined || url.length === 0 ? undefined : url;
}

function uniqueDatabaseName(): string {
  return `prisma_test_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

/**
 * Runs `fn` with a database of its own on the MySQL server `MYSQL_URL` names, and drops the database afterwards. Skips the test when `MYSQL_URL` is not set. Each call creates a database with a unique name, so tests that share a server, as CI shards do, never see each other's tables.
 */
export async function withMysqlDatabase<T>(
  test: SkippableTest,
  fn: (database: MysqlTestDatabase) => Promise<T>,
): Promise<T | undefined> {
  const serverUrl = mysqlServerUrl();
  if (serverUrl === undefined) {
    test.skip('MYSQL_URL is not set');
    return undefined;
  }
  const name = uniqueDatabaseName();
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const admin = await createConnection({ uri: serverUrl });
  try {
    await admin.query(`CREATE DATABASE \`${name}\``);
    try {
      return await fn({ name, url: url.toString() });
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    }
  } finally {
    await admin.end();
  }
}
