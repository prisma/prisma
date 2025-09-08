test('error is shown when both driver adapters and accelerate are not configured via @prisma/client/wasm', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/wasm')

    const newClient = () => {
      const client = new PrismaClient({})
      client.$connect()
    }

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in \`Node.js\`).
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report"
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
