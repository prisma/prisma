/* eslint-disable jest/no-identical-title */

import { jestContext } from '@prisma/internals'
import { DbExecute, DbPull, DbPush, MigrateDev, MigrateReset } from '@prisma/migrate'
import fs from 'fs'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext.new().assemble()

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

/**
 * Commands:
 * - wasm engine
 *   - format
 * - library/binary engine
 *   - validate
 *   - db push
 *   - db pull
 *   - db execute
 *   - migrate reset
 *   - migrate dev
 */

const dbExecuteSQLScript = `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`

describe('incomplete-schemas wasm', () => {
  describe('datasource-block-url-env-unset', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-unset/prisma')
    })

    it('format', async () => {
      const result = await Format.new().parse([])
      expect(result).toMatch(/^Formatted (.*) in \d+ms 🚀$/)
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url/prisma')
    })

    it('format', async () => {
      await expect(Format.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
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
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    })
  })

  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema/prisma')
    })

    it('format', async () => {
      const result = await Format.new().parse([])
      expect(result).toMatch(/^Formatted (.*) in \d+ms 🚀$/)
    })
  })
})

describeIf(
  process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === 'library' || process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === undefined,
)('incomplete-schemas library', () => {
  describe('datasource-block-url-env-unset', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-unset/prisma')
    })

    it('validate', async () => {
      await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:3
           | 
         2 |   provider = "postgresql"
         3 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db push', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:3
           | 
         2 |   provider = "postgresql"
         3 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db pull', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:3
           | 
         2 |   provider = "postgresql"
         3 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)

      await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
        There is no datasource in the schema.


      `)
    })

    it('migrate reset', async () => {
      await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:3
           | 
         2 |   provider = "postgresql"
         3 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('migrate dev', async () => {
      await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:3
           | 
         2 |   provider = "postgresql"
         3 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url/prisma')
    })

    it('validate', async () => {
      await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
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
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db push', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
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

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db pull', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
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

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)

      await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
        P1012

        error: Argument "url" is missing in data source block "db".
          -->  schema.prisma:3
           | 
         2 | 
         3 | datasource db {
         4 |   provider = "postgresql"
         5 | }
           | 


      `)
    })

    it('migrate reset', async () => {
      await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
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

        Prisma CLI Version : 0.0.0
      `)
    })

    it('migrate dev', async () => {
      await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-node-api library)
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

        Prisma CLI Version : 0.0.0
      `)
    })
  })

  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema/prisma')
    })

    it('validate', async () => {
      await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
        Error while trying to read datamodel path
        Details: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db push', async () => {
      await expect(DbPush.new().parse([])).rejects.toMatchInlineSnapshot(
        `Couldn't find a datasource in the schema.prisma file`,
      )
    })

    it('db pull', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        There is no datasource in the schema.

      `)
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)

      await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
        There is no datasource in the schema.


      `)
    })

    it('migrate reset', async () => {
      await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(
        `Couldn't find a datasource in the schema.prisma file`,
      )
    })

    it('migrate dev', async () => {
      await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(`
        Error while trying to read datamodel path
        Details: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    })
  })
})

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === 'binary')('incomplete-schemas binary', () => {
  describe('datasource-block-url-env-unset', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-unset/prisma')
    })

    it('validate', async () => {
      await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:5
           | 
         4 |   provider = "postgresql"
         5 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db push', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:5
           | 
         4 |   provider = "postgresql"
         5 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db pull', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:5
           | 
         4 |   provider = "postgresql"
         5 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)

      await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
        P1012

        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:5
           | 
         4 |   provider = "postgresql"
         5 |   url      = env("SOME_UNDEFINED_DB")
           | 


      `)
    })

    it('migrate reset', async () => {
      await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:5
           | 
         4 |   provider = "postgresql"
         5 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('migrate dev', async () => {
      await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
        Error code: P1012
        error: Environment variable not found: SOME_UNDEFINED_DB.
          -->  schema.prisma:5
           | 
         4 |   provider = "postgresql"
         5 |   url      = env("SOME_UNDEFINED_DB")
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url/prisma')
    })

    it('validate', async () => {
      await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
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
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db push', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
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

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db pull', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
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

        Prisma CLI Version : 0.0.0
      `)
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)

      await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
        P1012

        error: Argument "url" is missing in data source block "db".
          -->  schema.prisma:3
           | 
         2 | 
         3 | datasource db {
         4 |   provider = "postgresql"
         5 | }
           | 


      `)
    })

    it('migrate reset', async () => {
      await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
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

        Prisma CLI Version : 0.0.0
      `)
    })

    it('migrate dev', async () => {
      await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine binary)
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

        Prisma CLI Version : 0.0.0
      `)
    })
  })

  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema/prisma')
    })

    it('validate', async () => {
      const result = await Validate.new().parse([])
      expect(result).toMatch(/^The schema at (.*) is valid 🚀$/)
    })

    it('db push', async () => {
      await expect(DbPush.new().parse([])).rejects.toMatchInlineSnapshot(
        `Couldn't find a datasource in the schema.prisma file`,
      )
    })

    it('db pull', async () => {
      await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
        There is no datasource in the schema.

      `)
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)

      await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
        There is no datasource in the schema.


      `)
    })

    it('migrate reset', async () => {
      await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(
        `Couldn't find a datasource in the schema.prisma file`,
      )
    })

    it('migrate dev', async () => {
      await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(
        `Couldn't find a datasource in the schema.prisma file`,
      )
    })
  })
})
