import { jestConsoleContext, jestContext, loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should read expanded env vars', () => {
  ctx.fixture('dotenv-6-expand')
  loadEnvFile('./expand/schema.prisma', true)

  expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA).toEqual(
    'postgres://user:password@server.host:5432/database?ssl=1&schema=schema1234',
  )
})
