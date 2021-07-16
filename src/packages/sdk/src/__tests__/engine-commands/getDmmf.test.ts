import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'
import { getDMMF } from '../..'
import { fixturesPath } from '../__utils__/fixtures'

jest.setTimeout(10_000)

describe('getDMMF', () => {

  test('simple model, no datasource', async () => {
    const dmmf = await getDMMF({
      datamodel: `model A {
        id Int @id
        name String
      }`,
    })

    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('simple model, sqlite', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }
      model A {
        id Int @id
        name String
      }`,
    })

    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('simple model, postgresql', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("MY_POSTGRESQL_DB")
      }
      model A {
        id Int @id
        name String
      }`,
    })

    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('simple model, mysql', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "mysql"
        url      = env("MY_MYSQL_DB")
      }
      model A {
        id Int @id
        name String
      }`,
    })

    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('simple model, sql server', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "sqlserver"
        url      = env("MY_SQLSERVER_DB")
      }
      model A {
        id Int @id
        name String
      }`,
    })

    expect(dmmf.datamodel).toMatchSnapshot()
    expect(dmmf).toMatchSnapshot()
  })

  test('simple model, mongodb', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      datasource db {
        provider = "mongodb"
        url      = "MY_MONGODB_DB"
      }
      model A {
        id Int @id @map("_id")
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
      path.join(fixturesPath, 'chinook.prisma'),
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
      path.join(fixturesPath, 'chinook.prisma'),
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
      path.join(fixturesPath, 'bigschema.prisma'),
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
