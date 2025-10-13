#!/usr/bin/env tsx

/**
 * Refract Client Demo with Explicit Kysely Dialect
 *
 * Run: pnpm tsx gist.ts
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { PostgresDialect } from 'kysely'
import { Client, Pool } from 'pg'

import { RefractClient } from '../src/index.js'

// Schema content for demo
const schema = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`

async function demo() {
  console.log('🐳 Starting PostgreSQL container...')

  // Start PostgreSQL with TestContainers
  const container = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('refract_demo')
    .withUsername('demo')
    .withPassword('demo123')
    .start()

  const connectionString = container.getConnectionUri()
  console.log('✅ PostgreSQL ready')

  try {
    // Create the User table
    const client = new Client({ connectionString })
    await client.connect()
    await client.query(`
      CREATE TABLE "User" (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.end()
    console.log('📋 Created User table')

    // Initialize Refract client with explicit Kysely dialect and schema
    const dialect = new PostgresDialect({
      pool: new Pool({ connectionString }),
    })

    const refract = new RefractClient(dialect, {
      schema,
      projectRoot: process.cwd(),
    })

    console.log('🚀 Refract client ready with PostgreSQL dialect + parsed schema')

    // Demo operations using Prisma-like API (powered by Kysely under the hood)
    console.log('\n--- Prisma-like CRUD Demo ---')
    console.log(
      '📊 Available models:',
      Object.getOwnPropertyNames(refract).filter((key) => !key.startsWith('$')),
    )

    // Create a user
    const newUser = await refract.user.create({
      data: {
        email: 'alice@example.com',
        name: 'Alice Smith',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    console.log('✨ Created user:', { id: newUser.id, email: newUser.email })

    // Find the user
    const foundUser = await refract.user.findUnique({
      where: { email: 'alice@example.com' },
    })
    console.log('🔍 Found user:', foundUser?.name)

    // List all users
    const allUsers = await refract.user.findMany()
    console.log('👥 Total users:', allUsers.length)

    // Update the user
    const updatedUser = await refract.user.update({
      where: { id: newUser.id },
      data: {
        name: 'Alice Johnson',
        updatedAt: new Date(),
      },
    })
    console.log('📝 Updated name to:', updatedUser.name)

    // Count users
    const userCount = await refract.user.count()
    console.log('📊 User count:', userCount)

    // Advanced: Direct Kysely access still available for complex queries
    console.log('\n--- Advanced Kysely Access ---')
    const complexQuery = await refract.$kysely
      .selectFrom('User')
      .select(['email', 'name'])
      .where('createdAt', '>', new Date(Date.now() - 86400000)) // Last 24 hours
      .execute()

    console.log('🔥 Recent users:', complexQuery.length)

    await refract.$disconnect()
    console.log('✅ Demo completed successfully!')
  } finally {
    await container.stop()
    console.log('🛑 Container stopped')
  }
}

demo().catch(console.error)
