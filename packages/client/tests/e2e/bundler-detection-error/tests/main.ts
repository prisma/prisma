import { $ } from 'zx'

const consoleMock = jest.spyOn(global.console, 'warn').mockImplementation()

afterEach(() => {
  consoleMock.mockClear()
})

test('bundled prisma client will re-use the schema.prisma via cwd', async () => {
  const { somePrismaCall } = require('../dist/index.js')

  const user = await somePrismaCall()

  expect(user).not.toBeNull()
  expect(user).not.toBeUndefined()
})

// ! this test must be run last because it deletes the generated client
test('bundled prisma client will fail if generated client is gone', async () => {
  await $`rm -rf generated`

  const { somePrismaCall } = require('../dist/index.js')

  await expect(somePrismaCall()).rejects.toThrowErrorMatchingInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation:


Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x".

This is likely caused by a bundler that has not copied "libquery_engine-debian-openssl-3.0.x.so.node" next to the resulting bundle.
Ensure that "libquery_engine-debian-openssl-3.0.x.so.node" has been copied next to the bundle or in "generated/client".

We would appreciate if you could take the time to share some information with us.
Please help us by answering a few questions: https://pris.ly/engine-not-found-bundler-investigation

The following locations have been searched:
  /test/bundler-detection-error/generated/client
  /test/bundler-detection-error
  /.prisma/client
  /tmp/prisma-engines
  /test/bundler-detection-error/prisma"
`)
})
