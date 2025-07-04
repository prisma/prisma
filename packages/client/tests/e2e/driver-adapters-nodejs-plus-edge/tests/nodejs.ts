import { mockAdapterFactory } from '../../_utils/mock-adapter'

test('driver adapters can be used on `client` generator', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('./generated/prisma/client')

    const newClient = () =>
      new PrismaClient({
        adapter: mockAdapterFactory('postgres'),
      })

    expect(newClient).not.toThrow()
  })
})

export {}
