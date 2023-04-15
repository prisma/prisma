import { PrismaClient } from '@prisma/client'

test('vercel env var + auto generate', () => {
  const consoleMock = jest.spyOn(global.console, 'error').mockImplementation()

  try {
    const prisma = new PrismaClient()
    prisma.$connect()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`
[Error: Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

Learn how: https://pris.ly/d/vercel-build]
`)

    expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
[
  "Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

Learn how: https://pris.ly/d/vercel-build",
]
`)
  }
})
