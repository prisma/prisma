// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { setupMysql, tearDownMysql } from '../../utils/setupMysql'
import { SetupParams } from '../../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const testIf = (condition: boolean) => (condition ? test : test.skip)

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describe('mysql', () => {
  const connectionString = process.env.TEST_MYSQL_URI!.replace('tests-migrate', 'tests-migrate-db-pull-mysql')

  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MYSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'mysql'),
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

  test('basic introspection', async () => {
    ctx.fixture('introspection/mysql')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // TODO: snapshot fails on CI for macOS and Windows because the connection
  // string is different, either add steps to the database setup to create the
  // user and set password for MySQL, or sanitize the snapshot.
  testIf(!isMacOrWindowsCI)('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('mysql introspection stopgaps', () => {
  const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull-mysql')

  const computeSetupParams = (stopGap: string, warningCode: number, variant?: number): SetupParams => {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'mysql',
        `${stopGap}-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  const setupMysqlForWarning = (stopGap: string, warningCode: number, variant?: number) => {
    const setupParams = computeSetupParams(stopGap, warningCode, variant)

    beforeEach(async () => {
      await setupMysql(setupParams)

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
  }

  describe('warning 36/4 - comments found: models & fields', () => {
    const stopGap = 'comments'
    const warningCode = 36
    const variant = 4
    setupMysqlForWarning(stopGap, warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/mysql/${stopGap}-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "mysql"
          url      = env("TEST_MYSQL_URI_MIGRATE")
        }

        /// This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
        model a {
          id Int  @id @default(autoincrement())
          a  Int?
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
                //   - Type: "model", name: "a"
                //   - Type: "field", name: "a.a"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})
