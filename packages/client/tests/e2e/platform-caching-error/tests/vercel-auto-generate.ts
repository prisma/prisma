import { PrismaClient } from '@prisma/client'

test('vercel env var + auto generate', () => {
  try {
    const prisma = new PrismaClient()
    prisma.$connect()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`
[Error: We detected that your project setup might lead to outdated Prisma Client being used.
Please make sure to run the \`prisma generate\` command during your build process.
Learn how: https://pris.ly/d/vercel-build]
`)
  }
})
