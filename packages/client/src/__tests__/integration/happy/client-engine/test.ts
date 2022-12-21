import { ClientEngineType, DEFAULT_CLIENT_ENGINE_TYPE } from '@prisma/internals'
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
function getExpectedEngine(engineType, envVar, envVarValue) {
  if (envVar === 'PRISMA_CLIENT_ENGINE_TYPE' && envVarValue) {
    return envVarValue
  }
  if (engineType) {
    return engineType
  }

  return DEFAULT_CLIENT_ENGINE_TYPE
}
function buildTests() {
  const engineTypes = [ClientEngineType.Binary, ClientEngineType.Library, undefined]
  const envVars = {
    PRISMA_CLIENT_ENGINE_TYPE: engineTypes,
  }
  for (const engineType of engineTypes) {
    for (const envVar in envVars) {
      for (const value of envVars[envVar]) {
        const expectedClientEngine = getExpectedEngine(engineType, envVar, value)
        test(`expects(${expectedClientEngine}) | ${envVar}=${value} | engineType=${engineType}`, async () => {
          expect.assertions(2)
          const schema = buildSchema(engineType)

          // Set up Project in tmp dir
          const projectDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`)
          fs.copyFileSync(path.join(__dirname, './dev.db'), path.join(projectDir, 'dev.db'))
          fs.writeFileSync(path.join(projectDir, 'schema.prisma'), schema)

          // Set ENV VAR
          process.env[envVar] = value

          // Generate Client to tmp dir
          await generateTestClient(projectDir)

          // Run Tests
          const { PrismaClient } = require(path.join(projectDir, 'node_modules/@prisma/client'))
          const prisma = new PrismaClient()
          const users = await prisma.user.findMany()
          expect(users).toMatchInlineSnapshot(`
            [
              {
                email: a@a.de,
                id: 576eddf9-2434-421f-9a86-58bede16fd95,
                name: Alice,
              },
            ]
            `)

          expect(prisma._clientEngineType).toMatch(expectedClientEngine)
          await prisma.$disconnect()
        })
      }
    }
  }
}
describe('client engine', () => {
  buildTests()
})
