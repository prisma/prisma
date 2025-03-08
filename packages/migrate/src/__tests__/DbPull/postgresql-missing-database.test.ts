// describeIf is making eslint unhappy about the test names

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { DbPull } from '../../commands/DbPull'
import CaptureStdout from '../__helpers__/captureStdout'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

describe('postgresql - missing database', () => {
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

  const defaultConnectionString = process.env.TEST_POSTGRES_URI_MIGRATE

  // replace database name, e.g., 'tests-migrate', with 'unknown-database'
  const connectionString = `${defaultConnectionString.split('/').slice(0, -1).join('/')}/unknown-database`

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', connectionString], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "
      P1003 The introspected database does not exist:

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to an existing database.

      Then you can run prisma db pull again. 
      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
