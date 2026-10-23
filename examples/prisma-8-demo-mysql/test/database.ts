import { randomBytes } from 'node:crypto';
import { createConnection } from 'mysql2/promise';

export interface TestDatabase {
  readonly url: string;
  readonly name: string;
  drop(): Promise<void>;
}

/**
 * Creates an empty, uniquely named database on the server at `serverUrl` and
 * returns its connection URL.
 */
export async function createTestDatabase(serverUrl: string): Promise<TestDatabase> {
  const name = `prisma_8_demo_mysql_${randomBytes(6).toString('hex')}`;
  await runOnServer(serverUrl, `CREATE DATABASE \`${name}\``);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    name,
    drop: () => runOnServer(serverUrl, `DROP DATABASE IF EXISTS \`${name}\``),
  };
}

async function runOnServer(serverUrl: string, statement: string): Promise<void> {
  const connection = await createConnection(serverUrl);
  try {
    await connection.query(statement);
  } finally {
    await connection.end();
  }
}
