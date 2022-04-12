import { ClientEngineType } from '@prisma/sdk'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

const buildSchema = (engineType?: string) => `
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
  ${engineType ? `engineType="${engineType}"` : ''}
}

// / User model comment
model User {
  id    String  @default(uuid()) @id
  email String  @unique
  // / name comment
  name  String?
  posts Post[]
  profile Profile?
}

model Profile {
  id     String     @default(cuid()) @id
  bio    String?
  user   User    @relation(fields: [userId], references: [id])
  userId String     @unique
}

model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  authorId  String? @map("author")
  author    User?    @relation(fields: [authorId], references: [id])
}
`

function buildQueryTimeoutTest({
  engineType,
  queryTimeout,
  timesOut,
}: {
  engineType: string
  queryTimeout?: number
  timesOut: boolean
}) {
  return async () => {
    const schema = buildSchema(engineType)

    // Setup Project in tmp dir
    const projectDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`)
    fs.copyFileSync(path.join(__dirname, './dev.db'), path.join(projectDir, 'dev.db'))
    fs.writeFileSync(path.join(projectDir, 'schema.prisma'), schema)

    // Set ENV VAR
    process.env.PRISMA_CLIENT_ENGINE_TYPE = engineType

    // Generate Client to tmp dir
    await generateTestClient(projectDir)

    // Run Tests
    const { PrismaClient } = require(path.join(projectDir, 'node_modules/@prisma/client'))
    const prisma = new PrismaClient({
      __internal: {
        engine: {
          queryTimeout,
        },
      },
    })

    if (timesOut) {
      await expect(prisma.user.findMany()).rejects.toBeTruthy()
    } else {
      await expect(prisma.user.findMany()).resolves.toBeTruthy()
    }

    await prisma.$disconnect()
  }
}

describe('queryTimeout', () => {
  const engineTypes = [ClientEngineType.Binary, ClientEngineType.Library]

  for (const engineType of engineTypes) {
    test(
      `engineType=${engineType} setting a short queryTimeout times out`,
      buildQueryTimeoutTest({ engineType, queryTimeout: 30, timesOut: true }),
    )

    test(
      `engineType=${engineType} setting a long queryTimeout does not time out`,
      buildQueryTimeoutTest({ engineType, queryTimeout: 30000, timesOut: false }),
    )

    test(
      `engineType=${engineType} not setting a queryTimeout does not time out`,
      buildQueryTimeoutTest({ engineType, queryTimeout: undefined, timesOut: false }),
    )

    test(
      `engineType=${engineType} setting a 0 queryTimeout times out`,
      buildQueryTimeoutTest({ engineType, queryTimeout: 0, timesOut: true }),
    )

    test(
      `engineType=${engineType} setting a negative queryTimeout times out`,
      buildQueryTimeoutTest({ engineType, queryTimeout: -1, timesOut: true }),
    )
  }
})
