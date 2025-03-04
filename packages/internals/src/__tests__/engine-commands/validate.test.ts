import { serialize } from '@prisma/get-platform/src/test-utils/jestSnapshotSerializer'
import path from 'node:path'
import stripAnsi from 'strip-ansi'

import { isRustPanic, validate } from '../..'
import { getSchemaWithPath } from '../../cli/getSchema'
import type { MultipleSchemas, SchemaFileInput } from '../../utils/schemaFileInput'
import { fixturesPath } from '../__utils__/fixtures'

jest.setTimeout(10_000)

if (process.env.CI) {
  // 10s is not always enough for the "big schema" test on macOS CI.
  jest.setTimeout(60_000)
}

describe('validate', () => {
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
      const schema = `
        datasource db {
      `
      const schemas: MultipleSchemas = [['/* schemaPath */', schema]]

      try {
        validate({ schemas })
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
      const schema = `
        datasource db {
      `
      const schemas: MultipleSchemas = [['/* schemaPath */', schema]]

      try {
        validate({ schemas })
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

  describe('errors', () => {
    describe('single file', () => {
      test('model with autoincrement should fail if sqlite', () => {
        expect.assertions(1)
        const schema = `
          datasource db {
            provider = "sqlite"
            url      = "file:dev.db"
          }
          model User {
            id        Int      @default(autoincrement())
            email     String   @unique
            @@map("users")
          }`
        const schemas: MultipleSchemas = [['schema.prisma', schema]]

        try {
          validate({ schemas })
        } catch (e) {
          expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
            "Prisma schema validation - (validate wasm)
            Error code: P1012
            error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-id field even though the datasource does not support this.
              -->  schema.prisma:7
               | 
             6 |           model User {
             7 |             id        Int      @default(autoincrement())
             8 |             email     String   @unique
               | 
            error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-indexed field even though the datasource does not support this.
              -->  schema.prisma:7
               | 
             6 |           model User {
             7 |             id        Int      @default(autoincrement())
             8 |             email     String   @unique
               | 

            Validation Error Count: 2
            [Context: validate]

            Prisma CLI Version : 0.0.0"
          `)
        }
      })

      test('model with autoincrement should fail if mysql', () => {
        expect.assertions(1)
        const schema = `
          datasource db {
            provider = "mysql"
            url      = env("MY_MYSQL_DB")
          }
          model User {
            id        Int      @default(autoincrement())
            email     String   @unique
            @@map("users")
          }`
        const schemas: MultipleSchemas = [['schema.prisma', schema]]

        try {
          validate({ schemas })
        } catch (e) {
          expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
            "Prisma schema validation - (validate wasm)
            Error code: P1012
            error: Error parsing attribute "@default": The \`autoincrement()\` default value is used on a non-indexed field even though the datasource does not support this.
              -->  schema.prisma:7
               | 
             6 |           model User {
             7 |             id        Int      @default(autoincrement())
             8 |             email     String   @unique
               | 

            Validation Error Count: 1
            [Context: validate]

            Prisma CLI Version : 0.0.0"
          `)
        }
      })

      test('throws an error when the given datamodel is of the wrong type', () => {
        expect.assertions(2)

        try {
          // @ts-expect-error
          validate({ schemas: [[true, true]] })
        } catch (e) {
          expect(isRustPanic(e)).toBe(true)
          expect(serialize(e.message)).toMatchInlineSnapshot(`
            ""RuntimeError: panicked at prisma-fmt/src/validate.rs:0:0:
            Failed to deserialize ValidateParams: data did not match any variant of untagged enum SchemaFileInput at line 1 column 29""
          `)
        }
      })

      test('validation errors', () => {
        expect.assertions(1)
        const schema = `generator client {
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
        const schemas: MultipleSchemas = [['schema.prisma', schema]]
        try {
          validate({ schemas })
        } catch (e) {
          expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
            "Prisma schema validation - (validate wasm)
            Error code: P1012
            error: Field "id" is already defined on model "User".
              -->  schema.prisma:12
               | 
            11 |           id           String     @id @default(cuid())
            12 |           id           String     @id @default(cuid())
               | 
            error: Field "permissions" is already defined on model "User".
              -->  schema.prisma:17
               | 
            16 |           permissions  Permission @default()
            17 |           permissions  Permission @default("")
               | 
            error: Field "posts" is already defined on model "User".
              -->  schema.prisma:19
               | 
            18 |           posts        Post[]
            19 |           posts        Post[]
               | 
            error: Error validating model "User": At most one field must be marked as the id field with the \`@id\` attribute.
              -->  schema.prisma:10
               | 
             9 |         
            10 |         model User {
            11 |           id           String     @id @default(cuid())
            12 |           id           String     @id @default(cuid())
            13 |           name         String
            14 |           email        String     @unique
            15 |           status       String     @default("")
            16 |           permissions  Permission @default()
            17 |           permissions  Permission @default("")
            18 |           posts        Post[]
            19 |           posts        Post[]
            20 |         }
               | 
            error: Argument "value" is missing.
              -->  schema.prisma:16
               | 
            15 |           status       String     @default("")
            16 |           permissions  Permission @default()
               | 
            error: Error parsing attribute "@default": Expected an enum value, but found \`""\`.
              -->  schema.prisma:17
               | 
            16 |           permissions  Permission @default()
            17 |           permissions  Permission @default("")
               | 

            Validation Error Count: 6
            [Context: validate]

            Prisma CLI Version : 0.0.0"
          `)
        }
      })
    })

    describe('multiple files', () => {
      test(`panics when the given datamodel isn't an array of string tuples`, () => {
        expect.assertions(3)

        try {
          // @ts-expect-error
          validate({ schemas: [['schema.prisma', true]] })
        } catch (e) {
          expect(isRustPanic(e)).toBe(true)
          expect(serialize(e.message)).toMatchInlineSnapshot(`
            ""RuntimeError: panicked at prisma-fmt/src/validate.rs:0:0:
            Failed to deserialize ValidateParams: data did not match any variant of untagged enum SchemaFileInput at line 1 column 40""
          `)
          expect(e.rustStack).toBeTruthy()
        }
      })

      test('validation errors', () => {
        expect.assertions(1)

        const datamodel1 = /* prisma */ `
          generator client {
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
        `

        const datamodel2 = /* prisma */ `
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

        const datamodel: SchemaFileInput = [
          ['schema.prisma', datamodel1],
          ['schema2.prisma', datamodel2],
        ]

        try {
          validate({ schemas: datamodel })
        } catch (e) {
          // TODO: patch engines to fix this message, it should group errors by the different filenames.
          expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
            "Prisma schema validation - (validate wasm)
            Error code: P1012
            error: Field "id" is already defined on model "User".
              -->  schema.prisma:13
               | 
            12 |             id           String     @id @default(cuid())
            13 |             id           String     @id @default(cuid())
               | 
            error: Field "permissions" is already defined on model "User".
              -->  schema.prisma:18
               | 
            17 |             permissions  Permission @default()
            18 |             permissions  Permission @default("")
               | 
            error: Field "posts" is already defined on model "User".
              -->  schema.prisma:20
               | 
            19 |             posts        Post[]
            20 |             posts        Post[]
               | 
            error: Error validating model "User": At most one field must be marked as the id field with the \`@id\` attribute.
              -->  schema.prisma:11
               | 
            10 | 
            11 |           model User {
            12 |             id           String     @id @default(cuid())
            13 |             id           String     @id @default(cuid())
            14 |             name         String
            15 |             email        String     @unique
            16 |             status       String     @default("")
            17 |             permissions  Permission @default()
            18 |             permissions  Permission @default("")
            19 |             posts        Post[]
            20 |             posts        Post[]
            21 |           }
               | 
            error: Argument "value" is missing.
              -->  schema.prisma:17
               | 
            16 |             status       String     @default("")
            17 |             permissions  Permission @default()
               | 
            error: Error parsing attribute "@default": Expected an enum value, but found \`""\`.
              -->  schema.prisma:18
               | 
            17 |             permissions  Permission @default()
            18 |             permissions  Permission @default("")
               | 

            Validation Error Count: 6
            [Context: validate]

            Prisma CLI Version : 0.0.0"
          `)
        }
      })
    })
  })

  describe('success', () => {
    test('simple model, no datasource', () => {
      const schema /* prisma */ = `model A {
        id Int @id
        name String
      }`
      const schemas: MultipleSchemas = [['schema.prisma', schema]]

      validate({ schemas })
    })

    test('simple model, sqlite', () => {
      const schema /* prisma */ = `datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }
      model A {
        id Int @id
        name String
      }`
      const schemas: MultipleSchemas = [['schema.prisma', schema]]

      validate({ schemas })
    })

    test('chinook introspected schema', async () => {
      const { schemas } = await getSchemaWithPath(path.join(fixturesPath, 'chinook.prisma'))
      validate({ schemas })
    })

    test('odoo introspected schema', async () => {
      const { schemas } = await getSchemaWithPath(path.join(fixturesPath, 'odoo.prisma'))
      validate({ schemas })
    })
  })
})
