import { mockAdapter } from '../../_utils/mock-adapter'

describe('driver adapters cannot be used with accelerate', () => {
  let dbURL: string | undefined

  beforeEach(() => {
    dbURL = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'prisma://localhost:1234'
  })

  afterEach(() => {
    process.env.DATABASE_URL = dbURL
  })

  test('driver adapters cannot be used with accelerate via @prisma/client/wasm', () => {
    jest.isolateModules(() => {
      const { PrismaClient } = require('@prisma/client/wasm')

      const newClient = () =>
        new PrismaClient({
          adapter: mockAdapter('postgres'),
        })

      expect(newClient).toThrowErrorMatchingInlineSnapshot(`
  "Prisma Client was configured to use the \`adapter\` option but the URL was a \`prisma://\` URL.
  Please either use the \`prisma://\` URL or remove the \`adapter\` from the Prisma Client constructor."
  `)
    })
  })

  test('driver adapters cannot be used with accelerate via @prisma/client/default', () => {
    jest.isolateModules(() => {
      const { PrismaClient } = require('@prisma/client/default')

      const newClient = () =>
        new PrismaClient({
          adapter: mockAdapter('postgres'),
        })

      expect(newClient).toThrowErrorMatchingInlineSnapshot(`
  "Prisma Client was configured to use the \`adapter\` option but the URL was a \`prisma://\` URL.
  Please either use the \`prisma://\` URL or remove the \`adapter\` from the Prisma Client constructor."
  `)
    })
  })
})
