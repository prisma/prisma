import fs from 'fs'
import path from 'path'
import {
  ClientEngineType,
  DEFAULT_CLIENT_ENGINE_TYPE,
} from '../../../../runtime/utils/getClientEngineType'
import { getTestClient } from '../../../../utils/getTestClient'

const buildSchema = (previewFeature?: string, engineType?: string) => `
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
  ${engineType ? `engineType="${engineType}"` : ''}
  ${previewFeature ? `previewFeatures=["${previewFeature}"]` : ''}
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
function getExpectedEngine(engineType, envVar, envVarValue, previewFeature) {
  if (envVar === 'PRISMA_FORCE_NAPI' && envVarValue === 'true') {
    // ENV VAR TAKES PRECEDENCE
    return ClientEngineType.NodeAPI
  }
  if (envVar === 'PRISMA_CLIENT_ENGINE_TYPE' && envVarValue) {
    return envVarValue
  }
  if (engineType) {
    return engineType
  }
  if (previewFeature === 'nApi') {
    return ClientEngineType.NodeAPI
  }

  return DEFAULT_CLIENT_ENGINE_TYPE
}
function buildTests() {
  const engineTypes = [
    ClientEngineType.Binary,
    ClientEngineType.NodeAPI,
    undefined,
  ]
  const previewFeatures = ['nApi', undefined]
  const envVars = {
    PRISMA_FORCE_NAPI: ['true', undefined],
    PRISMA_CLIENT_ENGINE_TYPE: engineTypes,
  }
  engineTypes.forEach((engineType) => {
    previewFeatures.forEach((previewFeature) => {
      for (const envVar in envVars) {
        envVars[envVar].forEach((value) => {
          const expectedClientEngine = getExpectedEngine(
            engineType,
            envVar,
            value,
            previewFeature,
          )
          test(`expects(${expectedClientEngine}) | ${envVar}=${value} | engineType=${engineType} | previewFeature=${previewFeature}`, async () => {
            expect.assertions(2)
            const schema = buildSchema(previewFeature, engineType)
            // console.log(schema)
            fs.writeFileSync(path.join(__dirname, 'schema.prisma'), schema)
            process.env[envVar] = value
            const PrismaClient = await getTestClient()
            const prisma = new PrismaClient()
            const users = await prisma.user.findMany()
            expect(users).toMatchInlineSnapshot(`
            Array [
              Object {
                email: a@a.de,
                id: 576eddf9-2434-421f-9a86-58bede16fd95,
                name: Alice,
              },
            ]
            `)

            expect(prisma._clientEngineType).toMatch(expectedClientEngine)
            await prisma.$disconnect()
          })
        })
      }
    })
  })
}
describe('client engine', () => {
  afterEach(() => {
    fs.unlinkSync(path.join(__dirname, './schema.prisma'))
  })
  buildTests()
})
