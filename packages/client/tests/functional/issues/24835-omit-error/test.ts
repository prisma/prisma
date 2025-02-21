// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('have omitted field as never', async () => {
    const example = await prisma.a.findFirst({
      include: {
        model_b: {
          include: {
            c: true,
          },
          omit: {
            private_field: true,
          },
        },
      },
      omit: { id: true },
    })

    // @ts-expect-error
    example?.model_b[0].private_field
  })
})
