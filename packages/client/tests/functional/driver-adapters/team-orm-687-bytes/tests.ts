import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('Bytes encoding is preserved', async () => {
      const inputStrings = ['AQID', 'FSDF', 'AA', 'BB']
      const inputBtoas = inputStrings.map((s) => btoa(s))
      const inputs = [...inputStrings, ...inputBtoas]

      const inputBuffers = inputs.map((s) => Buffer.from(s))
      const inputData = inputBuffers.map((b, i) => ({ id: `${i + 1}`, bytes: new Uint8Array(b) }))

      // sqlite doesn't support `createMany` yet
      await prisma.$transaction(inputData.map((data) => prisma.a.create({ data })))

      const outputData = await prisma.a.findMany()

      expect(outputData).toEqual(inputData)
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDefaultClientInstance: false,
  },
)
