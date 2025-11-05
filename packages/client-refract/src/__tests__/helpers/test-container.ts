import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { importTestClient } from './generate-test-client'

export interface TestEnvironment {
  kysely: Kysely<any>
  client: any // The generated Refract client
  container: StartedPostgreSqlContainer
  cleanup: () => Promise<void>
}

/**
 * Set up a PostgreSQL testcontainer with the test schema
 */
export async function setupTestDatabase(): Promise<TestEnvironment> {
  // Start PostgreSQL container
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('refract_test')
    .withUsername('test')
    .withPassword('test')
    .start()

  const pool = new Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
  })

  const dialect = new PostgresDialect({ pool })
  const kysely = new Kysely({
    dialect,
  })

  // Apply test schema
  await applyTestSchema(kysely)

  // Generate and import test client
  const createRefractClient = await importTestClient()
  const client = createRefractClient(dialect)

  return {
    kysely,
    client,
    container,
    cleanup: async () => {
      await kysely.destroy()
      await container.stop()
    },
  }
}

/**
 * Apply the test database schema
 * This matches the schema in examples/basic/schema.prisma
 */
async function applyTestSchema(kysely: Kysely<any>) {
  // Create User table
  await sql`
    CREATE TABLE "User" (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `.execute(kysely)

  // Create Profile table
  await sql`
    CREATE TABLE "Profile" (
      id SERIAL PRIMARY KEY,
      bio TEXT,
      "userId" INTEGER UNIQUE NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
    )
  `.execute(kysely)

  // Create Post table
  await sql`
    CREATE TABLE "Post" (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      published BOOLEAN NOT NULL DEFAULT false,
      "authorId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY ("authorId") REFERENCES "User"(id) ON DELETE CASCADE
    )
  `.execute(kysely)
}
