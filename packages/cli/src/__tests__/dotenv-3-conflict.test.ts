import { jestConsoleContext, jestContext } from '@prisma/get-platform'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should throw error', async () => {
  ctx.fixture('dotenv-3-conflict')
  expect.assertions(1)

  await expect(
    ctx.cli('validate').catch((e) => {
      const message = e.message.split('\n').slice(1).join('\n')
      throw new Error(message)
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    "prisma:warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).
    For more information, see: https://pris.ly/prisma-config

    Error: There is a conflict between env var in .env and prisma/.env
    Conflicting env vars:
      SHOULD_THROW

    We suggest to move the contents of prisma/.env to .env to consolidate your env vars.
    "
  `)
})
