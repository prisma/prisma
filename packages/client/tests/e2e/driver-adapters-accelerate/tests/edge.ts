import { mockAdapter } from '../../_utils/mock-adapter'

test('driver adapters cannot be used via @prisma/client/edge', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/edge')

    const newClient = () =>
      new PrismaClient({
        adapter: mockAdapter('postgres'),
      })

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"Prisma Client was configured to use the \`adapter\` option but it was imported via its \`/edge\` endpoint.
Please either remove the \`/edge\` endpoint or remove the \`adapter\` from the Prisma Client constructor."
`)
  })
})
