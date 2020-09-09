import fs from 'fs'
import path from 'path'
import { getPlatform } from '@prisma/get-platform'
import { generateTestClient } from '../../../../utils/getTestClient'

test('corruption', async () => {
  expect.assertions(1)

  await generateTestClient()
  const { PrismaClient } = require('@prisma/client')
  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
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

  await expect(prisma.user.findMany()).rejects.toThrowError('not found')
})
