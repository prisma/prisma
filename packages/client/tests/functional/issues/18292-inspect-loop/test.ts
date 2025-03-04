import { inspect } from 'node:util'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.user.create({ data: { email: 'user@example.com' } })
  })

  test('it is possible to inspect/log prisma client', () => {
    expect(() => inspect(prisma)).not.toThrow()
  })

  test('result extensions are still logged/inspected correctly', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          computedField: {
            needs: [],
            compute() {
              return 'HELLO!!!'
            },
          },
        },
      },
    })

    const user = await xprisma.user.findFirstOrThrow({ select: { computedField: true, email: true } })
    expect(inspect(user)).toMatchInlineSnapshot(`"{ email: 'user@example.com', computedField: 'HELLO!!!' }"`)
  })

  test('depth option is respected', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          computedField: {
            needs: [],
            compute() {
              return { deeply: { nested: { value: 123 } } }
            },
          },
        },
      },
    })

    const user = await xprisma.user.findFirstOrThrow({ select: { computedField: true, email: true } })
    expect(inspect(user, { depth: 1 })).toMatchInlineSnapshot(
      `"{ email: 'user@example.com', computedField: { deeply: [Object] } }"`,
    )
  })
})
