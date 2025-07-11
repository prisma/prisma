import { mockAdapterFactory } from '../../_utils/mock-adapter'

test('driver adapters can be used on `edge` generator', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('./generated/prisma-edge/client')

    const newClient = () =>
      new PrismaClient({
        adapter: mockAdapterFactory('postgres'),
      })

    expect(newClient).not.toThrow()
  })
})

export {}
