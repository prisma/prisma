import { enginesVersion } from '@prisma/engines'
import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'
import { EngineTypes } from '..'
import { formatSchema, getConfig, getDMMF, getVersion } from '../'
jest.setTimeout(15000)

describe('getDMMF', () => {
  test('simple model', async () => {
    const dmmf = await getDMMF({
      datamodel: `model A {
        id Int @id
        name String
      }`,
    })

    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('@@map model', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("MY_POSTGRESQL_DB")
      }
      model User {
        id        Int      @default(autoincrement())
        email     String   @unique
        @@map("users")
      }`,
    })
    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('model with autoincrement should fail if sqlite', async () => {
    const datamodel = `
      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }
      model User {
        id        Int      @default(autoincrement())
        email     String   @unique
        @@map("users")
      }`

    /* eslint-disable jest/no-try-expect */
    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
    /* eslint-enable jest/no-try-expect */
  })

  test('model with autoincrement should fail if mysql', async () => {
    const datamodel = `
      datasource db {
        provider = "mysql"
        url      = env("MY_MYSQL_DB")
      }
      model User {
        id        Int      @default(autoincrement())
        email     String   @unique
        @@map("users")
      }`

    /* eslint-disable jest/no-try-expect */
    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
    /* eslint-enable jest/no-try-expect */
  })

  test('@@unique model', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "postgres"
        url      = env("MY_POSTGRES_DB")
      }

      // From https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/data-model#examples-3
      // Specify a multi-field unique attribute that includes a relation field
      model Post {
        id        Int     @default(autoincrement())
        author    User    @relation(fields: [authorId], references: [id])
        authorId  Int
        title     String
        published Boolean @default(false)
        
        @@unique([authorId, title])
      }
      model User {
        id    Int    @id @default(autoincrement())
        email String @unique
        posts Post[]
      }

      // Specify a multi-field unique attribute on two String fields
      model User1 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName])
      }
      
      // Specify a multi-field unique attribute on two String fields and one Boolean field
      model User2 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName, isAdmin])
      }
  `,
    })

    expect(dmmf).toMatchSnapshot()
  })

  test('@@unique model connectOrCreate', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("MY_POSTGRES_DB")
      }

      // From https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/data-model#examples-3
      // Specify a multi-field unique attribute that includes a relation field
      model Post {
        id        Int     @default(autoincrement())
        author    User    @relation(fields: [authorId], references: [id])
        authorId  Int
        title     String
        published Boolean @default(false)
        
        @@unique([authorId, title])
      }
      model User {
        id    Int    @id @default(autoincrement())
        email String @unique
        posts Post[]
      }

      // Specify a multi-field unique attribute on two String fields
      model User1 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName])
      }
      
      // Specify a multi-field unique attribute on two String fields and one Boolean field
      model User2 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName, isAdmin])
      }
  `,
    })

    expect(dmmf).toMatchSnapshot()
  })

  test('chinook introspected schema', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/chinook.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({
      datamodel: file,
    })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchSnapshot()
  })

  test('chinook introspected schema connectOrCreate', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/chinook.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({
      datamodel: file,
    })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchSnapshot()
  })

  test('big schema', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/bigschema.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({
      datamodel: file,
    })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchSnapshot()
  })

  test('with validation errors', async () => {
    const datamodel = `generator client {
      provider = "prisma-client-js"
    }
    
    datasource my_db {
      provider = "sqlite"
      url      = "file:dev.db"
    }
    
    model User {
      id           String     @id @default(cuid())
      id           String     @id @default(cuid())
      name         String
      email        String     @unique
      status       String     @default("")
      permissions  Permission @default()
      permissions  Permission @default("")
      posts        Post[]
      posts        Post[]
    }
    
    model Post {
      id        String   @id @default(cuid())
      name      String
      email     String   @unique
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    
    enum Permission {
      ADMIN
      USER
      OWNER
      COLLABORATOR
    }
    `
    /* eslint-disable jest/no-try-expect */
    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
    /* eslint-enable jest/no-try-expect */
  })
})

describe('getConfig', () => {
  test('empty config', async () => {
    const config = await getConfig({
      datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:../hello.db"
      }
      
      model A {
        id Int @id
        name String
      }`,
    })

    expect(config).toMatchSnapshot()
  })

  test('sqlite and createMany', async () => {
    expect.assertions(1)
    try {
      await getConfig({
        datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:../hello.db"
      }

      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["createMany"]
      }
      
      model A {
        id Int @id
        name String
      }`,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "Get config: Error: Database provider \\"sqlite\\" and the preview feature \\"createMany\\" can't be used at the same time.
          Please either remove the \\"createMany\\" feature flag or use any other database type that Prisma supports: postgres, mysql or sqlserver."
      `)
    }
  })

  test('with generator and datasource', async () => {
    const config = await getConfig({
      datamodel: `
    datasource db {
      url = "file:dev.db"
      provider = "sqlite"
    }

    generator gen {
      provider = "fancy-provider"
      binaryTargets = ["native"]
    }

    model A {
      id Int @id
      name String
    }`,
    })

    expect(config).toMatchSnapshot()
  })

  test('datasource with env var', async () => {
    process.env.TEST_POSTGRES_URI_FOR_DATASOURCE =
      'postgres://user:password@something:5432/db'

    const config = await getConfig({
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("TEST_POSTGRES_URI_FOR_DATASOURCE")
      }
      `,
    })

    expect(config).toMatchSnapshot()
  })

  test('datasource with env var - ignoreEnvVarErrors', async () => {
    const config = await getConfig({
      ignoreEnvVarErrors: true,
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("SOMETHING-SOMETHING-1234")
      }
      `,
    })

    expect(config).toMatchSnapshot()
  })
})

describe('format', () => {
  test('nothing', async () => {
    try {
      // @ts-expect-error
      await formatSchema({})
    } catch (e) {
      expect(e.message).toMatchSnapshot()
    }
  })

  test('valid blog schemaPath', async () => {
    const formatted = await formatSchema({
      schemaPath: path.join(__dirname, 'fixtures/blog.prisma'),
    })

    expect(formatted).toMatchSnapshot()
  })

  test('valid blog schema', async () => {
    const formatted = await formatSchema({
      schema: `
      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }
      
      generator client {
        provider      = "prisma-client-js"
        binaryTargets = ["native"]
      }
      
      model User {
        id    String  @default(cuid()) @id
        email String  @unique
        name  String?
        posts Post[]
      }
      
      model Post {
        id        String   @default(cuid()) @id
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
        published Boolean
        title     String
        content   String?
        authorId  String?
        author    User?    @relation(fields: [authorId], references: [id])
      }
      
      model Like {
        id     String @default(cuid()) @id
        userId String
        user   User   @relation(fields: [userId], references: [id])
        postId String
        post   Post   @relation(fields: [postId], references: [id])
      
        @@unique([userId, postId])
      }`,
    })

    expect(formatted).toMatchSnapshot()
  })
})

describe('getVersion', () => {
  test('Introspection Engine', async () => {
    const introspectionEngineVersion = await getVersion(
      undefined,
      EngineTypes.introspectionEngine,
    )
    expect(introspectionEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('N-API Engine', async () => {
    const libqueryEngineNapiVersion = await getVersion(
      undefined,
      EngineTypes.libqueryEngineNapi,
    )
    expect(libqueryEngineNapiVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Migration Engine', async () => {
    const migrationEngineVersion = await getVersion(
      undefined,
      EngineTypes.migrationEngine,
    )
    expect(migrationEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Prisma Fmt', async () => {
    const prismaFmtVersion = await getVersion(undefined, EngineTypes.prismaFmt)
    expect(prismaFmtVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Query Engine', async () => {
    const queryEngineVersion = await getVersion(
      undefined,
      EngineTypes.queryEngine,
    )
    expect(queryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
})
