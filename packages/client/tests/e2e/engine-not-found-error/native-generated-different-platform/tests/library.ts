import { PrismaClient } from '../prisma/client'

test('test', async () => {
  const prisma = new PrismaClient()

  const result = prisma.user.create({
    data: { email: Date.now() + '' },
  })

  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation in
/test/engine-not-found-error/native-generated-different-platform/tests/library.ts:6:30

  3 test('test', async () => {
  4   const prisma = new PrismaClient()
  5 
→ 6   const result = prisma.user.create(
Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x".

This happened because Prisma Client was generated for "netbsd", but the actual deployment required "debian-openssl-1.1.x".
Add "debian-openssl-1.1.x" to \`binaryTargets\` in the "schema.prisma" file and run \`prisma generate\` after saving it:

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x"]
}

The following locations have been searched:
  /test/engine-not-found-error/native-generated-different-platform/prisma/client
  /test/engine-not-found-error/native-generated-different-platform/.prisma/client
  /tmp/prisma-engines
  /test/engine-not-found-error/native-generated-different-platform/prisma"
`)
})

export {}
