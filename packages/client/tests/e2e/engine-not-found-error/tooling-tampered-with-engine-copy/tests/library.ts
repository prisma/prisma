import { PrismaClient } from '../prisma/client'

test('test', async () => {
  const prisma = new PrismaClient()

  const result = prisma.user.create({
    data: { email: Date.now() + '' },
  })

  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation in
/test/engine-not-found-error/tooling-tampered-with-engine-copy/tests/library.ts:6:30

  3 test('test', async () => {
  4   const prisma = new PrismaClient()
  5 
→ 6   const result = prisma.user.create(
Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x".

This is likely caused by tooling that has not copied "libquery_engine-debian-openssl-1.1.x.so.node" to the deployment folder.
Ensure that you ran \`prisma generate\` and that "libquery_engine-debian-openssl-1.1.x.so.node" has been copied to "prisma/client".

We would appreciate if you could take the time to share some information with us.
Please help us by answering a few questions: https://pris.ly/engine-not-found-tooling-investigation

The following locations have been searched:
  /test/engine-not-found-error/tooling-tampered-with-engine-copy/prisma/client
  /test/engine-not-found-error/tooling-tampered-with-engine-copy/.prisma/client
  /tmp/prisma-engines
  /test/engine-not-found-error/tooling-tampered-with-engine-copy/prisma"
`)
})

export {}
