import { getNapiName, getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'

test('corruption of query engine binary', async () => {
  // testing for corruption of the main query engine
  if (process.env.PRISMA_FORCE_NAPI === 'true') {
    return
  }
  expect.assertions(1)

  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    process.env.PRISMA_FORCE_NAPI
      ? getNapiName(platform, 'fs')
      : `query-engine-${platform}`,
  )
  fs.writeFileSync(binaryPath, 'hello world')

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
    errorFormat: 'minimal',
  })

  await expect(prisma.user.findMany()).rejects.toThrowError()
})
