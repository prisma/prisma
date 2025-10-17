import { defaultTestConfig } from '@prisma/config'
import { vitestContext, vitestStdoutContext } from '@prisma/get-platform/src/test-utils/vitestContext'
import { loadEnvFile } from '@prisma/internals'

const ctx = vitestContext.new().add(vitestStdoutContext()).assemble()

it('should not load root .env file', async () => {
  ctx.fixture('dotenv-5-only-root')

  await loadEnvFile({ printMessage: true, config: defaultTestConfig() })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    "Environment variables loaded from .env
    "
  `)

  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
