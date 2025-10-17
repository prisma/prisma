import { vitestConsoleContext, vitestContext } from '@prisma/get-platform/src/test-utils/vitestContext'

const ctx = vitestContext.new().add(vitestConsoleContext()).assemble()

it('should throw error', async () => {
  ctx.fixture('dotenv-3-conflict')
  expect.assertions(1)

  await expect(
    ctx.cli('validate').catch((e) => {
      const message = e.message.split('\n').slice(1).join('\n')
      throw new Error(message)
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    "Error: There is a conflict between env var in .env and prisma/.env
    Conflicting env vars:
      SHOULD_THROW

    We suggest to move the contents of prisma/.env to .env to consolidate your env vars.
    "
  `)
})
