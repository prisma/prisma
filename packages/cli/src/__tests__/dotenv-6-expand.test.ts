import { jestContext, jestProcessContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestProcessContext()).assemble()

it('should read expanded env vars', () => {
  ctx.fixture('dotenv-6-expand')
  loadEnvFile({ schemaPath: './expand/schema.prisma', printMessage: true })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA).toEqual(
    'postgres://user:password@server.host:5432/database?ssl=1&schema=schema1234',
  )
})
