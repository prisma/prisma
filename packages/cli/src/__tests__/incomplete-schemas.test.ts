// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { defaultTestConfig } from '@prisma/config'
import { jestContext } from '@prisma/get-platform'
import { serializeQueryEngineName } from '@prisma/internals'
import { DbExecute, DbPull, DbPush, MigrateDev, MigrateReset } from '@prisma/migrate'
import fs from 'node:fs'
import stripAnsi from 'strip-ansi'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext.new().assemble()

/**
 * Commands:
 * - wasm engine
 *   - format
 * - library/binary engine
 *   - validate
 *   - db push
 *   - db pull
 *   - db execute (doesn't use neither getDmmf nor getConfig directly)
 *   - migrate reset
 *   - migrate dev
 */

const dbExecuteSQLScript = `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`

describe('[wasm] incomplete-schemas', () => {
  describe('datasource-block-url-env-set-invalid', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-set-invalid/prisma')
    })

    it('format', async () => {
      const result = await Format.new().parse([], defaultTestConfig())
      expect(result).toMatch(/^Formatted (.*) in \d+ms 🚀$/)
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchSnapshot()
      }
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchSnapshot()
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Error validating datasource \`db\`: the URL must start with the protocol \`postgresql://\` or \`postgres://\`.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_DEFINED_INVALID_URL")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        await DbExecute.new().parse(['--file=./script.sql'], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Error validating datasource \`db\`: the URL must start with the protocol \`postgresql://\` or \`postgres://\`.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_DEFINED_INVALID_URL")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Error validating datasource \`db\`: the URL must start with the protocol \`postgresql://\` or \`postgres://\`.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_DEFINED_INVALID_URL")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Error validating datasource \`db\`: the URL must start with the protocol \`postgresql://\` or \`postgres://\`.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_DEFINED_INVALID_URL")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })

  describe('datasource-block-url-env-unset', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-unset/prisma')
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Environment variable not found: SOME_UNDEFINED_DB.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_UNDEFINED_DB")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Environment variable not found: SOME_UNDEFINED_DB.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_UNDEFINED_DB")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Environment variable not found: SOME_UNDEFINED_DB.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_UNDEFINED_DB")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        await DbExecute.new().parse(['--file=./script.sql'], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Environment variable not found: SOME_UNDEFINED_DB.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_UNDEFINED_DB")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Environment variable not found: SOME_UNDEFINED_DB.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_UNDEFINED_DB")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Environment variable not found: SOME_UNDEFINED_DB.
            -->  schema.prisma:5
             | 
           4 |   provider = "postgresql"
           5 |   url      = env("SOME_UNDEFINED_DB")
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })

  describe('datasource-block-url-env-unset', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-unset/prisma')
    })

    it('format', async () => {
      const result = await Format.new().parse([], defaultTestConfig())
      expect(result).toMatch(/^Formatted (.*) in \d+ms 🚀$/)
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url/prisma')
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('format', async () => {
      expect.assertions(1)

      try {
        await Format.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })

  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema/prisma')
    })

    it('format', async () => {
      const result = await Format.new().parse([], defaultTestConfig())
      expect(result).toMatch(/^Formatted (.*) in \d+ms 🚀$/)
    })

    it('validate', async () => {
      const result = await Validate.new().parse([], defaultTestConfig())
      expect(result).toMatch(/^The schema at (.*) is valid 🚀$/)
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url/prisma')
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        await DbExecute.new().parse(['--file=./script.sql'], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Argument "url" is missing in data source block "db".
            -->  schema.prisma:3
             | 
           2 | 
           3 | datasource db {
           4 |   provider = "postgresql"
           5 | }
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })
  })
})

describe('[normalized library/binary] incomplete-schemas', () => {
  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema/prisma')
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(
          `"A datasource block is missing in the Prisma schema file."`,
        )
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(`
          "There is no datasource in the schema.

          "
        `)
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        await DbExecute.new().parse(['--file=./script.sql'], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(`
          "There is no datasource in the schema.

          "
        `)
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(
          `"A datasource block is missing in the Prisma schema file."`,
        )
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(
          `"A datasource block is missing in the Prisma schema file."`,
        )
      }
    })
  })
})
