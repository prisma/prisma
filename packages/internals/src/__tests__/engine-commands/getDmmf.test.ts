import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { getDMMF, isRustPanic } from '../..'
import { fixturesPath } from '../__utils__/fixtures'

jest.setTimeout(10_000)

if (process.env.CI) {
  // 10s is not always enough for the "big schema" test on macOS CI.
  jest.setTimeout(60_000)
}

describe('getDMMF', () => {
  describe('errors', () => {
    test('model with autoincrement should fail if sqlite', async () => {
      expect.assertions(1)
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

      try {
        await getDMMF({ datamodel })
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-dmmf wasm)
          Error code: P1012
          error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-id field even though the datasource does not support this.
            -->  schema.prisma:7
             | 
           6 |         model User {
           7 |           id        Int      @default(autoincrement())
           8 |           email     String   @unique
             | 
          error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-indexed field even though the datasource does not support this.
            -->  schema.prisma:7
             | 
           6 |         model User {
           7 |           id        Int      @default(autoincrement())
           8 |           email     String   @unique
             | 

          Validation Error Count: 2
          [Context: getDmmf]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    test('model with autoincrement should fail if mysql', async () => {
      expect.assertions(1)
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

      try {
        await getDMMF({ datamodel })
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-dmmf wasm)
          Error code: P1012
          error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-indexed field even though the datasource does not support this.
            -->  schema.prisma:7
             | 
           6 |         model User {
           7 |           id        Int      @default(autoincrement())
           8 |           email     String   @unique
             | 

          Validation Error Count: 1
          [Context: getDmmf]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    test(`fails when reading a datamodel path that doesn't exist`, async () => {
      expect.assertions(2)

      try {
        await getDMMF({ datamodelPath: './404/it-does-not-exist' })
      } catch (e) {
        expect(isRustPanic(e)).toBe(false)
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Error while trying to read the datamodel path
          Details: ENOENT: no such file or directory, open './404/it-does-not-exist'
          Datamodel path: "./404/it-does-not-exist"
          [Context: getDmmf]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    test(`panics when the given datamodel isnt' a string`, async () => {
      expect.assertions(3)

      try {
        // @ts-expect-error
        await getDMMF({ datamodel: true })
      } catch (e) {
        expect(isRustPanic(e)).toBe(true)
        expect(e.message).toMatchInlineSnapshot(`"unreachable"`)
        expect(e.rustStack).toBeTruthy()
      }
    })

    test('validation errors', async () => {
      expect.assertions(1)
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
      try {
        await getDMMF({ datamodel })
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-dmmf wasm)
          Error code: P1012
          error: Field "id" is already defined on model "User".
            -->  schema.prisma:12
             | 
          11 |         id           String     @id @default(cuid())
          12 |         id           String     @id @default(cuid())
             | 
          error: Field "permissions" is already defined on model "User".
            -->  schema.prisma:17
             | 
          16 |         permissions  Permission @default()
          17 |         permissions  Permission @default("")
             | 
          error: Field "posts" is already defined on model "User".
            -->  schema.prisma:19
             | 
          18 |         posts        Post[]
          19 |         posts        Post[]
             | 

          Validation Error Count: 3
          [Context: getDmmf]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })

  describe('success', () => {
    test(`if a datamodel is provided, succeeds even when a non-existing datamodel path is given`, async () => {
      expect.assertions(2)

      const datamodel = /* prisma */ `
        generator client {
          provider = "prisma-client-js"
        }
        
        datasource my_db {
          provider = "sqlite"
          url      = "file:dev.db"
        }
      `

      const dmmf = await getDMMF({ datamodel, datamodelPath: './404/it-does-not-exist' })
      expect(dmmf.datamodel).toMatchSnapshot()
      expect(dmmf).toMatchSnapshot()
    })

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

    test('@@id model', async () => {
      const dmmf = await getDMMF({
        datamodel: `
        datasource db {
          provider = "postgres"
          url      = env("MY_POSTGRES_DB")
        }
        generator client {
          provider        = "prisma-client-js"
        }
        
        model User1 {
          id        Int     @default(autoincrement())
          firstName String
          lastName  String
          isAdmin   Boolean @default(false)
          @@id(fields: [firstName, lastName], name: "customName") // with name
        }
        
        // Specify a multi-field id attribute on two String fields and one Boolean field
        model User2 {
          id        Int     @default(autoincrement())
          firstName String
          lastName  String
          isAdmin   Boolean @default(false)
          @@id([firstName, lastName, isAdmin])
        }
    `,
      })

      expect(dmmf).toMatchSnapshot()
    })

    test('chinook introspected schema', async () => {
      const file = fs.readFileSync(path.join(fixturesPath, 'chinook.prisma'), 'utf-8')
      const dmmf = await getDMMF({
        datamodel: file,
      })
      const str = JSON.stringify(dmmf)
      expect(str.length).toMatchSnapshot()
    })

    test('big schema', async () => {
      const file = fs.readFileSync(path.join(fixturesPath, 'bigschema.prisma'), 'utf-8')
      const dmmf = await getDMMF({
        datamodel: file,
      })
      const str = JSON.stringify(dmmf)
      expect(str.length).toMatchSnapshot()
    })
  })
})
