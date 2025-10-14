test('error is shown when both drivers and accelerate are not configured via @prisma/client/wasm', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/wasm')

    const newClient = () => {
      const client = new PrismaClient({})
      client.$connect()
    }

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters"
`)
  })
})

test('no error is shown when both drivers and accelerate are not configured via @prisma/client/default', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/default')

    const newClient = () => new PrismaClient({})

    expect(newClient).not.toThrow()
  })
})

export {}
