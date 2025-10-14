import { mockDriverFactory } from '../../_utils/mock-adapter'

test('drivers cannot be used via @prisma/client/edge', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/edge')

    const newClient = () =>
      new PrismaClient({
        driver: mockDriverFactory('postgres'),
      })

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"Prisma Client was configured to use the \`driver\` option but it was imported via its \`/edge\` endpoint.
Please either remove the \`/edge\` endpoint or remove the \`driver\` from the Prisma Client constructor."
`)
  })
})

export {}
