import Database from 'better-sqlite3'
import { Kysely, sql, SqliteDialect } from 'kysely'
import { join } from 'path'

import { importTestClient } from './generate-test-client'

export interface SqliteTestEnvironment {
  kysely: Kysely<any>
  client: any
  cleanup: () => Promise<void>
}

export async function setupSqliteTestDatabase(): Promise<SqliteTestEnvironment> {
  const database = new Database(':memory:')
  const dialect = new SqliteDialect({ database })
  const kysely = new Kysely({ dialect })

  await applySqliteSchema(kysely)

  const schemaPath = join(__dirname, 'test-schema-sqlite.prisma')
  const createOrkClient = await importTestClient({ schemaPath, dialect: 'sqlite' })
  const client = createOrkClient(dialect)

  return {
    kysely,
    client,
    cleanup: async () => {
      await kysely.destroy()
      database.close()
    },
  }
}

async function applySqliteSchema(kysely: Kysely<any>) {
  await sql`
    CREATE TABLE "User" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(kysely)

  await sql`
    CREATE TABLE "Profile" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bio TEXT,
      "userId" INTEGER UNIQUE NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
    )
  `.execute(kysely)

  await sql`
    CREATE TABLE "Post" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      published BOOLEAN NOT NULL DEFAULT 0,
      "authorId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("authorId") REFERENCES "User"(id) ON DELETE CASCADE
    )
  `.execute(kysely)
}
