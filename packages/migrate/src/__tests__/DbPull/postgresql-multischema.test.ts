// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describe('postgresql-multischema', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-multischema-postgresql',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'postgresql-multischema'),
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

  test('without datasource property `schemas` it should error with P4001, empty database', async () => {
    ctx.fixture('introspection/postgresql-multischema')
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
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-0-value.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      Prisma schema validation - (get-config wasm)
      Error code: P1012
      error: If provided, the schemas array can not be empty.
        -->  schema.prisma:4
         | 
       3 |   url      = env("TEST_POSTGRES_URI_MIGRATE")
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

  test('datasource property `schemas=["base", "transactional"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-2-values.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            // *** WARNING ***
            // 
            // These items were renamed due to their names being duplicates in the Prisma Schema Language:
            //   - Type: "enum", name: "base_status"
            //   - Type: "enum", name: "transactional_status"
            //   - Type: "model", name: "base_some_table"
            //   - Type: "model", name: "transactional_some_table"
            // 
        `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["base"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-value.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist"]` should error with P4001, empty database', async () => {
    ctx.fixture('introspection/postgresql-multischema')
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
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--schema',
      'with-schemas-in-datasource-1-existing-1-non-existing-value.prisma',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with --schemas=base without preview feature should error', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    ctx.fs.remove(`./schema.prisma`)

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'base'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      The preview feature \`multiSchema\` must be enabled before using --schemas command line parameter.


    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with --schemas=does-not-exist should error', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'does-not-exist'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

      P4001 The introspected database was empty: postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema-postgresql

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a table in your database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

      Then you can run prisma db pull again. 

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url --schemas=base (1 existing schema) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'base'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url  --schemas=base,transactional (2 existing schemas) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--url',
      setupParams.connectionString,
      '--schemas',
      'base,transactional',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            // *** WARNING ***
            // 
            // These items were renamed due to their names being duplicates in the Prisma Schema Language:
            //   - Type: "enum", name: "base_status"
            //   - Type: "enum", name: "transactional_status"
            //   - Type: "model", name: "base_some_table"
            //   - Type: "model", name: "transactional_some_table"
            // 
        `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url  --schemas=base,does-not-exist (1 existing schemas + 1 non-existing) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--url',
      setupParams.connectionString,
      '--schemas',
      'base,does-not-exist',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with --schemas=["does-not-exist", "base"] should error', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'base'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=does-not-exist` should error with with P4001, empty database', async () => {
    const introspect = new DbPull()
    // postgres://prisma:prisma@localhost:5432/tests-migrate?schema=does-not-exist
    const connectionString = `${setupParams.connectionString}?schema=does-not-exist`
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
    // postgres://prisma:prisma@localhost:5432/tests-migrate?schema=base
    const connectionString = `${setupParams.connectionString}?schema=base`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
