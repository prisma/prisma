import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta) => {
  test('calling upsert two times in a row does nothing', async () => {
    for (let i = 0; i < 2; i++) {
      const node = await prisma.node.upsert({
        where: { identifier: 1 },
        create: { identifier: 1, value: 5 },
        update: { value: 5 },
      })
      expect(node.identifier).toEqual(1)
      expect(node.value).toEqual(5)
    }
  })
})
