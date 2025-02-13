test('error is shown when both driver adapters and accelerate are not configured via @prisma/client/wasm', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/wasm')

    const newClient = () => new PrismaClient({})

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"PrismaClient failed to initialize because it wasn't configured to run in this environment (Node.js).
In order to run Prisma Client in an edge runtime, you will need to configure one of the following options:
- Enable Driver Adapters: https://pris.ly/d/driver-adapters
- Enable Accelerate: https://pris.ly/d/accelerate"
`)
  })
})

test('no error is shown when both driver adapters and accelerate are not configured via @prisma/client/default', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/default')

    const newClient = () => new PrismaClient({})

    expect(newClient).not.toThrow()
  })
})

export {}
