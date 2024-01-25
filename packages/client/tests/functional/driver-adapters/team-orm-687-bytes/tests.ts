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

      // sqlite doesn't support `createMany` yet
      await prisma.$transaction(inputData.map((data) => prisma.a.create({ data })))

      const result = await prisma.a.findMany()
      expect(result).toEqual(inputData)
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDefaultClientInstance: false,
  },
)
