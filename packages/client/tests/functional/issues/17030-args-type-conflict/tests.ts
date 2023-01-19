import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('include works correctly', async () => {
    const info = await prisma.characterInfo.findUnique({
      where: {
        entryLanguage_characterId: {
          characterId: '',
          entryLanguage: '',
        },
      },
      include: {
        details: true,
      },
    })

    expectTypeOf(info!).toHaveProperty('details')
  })
})
