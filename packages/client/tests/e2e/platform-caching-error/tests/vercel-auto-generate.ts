import { PrismaClient } from '@prisma/client'

test('vercel env var + auto generate', () => {
  try {
    const prisma = new PrismaClient()
    prisma.$connect()
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`
[Error: We have detected that you've built your project on Vercel, which caches dependencies.
This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered.
To fix this, make sure to run the \`prisma generate\` command during your build process.
Learn how: https://pris.ly/d/vercel-build]
`)
  }
})
