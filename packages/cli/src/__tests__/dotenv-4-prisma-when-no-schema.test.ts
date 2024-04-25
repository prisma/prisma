import { jestContext, jestProcessContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestProcessContext()).assemble()

it('should read .env file in prisma folder when there is no schema', () => {
  ctx.fixture('dotenv-4-prisma-no-schema')

  loadEnvFile({ printMessage: true })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_NO_SCHEMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
