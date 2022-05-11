import * as path from 'path'

import { getTestSuiteSchema } from '../_utils/getTestSuiteInfo'
import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix((suiteConfig, suiteMeta) => {
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
        testPath: './code/prisma/packages/client/tests/functional/_example/tests.ts',
        testDir: './code/prisma/packages/client/tests/functional/_example',
        testDirName: '_example',
        testFileName: 'tests.ts',
        prismaPath: './code/prisma/packages/client/tests/functional/_example/prisma',
        _matrixPath: './code/prisma/packages/client/tests/functional/_example/_matrix',
        _schemaPath: './code/prisma/packages/client/tests/functional/_example/prisma/_schema'
      }
    */

    expect(typeof suiteMeta.testPath).toEqual('string')
    expect(suiteMeta.testFileName).toEqual(__filename.split(path.sep).pop())
  })

  test('getTestSuiteSchema', async () => {
    const schemaString = await getTestSuiteSchema(suiteMeta, suiteConfig)

    expect(schemaString).toContain('generator')
    expect(schemaString).toContain('datasource')
    expect(schemaString).toContain('model')
  })
})
