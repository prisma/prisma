// describeIf is making eslint unhappy about the test names

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import path from 'node:path'

import { DbPull } from '../../commands/DbPull'
import { setupCockroach, tearDownCockroach } from '../../utils/setupCockroach'
import CaptureStdout from '../__helpers__/captureStdout'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
  const captureStdout = new CaptureStdout()

  beforeEach(() => {
    captureStdout.startCapture()
  })

  afterEach(() => {
    captureStdout.clearCaptureText()
  })

  afterAll(() => {
    captureStdout.stopCapture()
  })

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
    const result = introspect.parse(['--print'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection (with postgresql provider) should fail', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-postgresql-provider.prisma'], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "You are trying to connect to a CockroachDB database, but the provider in your Prisma schema is \`postgresql\`. Please change it to \`cockroachdb\`.

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection (no schema) --url', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection (with cockroach provider) --url ', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection (with postgresql provider) --url should fail', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schema', 'with-postgresql-provider.prisma'],
      defaultTestConfig(),
    )
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "You are trying to connect to a CockroachDB database, but the provider in your Prisma schema is \`postgresql\`. Please change it to \`cockroachdb\`.

      "
    `)
    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
