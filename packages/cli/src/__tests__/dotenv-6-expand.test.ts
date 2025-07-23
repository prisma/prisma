import { jestContext, jestStdoutContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'
import { defaultTestConfig } from '@vetching-corporation/prisma-config'

const ctx = jestContext.new().add(jestStdoutContext()).assemble()

it('should read expanded env vars', async () => {
  ctx.fixture('dotenv-6-expand')
  await loadEnvFile({ schemaPath: './expand/schema.prisma', printMessage: true, config: defaultTestConfig() })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA).toEqual(
    'postgres://user:password@server.host:5432/database?ssl=1&schema=schema1234',
  )
})
