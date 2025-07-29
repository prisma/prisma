import { defaultTestConfig } from '@prisma/config'
import { jestContext, jestStdoutContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestStdoutContext()).assemble()

it('should read expanded env vars', async () => {
  ctx.fixture('dotenv-6-expand')
  await loadEnvFile({ schemaPath: './expand/schema.prisma', printMessage: true, config: defaultTestConfig() })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    "Environment variables loaded from expand/.env
    "
  `)

  expect(process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA).toEqual(
    'postgres://user:password@server.host:5432/database?ssl=1&schema=schema1234',
  )
})
