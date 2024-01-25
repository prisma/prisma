import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('Bytes encoding is preserved', async () => {
      const inputStrings = ['AQID', 'FSDF', 'AA']
      const inputBuffers = inputStrings.map((s) => Buffer.from(s))
      const inputData = inputBuffers.map((b, i) => ({ id: `${i + 1}`, bytes: b }))

      await prisma.a.createMany({
        data: inputData,
      })

      const result = prisma.a.findMany()
      expect(result).toEqual(inputData)
    })
  },
  {
    ...defaultTestSuiteOptions,
  },
)
