// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { setupMSSQL, tearDownMSSQL } from '../../utils/setupMSSQL'
import { SetupParams } from '../../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

// We want to remove unique IDs to have stable snapshots
// Example:
// `PK__User__3213E83E450CDF1F` will be changed to `PK__User__RANDOM_ID_SANITIZED`
function sanitizeSQLServerIdName(schema: string) {
  const schemaRows = schema.split('\n')
  const regexp = new RegExp(/map: "PK__(.*)__(.*)"/)
  const schemaRowsSanitized = schemaRows.map((row) => {
    const match = regexp.exec(row)
    if (match) {
      row = row.replace(match[2], 'RANDOM_ID_SANITIZED')
    }
    return row
  })
  return schemaRowsSanitized.join('\n')
}

describeIf(!process.env.TEST_SKIP_MSSQL)('SQL Server', () => {
  if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_URI) {
    throw new Error('You must set a value for process.env.TEST_MSSQL_URI. See TESTING.md')
  }
  if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_JDBC_URI_MIGRATE) {
    throw new Error('You must set a value for process.env.TEST_MSSQL_JDBC_URI_MIGRATE. See TESTING.md')
  }

  const databaseName = 'tests-migrate-db-pull-sqlserver'
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MSSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'sqlserver'),
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

  test('basic introspection', async () => {
    ctx.fixture('introspection/sqlserver')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', process.env.TEST_MSSQL_JDBC_URI_MIGRATE!])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_MSSQL)('sqlserver-multischema', () => {
  if (process.env.CI) {
    // to avoid timeouts on macOS
    jest.setTimeout(80_000)
  } else {
    jest.setTimeout(20_000)
  }

  if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_URI) {
    throw new Error('You must set a value for process.env.TEST_MSSQL_URI. See TESTING.md')
  }

  // Note that this needs to be exactly the same as the one in the setup.sql file
  const databaseName = 'tests-migrate-db-pull-sqlserver-multischema'
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MSSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'sqlserver-multischema'),
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
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
  })

  test('without datasource property `schemas` it should error with P4001, empty database', async () => {
    ctx.fixture('introspection/sqlserver-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'without-schemas-in-datasource.prisma'])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=[]` should error with P1012, array can not be empty', async () => {
    ctx.fixture('introspection/sqlserver-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-0-value.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      Prisma schema validation - (get-config wasm)
      Error code: P1012
      error: If provided, the schemas array can not be empty.
        -->  schema.prisma:4
         | 
       3 |   url      = env("TEST_MSSQL_JDBC_URI_MIGRATE")
       4 |   schemas  = []
         | 

      Validation Error Count: 1
      [Context: getConfig]

      Prisma CLI Version : 0.0.0
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // TODO unskip in a following PR
  // We need to find out why this test can fail and pass in CI...
  // It was blocking the release pipeline
  // Examples
  // https://github.com/prisma/prisma/actions/runs/4013789656/jobs/6893546711 (most recent)
  // https://buildkite.com/prisma/test-prisma-typescript/builds/18825#01855966-3d90-4362-b130-502021a1047b
  test.skip('datasource property `schemas=["base", "transactional"]` should succeed', async () => {
    ctx.fixture('introspection/sqlserver-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-2-values.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                              // *** WARNING ***
                              // 
                              // The following models were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client:
                              //   - transactional_some_table
                              // 
                              // These items were renamed due to their names being duplicates in the Prisma Schema Language:
                              //   - type: model, name: base_some_table
                              //   - type: model, name: transactional_some_table
                              // 
                    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["base"]` should succeed', async () => {
    ctx.fixture('introspection/sqlserver-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-value.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist"]` should error with P4001, empty database', async () => {
    ctx.fixture('introspection/sqlserver-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-non-existing-value.prisma'])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist", "base"]` should succeed', async () => {
    ctx.fixture('introspection/sqlserver-multischema')
    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--schema',
      'with-schemas-in-datasource-1-existing-1-non-existing-value.prisma',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=does-not-exist` should error with with P4001, empty database', async () => {
    const introspect = new DbPull()
    const connectionString = `${process.env.TEST_MSSQL_JDBC_URI_MIGRATE}schema=does-not-exist`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=base` should succeed', async () => {
    const introspect = new DbPull()
    const connectionString = `${process.env.TEST_MSSQL_JDBC_URI_MIGRATE}schema=base`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
