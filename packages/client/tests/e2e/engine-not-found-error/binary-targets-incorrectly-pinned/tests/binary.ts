import { PrismaClient } from '../prisma/client'

test('test', async () => {
  const prisma = new PrismaClient()

  const result = prisma.user.create({
    data: { email: Date.now() + '' },
  })

  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation in
/test/engine-not-found-error/binary-targets-incorrectly-pinned/tests/binary.ts:6:30

  3 test('test', async () => {
  4   const prisma = new PrismaClient()
  5 
→ 6   const result = prisma.user.create(
Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x".

This happened because \`binaryTargets\` have been pinned, but the actual deployment also required "debian-openssl-1.1.x".
Add "debian-openssl-1.1.x" to \`binaryTargets\` in the "schema.prisma" file and run \`prisma generate\` after saving it:

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["windows", "debian-openssl-1.1.x"]
}

The following locations have been searched:
  /test/engine-not-found-error/binary-targets-incorrectly-pinned/prisma/client
  /test/engine-not-found-error/binary-targets-incorrectly-pinned/.prisma/client
  /tmp/prisma-engines
  /test/engine-not-found-error/binary-targets-incorrectly-pinned/prisma"
`)
})

export {}
