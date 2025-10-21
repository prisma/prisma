import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace } from './generated/prisma/client'

declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ clientRuntime, generatorType }) => {
    describeIf(generatorType === 'prisma-client-js')('Prisma.dmmf in JS client', () => {
      testIf(clientRuntime !== 'wasm-engine-edge')('exports Prisma.dmmf (default)', () => {
        expect(Prisma.dmmf).toMatchSnapshot()
      })

      testIf(clientRuntime === 'wasm-engine-edge')('exports Prisma.dmmf (wasm)', () => {
        expect(() => Prisma.dmmf).toThrowErrorMatchingInlineSnapshot(
          `"Prisma.dmmf is not available when running in edge runtimes."`,
        )
      })
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    skipDataProxy: {
      runtimes: ['node'],
      reason: 'Data proxy embeds full DMMF',
    },
  },
)
