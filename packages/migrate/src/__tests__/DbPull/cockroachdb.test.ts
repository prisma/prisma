// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { setupCockroach, tearDownCockroach } from '../../utils/setupCockroach'
import { SetupParams, tearDownPostgres } from '../../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
  if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
    throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
  }
  const connectionString = process.env.TEST_COCKROACH_URI_MIGRATE?.replace(
    'tests-migrate',
    'tests-migrate-db-pull-cockroachdb',
  )

  const setupParams = {
    connectionString: connectionString!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'cockroachdb'),
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

  test('basic introspection (with cockroachdb provider)', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (with postgresql provider)', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-postgresql-provider.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (no schema) --url', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (with cockroach provider) --url ', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (with cockroach provider) --url ', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--url',
      setupParams.connectionString,
      '--schema',
      'with-postgresql-provider.prisma',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb stopgaps', () => {
  if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
    throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
  }

  const connectionString = process.env.TEST_COCKROACH_URI_MIGRATE?.replace(
    'tests-migrate',
    'tests-migrate-db-pull-cockroachdb-stopgaps',
  )

  const computeSetupParams = (stopGap: string, warningCode: number, variant?: number): SetupParams => {
    const setupParams: SetupParams = {
      connectionString: connectionString!,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'cockroachdb',
        `${stopGap}-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  const setupCockroachForWarning = (stopGap: string, warningCode: number, variant?: number) => {
    const setupParams = computeSetupParams(stopGap, warningCode, variant)

    beforeEach(async () => {
      await setupCockroach(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_COCKROACH_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })
  }

  describe('warning 31 - row ttl found', () => {
    const stopGap = 'row-ttl'
    const warningCode = 31
    setupCockroachForWarning(stopGap, warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/cockroachdb/${stopGap}-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "cockroachdb"
          url      = env("TEST_COCKROACH_URI_MIGRATE")
        }

        /// This model is using a row level TTL in the database, and requires an additional setup in migrations. Read more: https://pris.ly/d/row-level-ttl
        model ttl_test {
          id          BigInt    @id @default(autoincrement())
          inserted_at DateTime? @default(now()) @db.Timestamp(6)
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These models are using a row level TTL setting defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/row-level-ttl
                //   - "ttl_test"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('warning 36/5 - comments found: models & fields', () => {
    const stopGap = 'comments'
    const warningCode = 36
    const variant = 5
    setupCockroachForWarning(stopGap, warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/cockroachdb/${stopGap}-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_COCKROACH_URI_MIGRATE")
        }

        /// This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
        model a {
          id  BigInt  @id
          val String? @db.VarChar(20)
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
                //   - Type: "model", name: "a"
                //   - Type: "field", name: "a.val"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})
