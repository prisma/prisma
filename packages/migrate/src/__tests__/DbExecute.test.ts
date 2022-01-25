import { DbExecute } from '../commands/DbExecute'
import { jestConsoleContext, jestContext } from '@prisma/sdk'
import fs from 'fs'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { SetupParams, setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('db execute', () => {
  it('--preview-feature flag is required', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `This command is in Preview. Use the --preview-feature flag to use it like prisma db execute --preview-feature`,
    )
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail if missing --file and --stdin', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Either --stdin or --file must be provided.
            See \`prisma db execute -h\`
          `)
  })

  it('should fail if both --file and --stdin are provided', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature', '--file=1', '--stdin'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            --stdin and --file cannot be used at the same time. Only 1 must be provided. 
            See \`prisma db execute -h\`
          `)
  })

  it('should fail if missing --schema and --url', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature', '--file=1'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Either --url or --schema must be provided.
            See \`prisma db execute -h\`
          `)
  })

  it('should fail if both --schema and --url are provided', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature', '--stdin', '--schema=1', '--url=1'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            --url and --schema cannot be used at the same time. Only 1 must be provided.
            See \`prisma db execute -h\`
          `)
  })

  describe('mongodb', () => {
    it('should fail with not supported error with --file --schema', async () => {
      ctx.fixture('schema-only-mongodb')

      fs.writeFileSync('script.js', 'Something for MongoDB')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.js',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              dbExecute is not supported on MongoDB


            `)
    })
  })

  describe('sqlite', () => {
    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-sqlite')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    // TODO, it's passing?
    it('should pass with --file --url=file:doesnotexists.db', async () => {
      ctx.fixture('introspection/sqlite')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`,
      )
      const result = DbExecute.new().parse(['--preview-feature', '--url=file:doesnotexists.db', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should pass with --file --url=file:dev.db', async () => {
      ctx.fixture('introspection/sqlite')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`,
      )
      const result = DbExecute.new().parse(['--preview-feature', '--url=file:dev.db', '--file=./script.sql'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    // TODO more tests
  })

  describe('postgresql', () => {
    const setupParams: SetupParams = {
      connectionString:
        process.env.TEST_POSTGRES_URI_MIGRATE || 'postgres://prisma:prisma@localhost:5432/tests-migrate',
      dirname: '',
    }

    beforeAll(async () => {
      await setupPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP SCHEMA IF EXISTS "test-dbexecute";
CREATE SCHEMA "test-dbexecute";
DROP SCHEMA "test-dbexecute";`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
-- start a transaction
BEGIN;

DROP SCHEMA IF EXISTS "test-dbexecute";
CREATE SCHEMA "test-dbexecute";
DROP SCHEMA "test-dbexecute";
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP SCHEMA IF EXISTS "test-dbexecute";
CREATE SCHEMA "test-dbexecute";
DROP SCHEMA "test-dbexecute";`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--url',
        process.env.TEST_POSTGRES_URI_MIGRATE!,
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    // Limitation of postgresql
    // DROP DATABASE cannot be executed from a function or multi-command string
    it('should fail if DROP DATABASE with --file --schema', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
      DROP DATABASE IF EXISTS "test-dbexecute";
      CREATE DATABASE "test-dbexecute";
      DROP DATABASE "test-dbexecute";`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toMatchInlineSnapshot(`
              db error: ERROR: DROP DATABASE cannot be executed from a function or multi-command string


            `)
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse(['--preview-feature', '--url=invalidurl', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              P1013

              The provided database string is invalid. Error parsing connection string: relative URL without a base in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.

            `)
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-postgresql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result1 = DbExecute.new().parse([
        '--preview-feature',
        '--url=mysql://johndoe:randompassword@doesnotexist:5432/mydb',
        '--file=./script.sql',
      ])
      await expect(result1).rejects.toThrowErrorMatchingInlineSnapshot(`
              P1001

              Can't reach database server at \`doesnotexist\`:\`5432\`

              Please make sure your database server is running at \`doesnotexist\`:\`5432\`.

            `)
    })

    it('should fail with SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Can't drop database 'test-doesnotexists'; database doesn't exist


            `)
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'This is not SQL, it should fail')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'This is not SQL, it should fail' at line 1


            `)
    })
  })

  describe('mysql', () => {
    const setupParams: SetupParams = {
      connectionString: process.env.TEST_MYSQL_URI_MIGRATE || 'mysql://root:root@localhost:3306/tests-migrate',
      dirname: '',
    }

    beforeAll(async () => {
      await setupMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP DATABASE IF EXISTS \`test-dbexecute\`;
CREATE DATABASE \`test-dbexecute\`;
DROP DATABASE \`test-dbexecute\`;`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should pass using a transaction with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
-- start a transaction
START TRANSACTION;

DROP DATABASE IF EXISTS \`test-dbexecute\`;
CREATE DATABASE \`test-dbexecute\`;
DROP DATABASE \`test-dbexecute\`;
      
-- commit changes    
COMMIT;`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP DATABASE IF EXISTS \`test-dbexecute\`;
CREATE DATABASE \`test-dbexecute\`;
DROP DATABASE \`test-dbexecute\`;`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--url',
        process.env.TEST_MYSQL_URI_MIGRATE!,
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse(['--preview-feature', '--url=invalidurl', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              P1013

              The provided database string is invalid. Error parsing connection string: relative URL without a base in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.

            `)
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result1 = DbExecute.new().parse([
        '--preview-feature',
        '--url=mysql://johndoe:randompassword@doesnotexist:5432/mydb',
        '--file=./script.sql',
      ])
      await expect(result1).rejects.toThrowErrorMatchingInlineSnapshot(`
              P1001

              Can't reach database server at \`doesnotexist\`:\`5432\`

              Please make sure your database server is running at \`doesnotexist\`:\`5432\`.

            `)
    })

    it('should fail with SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Can't drop database 'test-doesnotexists'; database doesn't exist


            `)
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'This is not SQL, it should fail')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'This is not SQL, it should fail' at line 1


            `)
    })
  })

  describe('sqlserver', () => {
    const connectionString = process.env.TEST_MSSQL_URI || 'mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/master'
    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownMSSQL(setupParams).catch((e) => {
        console.error(e)
      })
      await setupMSSQL(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should pass with --file --schema', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP DATABASE IF EXISTS "test-dbexecute";
CREATE DATABASE "test-dbexecute";
DROP DATABASE "test-dbexecute";`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should pass with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync(
        'script.sql',
        `-- Drop & Create & Drop
DROP DATABASE IF EXISTS "test-dbexecute";
CREATE DATABASE "test-dbexecute";
DROP DATABASE "test-dbexecute";`,
      )
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--url',
        process.env.TEST_MSSQL_JDBC_URI_MIGRATE!,
        '--file=./script.sql',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
    })

    it('should fail with P1013 error with invalid url with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse(['--preview-feature', '--url=invalidurl', '--file=./script.sql'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              P1013

              The provided database string is invalid. Error parsing connection string: relative URL without a base in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.

            `)
    })

    it('should fail with P1001 error with unreachable url with --file --url', async () => {
      ctx.fixture('schema-only-sqlserver')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result1 = DbExecute.new().parse([
        '--preview-feature',
        '--url=mysql://johndoe:randompassword@doesnotexist:5432/mydb',
        '--file=./script.sql',
      ])
      await expect(result1).rejects.toThrowErrorMatchingInlineSnapshot(`
              P1001

              Can't reach database server at \`doesnotexist\`:\`5432\`

              Please make sure your database server is running at \`doesnotexist\`:\`5432\`.

            `)
    })

    it('should fail with SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'DROP DATABASE `test-doesnotexists`;')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Can't drop database 'test-doesnotexists'; database doesn't exist


            `)
    })

    it('should fail with invalid SQL error from database with --file --schema', async () => {
      ctx.fixture('schema-only-mysql')

      fs.writeFileSync('script.sql', 'This is not SQL, it should fail')
      const result = DbExecute.new().parse([
        '--preview-feature',
        '--schema=./prisma/schema.prisma',
        '--file=./script.sql',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'This is not SQL, it should fail' at line 1


            `)
    })
  })
})
