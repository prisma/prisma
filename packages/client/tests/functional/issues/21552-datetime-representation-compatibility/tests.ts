import execa from 'execa'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { DatasourceInfo } from '../../_utils/setupTestSuiteEnv'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const prisma: PrismaClient
declare const datasourceInfo: DatasourceInfo

/**
 * Regression test for https://github.com/prisma/prisma/issues/21552
 */
testMatrix.setupTestSuite(
  ({ engineType }, suiteMeta) => {
    test('can read back DateTime created via native connector', async () => {
      // Copy the seed script to the generated directory so that it imports the
      // correct client, and so that the schema-relative sqlite database path is
      // resolved the same way as in the test.
      await fs.cp(path.join(__dirname, '_seed.ts'), path.join(suiteMeta.generatedFolder, '_seed.ts'))

      // Use a separate process for seeding to use native drivers. We can't turn
      // the native quaint executor back on in the current process when testing
      // against driver adapters.
      const seedOutput = await execa.node(path.join(suiteMeta.generatedFolder, '_seed.ts'), [], {
        nodeOptions: ['-r', 'esbuild-register'],
        env: {
          [datasourceInfo.envVarName]: datasourceInfo.databaseUrl,
          PRISMA_DISABLE_QUAINT_EXECUTORS: '0',
          // we force the engine type to either binary or library and discard wasm
          // this is necessary because the seed script is run in a separate process
          // and is not actually using a driver adapter - which yields an error
          PRISMA_CLIENT_ENGINE_TYPE: engineType === 'binary' ? 'binary' : 'library',
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
    skipEngine: {
      from: ['client'],
      reason: 'Client engine cannot be used with native drivers but requires driver adapters / wasm.',
    },
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: `
        The test needs direct access to database, and is only important to run with driver adapters,
        which are not supported with data proxy.
      `,
    },
    skipDriverAdapter: {
      from: ['js_d1'],
      reason: 'The native connector library/binary cannot be used to talk to D1',
    },
  },
)
