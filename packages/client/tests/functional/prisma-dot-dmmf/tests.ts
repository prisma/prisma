import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace } from './node_modules/@prisma/client'

declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ clientRuntime }) => {
    testIf(clientRuntime !== 'wasm')('exports Prisma.dmmf (default)', () => {
      expect(Prisma.dmmf).toMatchSnapshot()
    })

    testIf(clientRuntime === 'wasm')('exports Prisma.dmmf (wasm)', () => {
      expect(Prisma.dmmf).toMatchSnapshot()
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    skipDataProxy: {
      runtimes: ['edge', 'node'],
      reason: 'Data proxy embeds full DMMF',
    },
  },
)
