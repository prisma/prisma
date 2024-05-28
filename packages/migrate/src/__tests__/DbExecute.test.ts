// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'

import { DbExecute } from '../commands/DbExecute'
import { setupCockroach, tearDownCockroach } from '../utils/setupCockroach'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const util = require('util')
const exec = util.promisify(require('child_process').exec)

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const testIf = (condition: boolean) => (condition ? test : test.skip)

const originalEnv = { ...process.env }

describe('db execute', () => {
  describe('generic', () => {
    it('should fail if missing --file and --stdin', async () => {
      ctx.fixture('empty')

      const result = DbExecute.new().parse([])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Either --stdin or --file must be provided.
        See \`prisma db execute -h\`"
      `)
    })

    it('should fail if both --file and --stdin are provided', async () => {
      ctx.fixture('empty')

      const result = DbExecute.new().parse(['--file=1', '--stdin'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "--stdin and --file cannot be used at the same time. Only 1 must be provided. 
        See \`prisma db execute -h\`"
      `)
    })

    it('should fail if missing --schema and --url', async () => {
      ctx.fixture('empty')

      const result = DbExecute.new().parse(['--file=1'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Either --url or --schema must be provided.
        See \`prisma db execute -h\`"
      `)
    })

    it('should fail if both --schema and --url are provided', async () => {
      ctx.fixture('empty')

      const result = DbExecute.new().parse(['--stdin', '--schema=1', '--url=1'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "--url and --schema cannot be used at the same time. Only 1 must be provided.
        See \`prisma db execute -h\`"
      `)
    })

    it('should fail if --file does no exists', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      try {
        await DbExecute.new().parse(['--file=./doesnotexists.sql', '--schema=1'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`"Provided --file at ./doesnotexists.sql doesn't exist."`)
      }
    })

    it('should fail if --schema does no exists', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse(['--file=./script.sql', '--schema=./doesnoexists.schema'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`"Provided --schema at ./doesnoexists.schema doesn't exist."`)
      }
    })
  })

  describe('mongodb', () => {
    it('should fail with not supported error with --file --schema', async () => {
      ctx.fixture('schema-only-mongodb')

      fs.writeFileSync('script.js', 'Something for MongoDB')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.js'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "dbExecute is not supported on MongoDB

        "
      `)
    })
  })

  describe('sqlite', () => {
    const pathToBin = path.resolve('src/bin.ts')
    const sqlScript = `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`

    it('should pass if no schema file in directory with --file --url', async () => {
      ctx.fixture('empty')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url=file:./dev.db', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    // On Windows: snapshot output = "-- Drop & Create & Drop"
    testIf(process.platform !== 'win32')(
      'should pass with --stdin --schema',
      async () => {
        ctx.fixture('schema-only-sqlite')

        const { stdout, stderr } = await exec(
          `echo "${sqlScript}" | ${pathToBin} db execute --stdin --schema=./prisma/schema.prisma`,
        )
        expect(stderr).toBeFalsy()
        expect(stdout).toMatchInlineSnapshot(`
          "Script executed successfully.
          "
        `)
        // This is a slow test and macOS machine can be even slower and fail the test
      },
      30_000,
    )

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-sqlite')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --schema folder', async () => {
      ctx.fixture('schema-folder-sqlite')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-sqlite')

      fs.writeFileSync(
        'script.sql',
        `-- start a transaction
BEGIN;

${sqlScript}

-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --url=file:dev.db', async () => {
      ctx.fixture('introspection/sqlite')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url=file:dev.db', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with empty --file --url=file:dev.db', async () => {
      ctx.fixture('introspection/sqlite')

      fs.writeFileSync('script.sql', '')
      const result = DbExecute.new().parse(['--url=file:dev.db', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-sqlite')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse(['--url=invalidurl', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. The scheme is not recognized in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    // the default behavior with sqlite is to create the db if it doesn't exists, no failure expected
    it('should pass with --file --url=file:doesnotexists.db', async () => {
      ctx.fixture('introspection/sqlite')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url=file:doesnotexists.db', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    // TODO we could have a generic error code in prisma-engines for a "SQL error"
    it('should fail with --file --schema if there is a database error', async () => {
      ctx.fixture('schema-only-sqlite')
      expect.assertions(1)

      fs.writeFileSync('script.sql', 'DROP TABLE "test-doesnotexists";')
      try {
        await DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(`
          "SQLite database error
          no such table: test-doesnotexists

          "
        `)
      }
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-sqlite')
      expect.assertions(2)

      fs.writeFileSync('script.sql', 'ThisisnotSQL,itshouldfail')
      try {
        await DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "SQLite database error
          near "ThisisnotSQL": syntax error in ThisisnotSQL,itshouldfail at offset 0

          "
        `)
      }
    })
  })

  describe('postgresql', () => {
    const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-execute')

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupPostgres(setupParams).catch((e) => {
        console.error(e)
      })
      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    const sqlScript = `-- Drop & Create & Drop
DROP SCHEMA IF EXISTS "test-dbexecute";
CREATE SCHEMA "test-dbexecute";
DROP SCHEMA "test-dbexecute";`

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --schema folder', async () => {
      ctx.fixture('schema-folder-postgres')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should use env var from .env file', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/using-dotenv.prisma', '--file=./script.sql'])
      await expect(result).rejects.toMatchInlineSnapshot(`
        "P1001

        Can't reach database server at \`fromdotenvdoesnotexist:5432\`

        Please make sure your database server is running at \`fromdotenvdoesnotexist:5432\`.
        "
      `)
    })

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync(
        'script.sql',
        `-- start a transaction
BEGIN;

${sqlScript}
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url', connectionString, '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with empty --file --url', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', '')
      const result = DbExecute.new().parse(['--url', connectionString, '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    // Limitation of postgresql
    // DROP DATABASE cannot be executed from a function or multi-command string
    // on GitHub Actions, for macOS and Windows it errors with
    // DROP DATABASE cannot run inside a transaction block
    it('should fail if DROP DATABASE with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')
      expect.assertions(2)

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
      DROP DATABASE IF EXISTS "test-dbexecute";
      CREATE DATABASE "test-dbexecute";
      DROP DATABASE "test-dbexecute";`,
      )
      try {
        await DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toContain('ERROR: DROP DATABASE cannot')
      }
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=postgresql://johndoe::::////::randompassword@doesnotexist/mydb',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. invalid port number in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })
    it('should fail with P1013 error with invalid url provider with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse(['--url=invalidurl', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. The scheme is not recognized in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')
      expect.assertions(2)

      // In CI, sometimes 5s is not enough
      if (process.env.CI) {
        jest.setTimeout(10_000)
      }

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=postgresql://johndoe:randompassword@doesnotexist:5432/mydb?schema=public',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1001')
        expect(e.message).toMatchInlineSnapshot(`
          "P1001

          Can't reach database server at \`doesnotexist:5432\`

          Please make sure your database server is running at \`doesnotexist:5432\`.
          "
        `)
      }
    })

    it('should fail with P1003 error with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')
      expect.assertions(2)

      fs.writeFileSync('script.sql', 'DROP DATABASE "test-doesnotexists";')
      try {
        await DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual('P1003')
        expect(e.message).toMatchInlineSnapshot(`
          "P1003

          Database \`test-doesnotexists\` does not exist on the database server at \`localhost:5432\`.
          "
        `)
      }
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', 'ThisisnotSQLitshouldfail')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "ERROR: syntax error at or near "ThisisnotSQLitshouldfail"

        "
      `)
    })
  })

  describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
    if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
      throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
    }
    // Without `|| ''`, the conditional test would return
    // a Type Error on `undefined.replace()` even though the test is skipped
    const connectionString = (process.env.TEST_COCKROACH_URI_MIGRATE || '').replace(
      'tests-migrate',
      'tests-migrate-db-execute',
    )

    const setupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownCockroach(setupParams).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupCockroach(setupParams).catch((e) => {
        console.error(e)
      })
      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_COCKROACH_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownCockroach(setupParams).catch((e) => {
        console.error(e)
      })
    })

    const sqlScript = `-- Drop & Create & Drop
DROP SCHEMA IF EXISTS "test-dbexecute";
CREATE SCHEMA "test-dbexecute";
DROP SCHEMA "test-dbexecute";`

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-cockroachdb')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    }, 10_000)

    it('should pass with --file --schema folder', async () => {
      ctx.fixture('schema-folder-cockroachdb')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    }, 10_000)

    it('should use env var from .env file', async () => {
      ctx.fixture('schema-only-cockroachdb')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/using-dotenv.prisma', '--file=./script.sql'])
      await expect(result).rejects.toMatchInlineSnapshot(`
        "P1001

        Can't reach database server at \`fromdotenvdoesnotexist:26257\`

        Please make sure your database server is running at \`fromdotenvdoesnotexist:26257\`.
        "
      `)
    }, 10_000)

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-cockroachdb')

      fs.writeFileSync(
        'script.sql',
        `-- start a transaction
BEGIN;

${sqlScript}
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    }, 10_000)

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-cockroachdb')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url', connectionString, '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with empty --file --url', async () => {
      ctx.fixture('schema-only-cockroachdb')

      fs.writeFileSync('script.sql', '')
      const result = DbExecute.new().parse(['--url', connectionString, '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    // Cockroachdb doesn't have the same limitation as Postgres, as it can drop and create a database
    // with a single SQL script.
    it('should succeed if DROP DATABASE with --file --schema', async () => {
      ctx.fixture('schema-only-cockroachdb')
      expect.assertions(0)

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
      DROP DATABASE IF EXISTS "test-dbexecute";
      CREATE DATABASE "test-dbexecute";
      DROP DATABASE "test-dbexecute";`,
      )
      try {
        await DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
      }
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-cockroachdb')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=postgresql://johndoe::::////::randompassword@doesnotexist/mydb',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. invalid port number in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    it('should fail with P1013 error with invalid url provider with --file --url', async () => {
      ctx.fixture('schema-only-cockroachdb')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse(['--url=invalidurl', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. The scheme is not recognized in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-cockroachdb')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=postgresql://johndoe:randompassword@doesnotexist:5432/mydb?schema=public',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1001')
        expect(e.message).toMatchInlineSnapshot(`
          "P1001

          Can't reach database server at \`doesnotexist:5432\`

          Please make sure your database server is running at \`doesnotexist:5432\`.
          "
        `)
      }
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-cockroachdb')

      fs.writeFileSync('script.sql', 'ThisisnotSQLitshouldfail')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "ERROR: at or near "thisisnotsqlitshouldfail": syntax error
        DETAIL: source SQL:
        ThisisnotSQLitshouldfail
        ^

        "
      `)
    })
  })

  describe('mysql', () => {
    const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-execute')

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupMysql(setupParams).catch((e) => {
        console.error(e)
      })
      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_MYSQL_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    const sqlScript = `-- Drop & Create & Drop
DROP DATABASE IF EXISTS \`test-dbexecute\`;
CREATE DATABASE \`test-dbexecute\`;
DROP DATABASE \`test-dbexecute\`;`

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --schema folder', async () => {
      ctx.fixture('schema-folder-mysql')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    // Only fails on MySQL
    it('should fail with empty --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', '')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Query was empty

        "
      `)
    })

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync(
        'script.sql',
        `-- start a transaction
START TRANSACTION;

${sqlScript}
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url', connectionString, '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-mysql')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=mysql://johndoe::::////::randompassword@doesnotexist:3306/mydb',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. invalid port number in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })
    it('should fail with P1013 error with invalid url provider with --file --url', async () => {
      ctx.fixture('schema-only-mysql')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse(['--url=invalidurl', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. The scheme is not recognized in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-mysql')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=mysql://johndoe:randompassword@doesnotexist:3306/mydb',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1001')
        expect(e.message).toMatchInlineSnapshot(`
          "P1001

          Can't reach database server at \`doesnotexist:3306\`

          Please make sure your database server is running at \`doesnotexist:3306\`.
          "
        `)
      }
    })

    it('should fail with SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Can't drop database 'test-doesnotexists'; database doesn't exist

        "
      `)
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'This is not SQL, it should fail')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'This is not SQL, it should fail' at line 1

        "
      `)
    })
  })

  describeIf(!process.env.TEST_SKIP_MSSQL)('sqlserver', () => {
    if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_JDBC_URI_MIGRATE) {
      throw new Error('You must set a value for process.env.TEST_MSSQL_JDBC_URI_MIGRATE. See TESTING.md')
    }

    const jdbcConnectionString = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace(
      'tests-migrate',
      'tests-migrate-db-execute',
    )

    const databaseName = 'tests-migrate-db-execute'
    const setupParams: SetupParams = {
      connectionString: process.env.TEST_MSSQL_URI!,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownMSSQL(setupParams, databaseName).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupMSSQL(setupParams, databaseName).catch((e) => {
        console.error(e)
      })
      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_MSSQL_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace(
        'tests-migrate',
        databaseName,
      )
      process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE?.replace(
        'tests-migrate-shadowdb',
        `${databaseName}-shadowdb`,
      )
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownMSSQL(setupParams, databaseName).catch((e) => {
        console.error(e)
      })
    })

    const sqlScript = `-- Drop & Create & Drop
DROP DATABASE IF EXISTS "test-dbexecute";
CREATE DATABASE "test-dbexecute";
DROP DATABASE "test-dbexecute";`

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --schema folder', async () => {
      ctx.fixture('schema-folder-sqlserver')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--schema=./prisma/schema', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with empty --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', '')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', sqlScript)
      const result = DbExecute.new().parse(['--url', jdbcConnectionString, '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync(
        'script.sql',
        `-- start a transaction
BEGIN TRANSACTION;

SELECT 1
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(`"Script executed successfully."`)
    })

    // Limitation of sqlserver
    // DROP DATABASE statement cannot be used inside a user transaction.
    it('should fail if DROP DATABASE in a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync(
        'script.sql',
        `-- start a transaction
BEGIN TRANSACTION;

${sqlScript}
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "DROP DATABASE statement cannot be used inside a user transaction.

        "
      `)
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=sqlserver://doesnotexist:1433;;;;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. Error parsing connection string: Conversion error: Invalid property key in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    it('should fail with P1013 error with invalid url provider with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse(['--url=invalidurl', '--file=./script.sql'])
      } catch (e) {
        expect(e.code).toEqual('P1013')
        expect(e.message).toMatchInlineSnapshot(`
          "P1013

          The provided database string is invalid. The scheme is not recognized in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
          "
        `)
      }
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')
      expect.assertions(2)

      fs.writeFileSync('script.sql', '-- empty')
      try {
        await DbExecute.new().parse([
          '--url=sqlserver://doesnotexist:1433;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;',
          '--file=./script.sql',
        ])
      } catch (e) {
        expect(e.code).toEqual('P1001')
        expect(e.message).toMatchInlineSnapshot(`
          "P1001

          Can't reach database server at \`doesnotexist:1433\`

          Please make sure your database server is running at \`doesnotexist:1433\`.
          "
        `)
      }
    })

    it('should fail with SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', 'DROP DATABASE "test-doesnotexists";')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Cannot drop the database 'test-doesnotexists', because it does not exist or you do not have permission.

        "
      `)
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', 'ThisisnotSQLitshouldfail')
      const result = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Could not find stored procedure 'ThisisnotSQLitshouldfail'.

        "
      `)
    })
  })
})
