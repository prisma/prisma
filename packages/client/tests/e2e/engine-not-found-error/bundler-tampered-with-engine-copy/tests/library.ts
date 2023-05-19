import { PrismaClient } from '../dist/index'

test('test', async () => {
  const prisma = new PrismaClient()

  const result = prisma.user.create({
    data: { email: Date.now() + '' },
  })

  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation:


Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.1.x".

This is likely caused by a bundler that has not copied "libquery_engine-debian-openssl-1.1.x.so.node" near the resulting bundle.
Please try to make sure that "libquery_engine-debian-openssl-1.1.x.so.node" is copied right near your bundle or "prisma/client".

We would appreciate if you could take the time to share some information with us.
Please help us by answering a few questions: https://pris.ly/engine-not-found-bundler-investigation

The following locations have been searched:
  /test/engine-not-found-error/bundler-tampered-with-engine-copy/prisma/client
  /test/engine-not-found-error/bundler-tampered-with-engine-copy
  /test/.prisma/client
  /tmp/prisma-engines
  /test/engine-not-found-error/bundler-tampered-with-engine-copy/prisma"
`)
})

export {}
