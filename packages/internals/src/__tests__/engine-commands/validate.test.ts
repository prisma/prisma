import { serialize } from '@prisma/get-platform/src/test-utils/jestSnapshotSerializer'
import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { isRustPanic, validate } from '../..'
import { fixturesPath } from '../__utils__/fixtures'

jest.setTimeout(10_000)

if (process.env.CI) {
  // 10s is not always enough for the "big schema" test on macOS CI.
  jest.setTimeout(60_000)
}

describe('validate', () => {
  /*
  // Note: to run these tests locally, prepend the env vars `FORCE_COLOR=0` and `CI=1` to your test command,
  // as `chalk` follows different conventions than the Rust `colored` crate (and uses `FORCE_COLOR=0` to disable colors rather than `NO_COLOR=1`).
  describe('colors', () => {
    // backup env vars
    const OLD_ENV = { ...process.env }
    const { NO_COLOR: _, ...OLD_ENV_WITHOUT_NO_COLOR } = OLD_ENV

    beforeEach(() => {
      // jest.resetModules()
      process.env = { ...OLD_ENV_WITHOUT_NO_COLOR, FORCE_COLOR: '0', CI: '1' }
    })

    afterEach(() => {
      // reset env vars to backup state
      process.env = { ...OLD_ENV }
    })

    test('failures should have colors by default', () => {
      expect.assertions(1)
      const datamodel = `
        datasource db {
      `

      try {
        validate({ datamodel })
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          [1;91merror[0m: [1mError validating: This line is invalid. It does not start with any known Prisma schema keyword.[0m
            [1;94m-->[0m  [4mschema.prisma:2[0m
          [1;94m   | [0m
          [1;94m 1 | [0m
          [1;94m 2 | [0m        [1;91mdatasource db {[0m
          [1;94m 3 | [0m      
          [1;94m   | [0m

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    // Note(jkomyno): this fails locally because the colored crate used in Wasm forces the coloring on tty (but apparently not on CI?).
    // On standard terminals, the NO_COLOR env var is actually working as expected (it prints plain uncolored text).
    // See: https://github.com/prisma/prisma-private/issues/210
    test('failures should not have colors when the NO_COLOR env var is set', () => {
      process.env.NO_COLOR = '1'
      expect.assertions(1)
      const datamodel = `
        datasource db {
      `

      try {
        validate({ datamodel })
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating: This line is invalid. It does not start with any known Prisma schema keyword.
            -->  schema.prisma:2
             | 
           1 | 
           2 |         datasource db {
           3 |       
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })
  */

  describe('errors', () => {
    test('model with autoincrement should fail if sqlite', () => {
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
        validate({ datamodel })
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
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
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    test('model with autoincrement should fail if mysql', () => {
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
        validate({ datamodel })
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-indexed field even though the datasource does not support this.
            -->  schema.prisma:7
             | 
           6 |         model User {
           7 |           id        Int      @default(autoincrement())
           8 |           email     String   @unique
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    test(`panics when the given datamodel isnt' a string`, () => {
      expect.assertions(3)

      try {
        // @ts-expect-error
        validate({ datamodel: true })
      } catch (e) {
        expect(isRustPanic(e)).toBe(true)
        expect(serialize(e.message)).toMatchInlineSnapshot(`"unreachable"`)
        expect(e.rustStack).toBeTruthy()
      }
    })

    test('validation errors', () => {
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
        validate({ datamodel })
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
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
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })

  describe('success', () => {
    test('simple model, no datasource', () => {
      validate({
        datamodel: `model A {
          id Int @id
          name String
        }`,
      })
    })

    test('simple model, sqlite', () => {
      validate({
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
    })

    test('chinook introspected schema', async () => {
      const file = await fs.promises.readFile(path.join(fixturesPath, 'chinook.prisma'), 'utf-8')
      validate({
        datamodel: file,
      })
    })

    test('odoo introspected schema', async () => {
      const file = await fs.promises.readFile(path.join(fixturesPath, 'odoo.prisma'), 'utf-8')
      validate({
        datamodel: file,
      })
    })
  })
})
