import { mockAdapterFactory } from '../../_utils/mock-adapter'

describe('driver adapters cannot be used with accelerate', () => {
  let dbURL: string | undefined

  beforeEach(() => {
    dbURL = process.env['DATABASE_URL']
    process.env['DATABASE_URL'] = 'prisma://localhost:1234'
  })

  afterEach(() => {
    process.env['DATABASE_URL'] = dbURL
  })

  test('driver adapters cannot be used with accelerate via @prisma/client/wasm', () => {
    jest.isolateModules(() => {
      const { PrismaClient } = require('@prisma/client/wasm')

      const newClient = () =>
        new PrismaClient({
          adapter: mockAdapterFactory('postgres'),
        })

      expect(newClient).toThrowErrorMatchingInlineSnapshot(`
  "You've provided both a driver adapter and an Accelerate database URL. Driver adapters currently cannot connect to Accelerate.
  Please provide either a driver adapter with a direct database URL or an Accelerate URL and no driver adapter."
  `)
    })
  })

  test('driver adapters cannot be used with accelerate via @prisma/client/default', () => {
    jest.isolateModules(() => {
      const { PrismaClient } = require('@prisma/client/default')

      const newClient = () =>
        new PrismaClient({
          adapter: mockAdapterFactory('postgres'),
        })

      expect(newClient).toThrowErrorMatchingInlineSnapshot(`
  "You've provided both a driver adapter and an Accelerate database URL. Driver adapters currently cannot connect to Accelerate.
  Please provide either a driver adapter with a direct database URL or an Accelerate URL and no driver adapter."
  `)
    })
  })
})

export {}
