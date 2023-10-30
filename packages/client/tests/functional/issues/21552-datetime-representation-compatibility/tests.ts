import execa from 'execa'
import path from 'path'

import { DatasourceInfo } from '../../_utils/setupTestSuiteEnv'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const prisma: PrismaClient
declare const datasourceInfo: DatasourceInfo

/**
 * Regression test for https://github.com/prisma/prisma/issues/21552
 */
testMatrix.setupTestSuite(
  () => {
    test('can read back DateTime created via native connector', async () => {
      const seedOutput = await execa.node(path.join(__dirname, '_seed.ts'), [], {
        nodeOptions: ['-r', 'esbuild-register'],
        env: {
          [datasourceInfo.envVarName]: datasourceInfo.databaseUrl,
          PRISMA_DISABLE_QUAINT_EXECUTORS: '0',
        },
      })

      const writtenRecord = JSON.parse(seedOutput.stdout)

      const readRecord = await prisma.test.findUnique({
        where: {
          id: writtenRecord.id,
        },
      })

      expect(readRecord!.dt.toISOString()).toEqual(writtenRecord.dt)
    })
  },
  {
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: `
        The test needs direct access to database, and is only important to run with driver adapters,
        which are not supported with data proxy.
      `,
    },
  },
)
