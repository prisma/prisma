import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { getSchemaWithPath } from '@prisma/internals'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('load schema from package.json and generate a deprecation warning', async () => {
  ctx.fixture('package-json-schema')

  await expect(getSchemaWithPath()).resolves.toMatchObject({
    schemaRootDir: expect.stringMatching(/custom-path$/),
  })

  expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchSnapshot()
})
