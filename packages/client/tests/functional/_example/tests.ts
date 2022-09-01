import * as path from 'path'

import { getTestSuiteSchema } from '../_utils/getTestSuiteInfo'
import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('./node_modules/@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    // an example of how to query with the preloaded client
    test('findMany', async () => {
      await prisma.user.findMany()
    })

    test('suiteConfig', () => {
      /* 
      {
        provider: 'sqlite',
        id: 'Int @id @default(autoincrement())',
        providerFeatures: '',
        previewFeatures: '"interactiveTransactions"'
      }
    */

      expect(typeof suiteConfig.provider).toEqual('string')
    })

    test('suiteMeta', () => {
      /* 
      {
        testName: '_example',
        testPath: '/code/prisma/packages/client/tests/functional/_example/tests.ts',
        testRoot: '/code/projects/prisma/packages/client/tests/functional/_example',
        rootRelativeTestPath: 'tests.ts',
        rootRelativeTestDir: '.',
        testFileName: 'tests.ts',
        prismaPath: '/code/prisma/packages/client/tests/functional/_example/prisma',
        _matrixPath: '/code/prisma/packages/client/tests/functional/_example/_matrix',
        _schemaPath: '/code/prisma/packages/client/tests/functional/_example/prisma/_schema'
      }
    */

      expect(typeof suiteMeta.testPath).toEqual('string')
      expect(suiteMeta.testFileName).toEqual(path.basename(__filename))
    })

    test('getTestSuiteSchema', async () => {
      const schemaString = await getTestSuiteSchema(suiteMeta, suiteConfig)

      expect(schemaString).toContain('generator')
      expect(schemaString).toContain('datasource')
      expect(schemaString).toContain('model')
    })

    testIf(suiteConfig.provider !== 'mongodb')('conditional @ts-test-if', async () => {
      // @ts-test-if: provider !== 'mongodb'
      await prisma.$queryRaw`SELECT 1;`
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  // {
  //   optOut: {
  //     from: ['sqlite', 'mongodb'],
  //     reason: 'Only testing xyz provider(s) so opting out of sqlite and mongodb',
  //   },
  // },
)
