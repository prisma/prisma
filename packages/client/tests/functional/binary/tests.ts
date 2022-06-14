import { getNodeAPIName, getPlatform } from '@prisma/sdk'
import * as fs from 'fs'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let downloadPath: string

testMatrix.setupTestSuite(() => {
  test('should assert that the engine binary is downloaded and usable', async () => {
    const thisPlatform = await getPlatform()
    const apiName = getNodeAPIName(thisPlatform, 'fs')

    expect(fs.existsSync(downloadPath)).toBe(true)
    expect(downloadPath).toContain(apiName)
    await expect(prisma.$connect()).resolves.not.toThrow()

    prisma.$disconnect().catch(() => undefined)
  })
})
