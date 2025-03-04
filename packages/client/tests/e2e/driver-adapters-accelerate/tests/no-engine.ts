import { mockAdapter } from '../../_utils/mock-adapter'

test('driver adapters be used without an engine via @prisma/client/wasm', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/wasm')

    const newClient = () =>
      new PrismaClient({
        adapter: mockAdapter('postgres'),
      })

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"Prisma Client was configured to use the \`adapter\` option but \`prisma generate\` was run with \`--no-engine\`.
Please run \`prisma generate\` without \`--no-engine\` to be able to use Prisma Client with the adapter."
`)
  })
})

test('driver adapters cannot be used without an engine via @prisma/client/default', () => {
  jest.isolateModules(() => {
    const { PrismaClient } = require('@prisma/client/default')

    const newClient = () =>
      new PrismaClient({
        adapter: mockAdapter('postgres'),
      })

    expect(newClient).toThrowErrorMatchingInlineSnapshot(`
"Prisma Client was configured to use the \`adapter\` option but \`prisma generate\` was run with \`--no-engine\`.
Please run \`prisma generate\` without \`--no-engine\` to be able to use Prisma Client with the adapter."
`)
  })
})
